<#
.SYNOPSIS
Vukoli launcher for Windows: opens the app (starting the local server first if needed), or stops it.

  Vukoli.cmd            start the server if it is not running, then open the app in its own window
                        (Edge or Chrome app mode: no tabs, no address bar)
  Vukoli.cmd stop       stop the server
  Vukoli.cmd status     say whether it is running
  Vukoli.cmd vukoli://start   what the "Start Vukoli" link of an installed, closed app runs: start the server, open nothing
  -NoBrowser            open nothing (or set VUKOLI_NO_BROWSER=1)
  -Browser              open a normal tab in the default browser instead of an app window (or set VUKOLI_APP_WINDOW=0)

Port: IC_PORT (default 8000). Wait for the server: VUKOLI_START_TIMEOUT seconds (default 30).
Plain ASCII on purpose (Windows PowerShell 5.1 reads other encodings wrongly).
#>
param(
    [Parameter(Position = 0)][string]$Command = 'open',
    [switch]$NoBrowser,
    [switch]$Browser
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { $null = $_ }

# <prefix>\app\install\windows\vukoli.ps1  ->  prefix is three levels up (VUKOLI_PREFIX overrides)
$prefix = $env:VUKOLI_PREFIX
if ([string]::IsNullOrWhiteSpace($prefix)) {
    $prefix = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
}
$prefix = $prefix.TrimEnd('\')
$appServer = Join-Path (Join-Path $prefix 'app') 'server'
$venvPy = Join-Path $prefix 'venv\Scripts\python.exe'
$logDir = Join-Path $prefix 'logs'
$logFile = Join-Path $logDir 'server.log'
$pidFile = Join-Path $prefix 'server.pid'

$port = 8000
if ($env:IC_PORT -and ($env:IC_PORT.Trim() -match '^\d+$')) { $port = [int]$env:IC_PORT.Trim() }
$url = 'http://127.0.0.1:{0}' -f $port
$timeout = 30
if ($env:VUKOLI_START_TIMEOUT -and ($env:VUKOLI_START_TIMEOUT -match '^\d+$')) { $timeout = [int]$env:VUKOLI_START_TIMEOUT }
$noBrowser = ($NoBrowser.IsPresent -or ($env:VUKOLI_NO_BROWSER -and $env:VUKOLI_NO_BROWSER -notmatch '^(0|false|no|off)$'))
$useTab = ($Browser.IsPresent -or ($env:VUKOLI_APP_WINDOW -and $env:VUKOLI_APP_WINDOW -match '^(0|false|no|off)$'))
# A hidden shortcut has no console, so problems are shown in a message box (not in CI / scripted runs)
$useDialog = (-not $noBrowser) -and (-not $env:CI)
# vukoli://start (the "Start Vukoli" button of the page an installed, closed app shows): start the server and open
# nothing, the window that asked is already there and reloads itself when the server answers
if ($Command -match '^vukoli:') { $Command = 'open'; $noBrowser = $true; $useDialog = -not $env:CI }

function Show-Problem([string]$Text) {
    Write-Host $Text
    if ($useDialog) {
        try {
            Add-Type -AssemblyName System.Windows.Forms
            [void][System.Windows.Forms.MessageBox]::Show($Text, 'Vukoli')
        } catch { $null = $_ }
    }
}

# 'vukoli' = the health answer comes from Vukoli; 'other' = something else listens on the port; 'free' = nothing there
function Get-PortState {
    try {
        $r = Invoke-WebRequest -Uri ($url + '/api/health') -UseBasicParsing -TimeoutSec 3
        $j = $r.Content | ConvertFrom-Json
        if ($j.ok -eq $true) { return 'vukoli' }
        return 'other'
    } catch {
        $c = New-Object System.Net.Sockets.TcpClient
        try {
            $iar = $c.BeginConnect('127.0.0.1', $port, $null, $null)
            if ($iar.AsyncWaitHandle.WaitOne(1000) -and $c.Connected) { return 'other' }
            return 'free'
        } catch { return 'free' }
        finally { $c.Close() }
    }
}

function Get-ListenerPid {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop | Select-Object -First 1
        if ($conn) { return [int]$conn.OwningProcess }
    } catch { $null = $_ }
    try {
        foreach ($line in (& netstat.exe -ano -p tcp)) {
            if ($line -match ('^\s*TCP\s+\S+:{0}\s+\S+\s+LISTENING\s+(\d+)\s*$' -f $port)) { return [int]$Matches[1] }
        }
    } catch { $null = $_ }
    return 0
}

function Stop-Tree([int]$ProcessId) {
    if ($ProcessId -le 0) { return }
    try {
        Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\taskkill.exe') -ArgumentList @('/PID', "$ProcessId", '/T', '/F') -WindowStyle Hidden -Wait
    } catch { $null = $_ }
}

# the cmd.exe wrapper we started last time is still running (the server may still be starting)
function Test-WrapperAlive([int]$WrapperPid) {
    if ($WrapperPid -le 0) { return $false }
    $proc = Get-Process -Id $WrapperPid -ErrorAction SilentlyContinue
    return [bool]($proc -and $proc.ProcessName -eq 'cmd')
}

function Wait-OwnStart {
    if (-not (Test-Path -LiteralPath $pidFile)) { return $false }
    $w = 0
    try { $w = [int](Get-Content -LiteralPath $pidFile -TotalCount 1) } catch { $w = 0 }
    if (-not (Test-WrapperAlive $w)) { return $false }
    $deadline = (Get-Date).AddSeconds($timeout)
    while ((Get-Date) -lt $deadline) {
        if ((Get-PortState) -eq 'vukoli') { return $true }
        if (-not (Test-WrapperAlive $w)) { return $false }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Stop-Server {
    $state = Get-PortState
    $stopped = $false
    # the wrapper we started last time (cmd -> python): killing the tree stops everything
    if (Test-Path -LiteralPath $pidFile) {
        $wrapper = 0
        try { $wrapper = [int](Get-Content -LiteralPath $pidFile -TotalCount 1) } catch { $wrapper = 0 }
        if (Test-WrapperAlive $wrapper) { Stop-Tree $wrapper; $stopped = $true }
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }
    if ($state -eq 'vukoli') {
        # still answering: stop whatever listens, but only if it looks like our server
        $owner = Get-ListenerPid
        if ($owner -gt 0) {
            $cmdline = ''
            try { $cmdline = (Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $owner)).CommandLine } catch { $cmdline = '' }
            if ($cmdline -match '-m\s+server' -or $cmdline -match 'uvicorn') { Stop-Tree $owner; $stopped = $true }
        }
    }
    for ($i = 0; $i -lt 20; $i++) {
        if ((Get-PortState) -ne 'vukoli') { break }
        Start-Sleep -Milliseconds 500
    }
    if ((Get-PortState) -eq 'vukoli') {
        Show-Problem ('Vukoli is still running on port {0} and could not be stopped. Close it from Task Manager (python.exe) or restart the computer.' -f $port)
        return 1
    }
    if ($stopped -or $state -eq 'vukoli') { Write-Host 'Vukoli stopped.' } else { Write-Host 'Vukoli was not running.' }
    return 0
}

# Edge first (every Windows 10/11 has it), then Chrome: App Paths registry entry, then the usual folders
function Find-Chromium {
    foreach ($exe in 'msedge.exe', 'chrome.exe') {
        foreach ($hive in 'HKLM', 'HKCU') {
            try {
                $reg = Get-ItemProperty -Path ('{0}:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{1}' -f $hive, $exe) -ErrorAction Stop
                $path = $reg.'(default)'
                if ($path -and (Test-Path -LiteralPath $path)) { return $path }
            } catch { $null = $_ }
        }
        $sub = if ($exe -eq 'msedge.exe') { 'Microsoft\Edge\Application' } else { 'Google\Chrome\Application' }
        foreach ($root in ${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA) {
            if (-not $root) { continue }
            $cand = Join-Path (Join-Path $root $sub) $exe
            if (Test-Path -LiteralPath $cand) { return $cand }
        }
    }
    return $null
}

# The shortcut Chrome / Edge made when Vukoli was installed as an app (own taskbar icon): a .lnk named Vukoli in the Start
# menu that runs the browser with --app-id. Our own Vukoli.lnk has no --app-id. Returns the .lnk path, or $null.
function Find-InstalledApp {
    $roots = @()
    foreach ($kind in 'Programs', 'CommonPrograms') {
        try { $roots += [Environment]::GetFolderPath($kind) } catch { $null = $_ }
    }
    foreach ($root in $roots) {
        if (-not $root -or -not (Test-Path -LiteralPath $root)) { continue }
        foreach ($f in (Get-ChildItem -LiteralPath $root -Filter 'Vukoli*.lnk' -Recurse -ErrorAction SilentlyContinue)) {
            try {
                $lnk = (New-Object -ComObject WScript.Shell).CreateShortcut($f.FullName)
                if ($lnk.Arguments -notmatch '--app-id=') { continue }
                # Edge also records the address; skip an app installed from another port
                if ($lnk.Arguments -match '--app-url=(\S+)' -and -not $Matches[1].Trim('"').StartsWith($url)) { continue }
                return $f.FullName
            } catch { $null = $_ }
        }
    }
    return $null
}

function Open-Browser {
    if ($noBrowser) { Write-Host ('Vukoli is running: {0}' -f $url); return }
    # Own window in the normal browser profile, so the microphone permission is remembered: the installed app first,
    # else Chromium app mode
    if (-not $useTab) {
        $installed = Find-InstalledApp
        if ($installed) {
            try { Start-Process -FilePath $installed; return } catch { $null = $_ }
        }
        $exe = Find-Chromium
        if ($exe) {
            try {
                Start-Process -FilePath $exe -ArgumentList @("--app=$url", '--window-size=1280,860')
                return
            } catch { $null = $_ }
        }
        Write-Host 'Vukoli works best in Chrome or Edge, which open it as its own window. Opening your default browser instead.'
    }
    try { Start-Process $url } catch { Write-Host ('Open this address in your browser: {0}' -f $url) }
}

function Start-Server {
    if (-not (Test-Path -LiteralPath $venvPy)) {
        Show-Problem ('Vukoli is not installed in {0}. Run the install command again (see the README).' -f $prefix)
        return 1
    }
    if (-not (Test-Path -LiteralPath $appServer)) {
        Show-Problem ('The app folder is missing: {0}. Run the install command again.' -f $appServer)
        return 1
    }
    if (-not (Test-Path -LiteralPath $logDir)) { $null = New-Item -ItemType Directory -Path $logDir -Force }
    try {
        if ((Test-Path -LiteralPath $logFile) -and ((Get-Item -LiteralPath $logFile).Length -gt 5MB)) {
            Move-Item -LiteralPath $logFile -Destination ($logFile + '.1') -Force
        }
    } catch { $null = $_ }

    # cmd /c with one redirect, so stdout and stderr both land in server.log (Start-Process cannot share one file for both)
    $env:PYTHONUNBUFFERED = '1'
    $env:PYTHONUTF8 = '1'
    $env:IC_PORT = "$port"
    $argLine = '/d /c ""{0}" -m server --port {1} >> "{2}" 2>&1"' -f $venvPy, $port, $logFile
    $p = Start-Process -FilePath $env:ComSpec -ArgumentList $argLine -WorkingDirectory $appServer -WindowStyle Hidden -PassThru
    try { Set-Content -LiteralPath $pidFile -Value $p.Id -Encoding ASCII } catch { $null = $_ }

    $deadline = (Get-Date).AddSeconds($timeout)
    while ((Get-Date) -lt $deadline) {
        if ((Get-PortState) -eq 'vukoli') { return 0 }
        if ($p.HasExited) { break }
        Start-Sleep -Milliseconds 500
    }
    $tail = ''
    try { $tail = (Get-Content -LiteralPath $logFile -Tail 12 -ErrorAction Stop) -join "`n" } catch { $tail = '' }
    if ($p.HasExited) {
        Show-Problem ("Vukoli could not start.`n`nLast lines of the log ({0}):`n{1}" -f $logFile, $tail)
    } else {
        Show-Problem ("Vukoli is still starting after {0} seconds. Wait a minute and open it again; if it keeps failing, look at the log:`n{1}" -f $timeout, $logFile)
    }
    return 1
}

$code = 0
switch -Regex ($Command.ToLower()) {
    '^(stop|quit|exit)$' { $code = Stop-Server; break }
    '^status$' {
        switch (Get-PortState) {
            'vukoli' { Write-Host ('Vukoli is running: {0}' -f $url) }
            'other' { Write-Host ('Port {0} is used by another program.' -f $port); $code = 2 }
            default { Write-Host 'Vukoli is not running.'; $code = 3 }
        }
        break
    }
    '^(open|start|run)$' {
        $state = Get-PortState
        if ($state -eq 'vukoli') { Open-Browser; break }
        if ($state -eq 'other' -and (Wait-OwnStart)) { Open-Browser; break }
        if ($state -eq 'other') {
            Show-Problem ("Port {0} is used by another program, not Vukoli.`n`nClose that program, or start Vukoli on another port: set IC_PORT (for example 8001) and run Vukoli again." -f $port)
            $code = 1
            break
        }
        $code = Start-Server
        if ($code -eq 0) { Open-Browser }
        break
    }
    default {
        Write-Host ('Unknown command "{0}". Use: Vukoli.cmd [open|stop|status] [-NoBrowser] [-Browser]' -f $Command)
        $code = 64
    }
}
exit $code
