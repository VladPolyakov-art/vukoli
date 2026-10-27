<#
.SYNOPSIS
Vukoli installer for Windows 10/11 (Windows PowerShell 5.1 or PowerShell 7). No administrator rights needed.

.DESCRIPTION
One command:   irm https://raw.githubusercontent.com/VladPolyakov-art/vukoli/main/install/install.ps1 | iex
Options via environment variables set before that line (for example  $env:VUKOLI_YES = 1 ),
or with parameters when the script is run as a file or as a scriptblock:
  & ([scriptblock]::Create((irm <url>))) -Yes -NoModels

  -From <zip-or-folder>   use a local archive or unpacked folder instead of downloading the release   (VUKOLI_FROM)
  -Yes                    accept the defaults, no questions (installs Ollama if missing)               (VUKOLI_YES=1)
  -NoOllama               do not install Ollama and do not pull language models                        (VUKOLI_NO_OLLAMA=1)
  -NoModels               skip speech models (Kokoro, Whisper) and Ollama model downloads              (VUKOLI_NO_MODELS=1)
  -NoLaunch               do not start the app / open its window at the end                           (VUKOLI_NO_LAUNCH=1)
  -Prefix <dir>           install location, default %LOCALAPPDATA%\Vukoli                              (VUKOLI_PREFIX)
  -Uninstall [-Purge]     remove the app, launchers and shortcuts; -Purge also deletes your data. Ollama is never removed.

This file is plain ASCII on purpose: Windows PowerShell 5.1 reads other encodings wrongly.
#>
param(
    [string]$From = '',
    [switch]$Yes,
    [switch]$NoOllama,
    [switch]$NoModels,
    [switch]$NoLaunch,
    [string]$Prefix = '',
    [switch]$Uninstall,
    [switch]$Purge,
    [switch]$Help
)

# Everything below runs in a child scope, so nothing leaks into the user's session when this is piped to iex.
$vkResult = @{ Code = 0 }
$vkOptions = @{
    From      = $From
    Yes       = [bool]$Yes.IsPresent
    NoOllama  = [bool]$NoOllama.IsPresent
    NoModels  = [bool]$NoModels.IsPresent
    NoLaunch  = [bool]$NoLaunch.IsPresent
    Prefix    = $Prefix
    Uninstall = [bool]$Uninstall.IsPresent
    Purge     = [bool]$Purge.IsPresent
    Help      = [bool]$Help.IsPresent
    Result    = $vkResult
}

$null = & {
    param($Opt)

    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'   # the Windows PowerShell 5.1 progress bar makes web calls extremely slow

    # ------------------------------------------------------------------ constants
    $REPO_URL = 'https://github.com/VladPolyakov-art/vukoli'
    $RELEASE_BASE = 'https://github.com/VladPolyakov-art/vukoli/releases/latest/download'
    $KOKORO_BASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0'
    $UV_INSTALL_URL = 'https://astral.sh/uv/install.ps1'
    $OLLAMA_SETUP_URL = 'https://ollama.com/download/OllamaSetup.exe'
    $TOTAL = 8

    # S = the one mutable state object (functions below read it from the enclosing scope and change its fields).
    $S = @{
        Step = 0; StepTitle = ''; ModelSeconds = 0.0; EnvBackup = @{}; DataDir = ''; Ollama = ''
        OllamaOk = $false; Models = @(); ChangedOllamaStartup = ''; NoRecord = $false
    }

    # ------------------------------------------------------------------ small helpers
    function Test-Truthy([string]$v) {
        if ([string]::IsNullOrEmpty($v)) { return $false }
        return ($v.Trim() -notmatch '^(0|false|no|off)$')
    }
    function Say([string]$m) { Write-Host $m }
    function Note([string]$m) { Write-Host ('      ' + $m) }
    function Warn([string]$m) { Write-Host ('      ! ' + $m) -ForegroundColor Yellow }
    function Format-Size([double]$b) {
        if ($b -lt 0) { return 'unknown size' }
        if ($b -ge 1GB) { return ('{0:N1} GB' -f ($b / 1GB)) }
        if ($b -ge 1MB) { return ('{0:N0} MB' -f ($b / 1MB)) }
        return ('{0:N0} KB' -f ($b / 1KB))
    }
    function Format-Duration([double]$sec) {
        $t = [int][math]::Round($sec)
        return ('{0}m {1:00}s' -f [int][math]::Floor($t / 60), ($t % 60))
    }
    function Fail([string]$Message, [string]$Hint) {
        $e = New-Object System.Exception($Message)
        $e.Data['hint'] = $Hint
        throw $e
    }
    function Resolve-FullPath([string]$p) {
        return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($p)
    }
    function Set-TempEnv([string]$Name, [string]$Value) {
        if (-not $S.EnvBackup.ContainsKey($Name)) {
            $S.EnvBackup[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process')
        }
        [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
    }
    function Restore-TempEnv {
        foreach ($k in @($S.EnvBackup.Keys)) {
            [Environment]::SetEnvironmentVariable($k, $S.EnvBackup[$k], 'Process')
        }
        $S.EnvBackup = @{}
    }
    function Write-TextFile([string]$Path, [string]$Text) {
        $dir = Split-Path -Parent $Path
        if (-not (Test-Path -LiteralPath $dir)) { $null = New-Item -ItemType Directory -Path $dir -Force }
        [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
    }
    function Join-NativeArgs([string[]]$ArgList) {
        # Windows PowerShell 5.1 does not quote Start-Process arguments, so do it here.
        $parts = @()
        foreach ($a in $ArgList) {
            if ($a -eq '' -or $a -match '[\s"]') { $parts += ('"' + ($a -replace '"', '\"') + '"') } else { $parts += $a }
        }
        return ($parts -join ' ')
    }
    function Invoke-Native([string]$Exe, [string[]]$ArgList) {
        # Runs a program in this console (so its own progress bars show) and returns its exit code.
        $p = Start-Process -FilePath $Exe -ArgumentList (Join-NativeArgs $ArgList) -NoNewWindow -PassThru
        $null = $p.Handle   # keeps the handle so ExitCode is available
        $p.WaitForExit()
        return [int]$p.ExitCode
    }
    function Invoke-NativeCapture([string]$Exe, [string[]]$ArgList) {
        # Runs a program and returns its stdout lines (stderr is dropped). Used for short queries only.
        $old = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $oldEnc = $null
        try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { $oldEnc = $null }
        try {
            $lines = & $Exe @ArgList 2>&1
            $out = @()
            foreach ($l in $lines) {
                if ($l -isnot [System.Management.Automation.ErrorRecord]) { $out += [string]$l }
            }
            return , $out
        }
        finally {
            $ErrorActionPreference = $old
            if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { $null = $_ } }
        }
    }
    function Get-HostExe {
        try { return (Get-Process -Id $PID).Path } catch { return (Join-Path $PSHOME 'powershell.exe') }
    }
    function Test-Interactive {
        # false when input/output is redirected (CI, piped stdin): then questions are answered with their defaults
        try { return (-not [Console]::IsInputRedirected) } catch { return $true }
    }
    function Confirm-Default([string]$Question) {
        if ($S.Yes) { return $true }
        if (-not (Test-Interactive)) { Note 'No terminal to ask on - using the default answer (yes).'; return $true }
        $a = Read-Host ('      ' + $Question + ' [Y/n]')
        return ([string]::IsNullOrWhiteSpace($a) -or $a.Trim().ToLower().StartsWith('y'))
    }
    function Get-Url200([string]$Url, [int]$TimeoutSec = 3) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
            return ([int]$r.StatusCode -eq 200)
        } catch { return $false }
    }

    # ------------------------------------------------------------------ network
    function Initialize-Network {
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        } catch { $null = $_ }
        try { [Net.WebRequest]::DefaultWebProxy.Credentials = [Net.CredentialCache]::DefaultCredentials } catch { $null = $_ }
    }
    function New-WebReq([string]$Url, [string]$Method) {
        $r = [System.Net.HttpWebRequest][System.Net.WebRequest]::Create($Url)
        $r.Method = $Method
        $r.UserAgent = 'Vukoli-Installer/1.0 (PowerShell)'
        $r.Timeout = 30000
        $r.ReadWriteTimeout = 60000
        $r.AllowAutoRedirect = $true
        return $r
    }
    function Get-RemoteSize([string]$Url) {
        try {
            $resp = (New-WebReq $Url 'HEAD').GetResponse()
            try { return [int64]$resp.ContentLength } finally { $resp.Close() }
        } catch { return [int64]-1 }
    }
    function Save-Url([string]$Url, [string]$Dest, [string]$Label) {
        $size = Get-RemoteSize $Url
        Note ('Downloading {0} ({1})' -f $Label, (Format-Size $size))
        $dir = Split-Path -Parent $Dest
        if (-not (Test-Path -LiteralPath $dir)) { $null = New-Item -ItemType Directory -Path $dir -Force }
        $part = $Dest + '.part'
        $redirected = $false
        try { $redirected = [Console]::IsOutputRedirected } catch { $redirected = $false }
        $lastErr = $null
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            if (Test-Path -LiteralPath $part) { Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue }
            try {
                $resp = (New-WebReq $Url 'GET').GetResponse()
                try {
                    if ($size -le 0) { $size = [int64]$resp.ContentLength }
                    $in = $resp.GetResponseStream()
                    $out = [System.IO.File]::Create($part)
                    try {
                        $buf = New-Object 'byte[]' 1048576
                        $done = [int64]0
                        $sw = [System.Diagnostics.Stopwatch]::StartNew()
                        $lastShown = -1.0
                        $lastPct = -10
                        while (($n = $in.Read($buf, 0, $buf.Length)) -gt 0) {
                            $out.Write($buf, 0, $n)
                            $done += $n
                            $el = $sw.Elapsed.TotalSeconds
                            if ($el - $lastShown -ge 1.0) {
                                $lastShown = $el
                                $speed = if ($el -gt 0) { $done / $el } else { 0 }
                                if ($size -gt 0) {
                                    $pct = [int][math]::Floor(100.0 * $done / $size)
                                    if (-not $redirected) {
                                        Write-Host ("`r      {0} / {1}  {2}%  {3}/s     " -f (Format-Size $done), (Format-Size $size), $pct, (Format-Size $speed)) -NoNewline
                                    } elseif ($pct -ge $lastPct + 10) {
                                        $lastPct = $pct - ($pct % 10)
                                        Note ('{0}%  ({1} / {2})' -f $pct, (Format-Size $done), (Format-Size $size))
                                    }
                                } elseif (-not $redirected) {
                                    Write-Host ("`r      {0}  {1}/s     " -f (Format-Size $done), (Format-Size $speed)) -NoNewline
                                }
                            }
                        }
                        if (-not $redirected) { Write-Host '' }
                    }
                    finally {
                        $out.Dispose()
                        $in.Dispose()
                    }
                }
                finally { $resp.Close() }
                $len = (Get-Item -LiteralPath $part).Length
                if ($size -gt 0 -and $len -ne $size) {
                    throw ('the download stopped early ({0} of {1})' -f (Format-Size $len), (Format-Size $size))
                }
                if (Test-Path -LiteralPath $Dest) { Remove-Item -LiteralPath $Dest -Force }
                Move-Item -LiteralPath $part -Destination $Dest -Force
                return
            }
            catch {
                $lastErr = $_.Exception.Message
                if (-not $redirected) { Write-Host '' }
                if ($attempt -lt 3) {
                    Warn ('Download failed ({0}). Trying again in {1} s...' -f $lastErr, (3 * $attempt))
                    Start-Sleep -Seconds (3 * $attempt)
                }
            }
        }
        Fail ('Could not download {0}: {1}' -f $Label, $lastErr) 'Check your internet connection (and any proxy or VPN), then run the same command again. Finished steps are skipped.'
    }
    function Get-Sha256([string]$Path) {
        return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLower()
    }

    # ------------------------------------------------------------------ install state (resume)
    function Get-DoneSteps {
        if (Test-Path -LiteralPath $S.StateFile) {
            return @(Get-Content -LiteralPath $S.StateFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
        }
        return @()
    }
    function Test-StepDone([string]$Key) { return ((Get-DoneSteps) -contains ($Key + '=done')) }
    function Set-StepDone([string]$Key) {
        Add-Content -LiteralPath $S.StateFile -Value ($Key + '=done') -Encoding ASCII
    }
    function Invoke-Step([int]$N, [string]$Title, [string]$Key, [scriptblock]$Body, [scriptblock]$StillValid) {
        $S.Step = $N
        $S.StepTitle = $Title
        Write-Host ''
        Write-Host ('[{0}/{1}] {2}' -f $N, $TOTAL, $Title) -ForegroundColor Cyan
        if ($Key -and (Test-StepDone $Key)) {
            $valid = $true
            if ($StillValid) { $valid = [bool](& $StillValid) }
            if ($valid) { Note 'Already done earlier - skipped (resuming).'; return }
        }
        $S.NoRecord = $false
        & $Body
        if ($Key -and -not $S.NoRecord) { Set-StepDone $Key }
    }

    # ------------------------------------------------------------------ locations
    function Initialize-Paths {
        $p = $Opt.Prefix
        if ([string]::IsNullOrWhiteSpace($p)) { $p = $env:VUKOLI_PREFIX }
        if ([string]::IsNullOrWhiteSpace($p)) { $p = Join-Path $env:LOCALAPPDATA 'Vukoli' }
        $p = (Resolve-FullPath $p).TrimEnd('\')
        $S.Prefix = $p
        $S.App = Join-Path $p 'app'
        $S.AppServer = Join-Path (Join-Path $p 'app') 'server'
        $S.Venv = Join-Path $p 'venv'
        $S.VenvPy = Join-Path (Join-Path $p 'venv') 'Scripts\python.exe'
        $S.UvDir = Join-Path $p 'uv'
        $S.Uv = Join-Path (Join-Path $p 'uv') 'uv.exe'
        $S.PyDir = Join-Path $p 'python'
        $S.Logs = Join-Path $p 'logs'
        $S.Tmp = Join-Path $p 'tmp'
        $S.Bin = Join-Path $p 'bin'
        $S.StateFile = Join-Path $p 'install-state'
        $S.Launcher = Join-Path (Join-Path (Join-Path (Join-Path $p 'app') 'install') 'windows') 'vukoli.ps1'
        $S.Icon = Join-Path $p 'Vukoli.ico'
        $S.UninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Vukoli'
        $S.UrlKey = 'HKCU:\Software\Classes\vukoli'
    }
    function Get-ShortcutPaths {
        $list = @()
        try { $list += (Join-Path ([Environment]::GetFolderPath('Programs')) 'Vukoli.lnk') } catch { $null = $_ }
        try { $list += (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Vukoli.lnk') } catch { $null = $_ }
        return $list
    }
    function Get-DataDir {
        if ($S.DataDir) { return $S.DataDir }
        if (-not (Test-Path -LiteralPath $S.VenvPy)) { return '' }
        $script = Join-Path $S.Tmp 'datadir.py'
        Write-TextFile $script "import sys`nsys.path.insert(0, sys.argv[1])`nfrom server import config`nprint(config.data_dir())`n"
        $lines = Invoke-NativeCapture $S.VenvPy @($script, $S.AppServer)
        $last = ''
        foreach ($l in $lines) { if ($l.Trim() -ne '') { $last = $l.Trim() } }
        if ($last) { $S.DataDir = $last }
        return $S.DataDir
    }
    function Get-FallbackDataDir {
        # where platformdirs puts it on Windows, used only when the venv is already gone
        if ($env:IC_DATA_DIR) { return (Resolve-FullPath $env:IC_DATA_DIR) }
        return (Join-Path $env:LOCALAPPDATA 'interview-coach')
    }
    function Stop-VukoliServer {
        if (Test-Path -LiteralPath $S.Launcher) {
            try { $null = Invoke-Native (Get-HostExe) @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $S.Launcher, 'stop') } catch { $null = $_ }
        }
    }

    # ------------------------------------------------------------------ step 1: preflight
    function Step-Preflight {
        if ($PSVersionTable.PSVersion.Major -lt 5) {
            Fail ('PowerShell {0} is too old.' -f $PSVersionTable.PSVersion) 'Use Windows 10 or 11 (they include PowerShell 5.1), or install PowerShell 7 from https://aka.ms/powershell and run the command there.'
        }
        if ($ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') {
            Fail 'PowerShell is in a restricted mode (Constrained Language), so the installer cannot run.' 'This usually comes from a company policy. Ask your IT team, or install on a personal computer.'
        }
        $osVer = [Environment]::OSVersion.Version
        if ($osVer.Major -lt 10) {
            Warn ('Windows {0} is older than Windows 10; Vukoli is tested on Windows 10 and 11 only.' -f $osVer)
        }
        $caption = 'Windows'
        $ramGb = 0.0
        try { $caption = (Get-CimInstance Win32_OperatingSystem).Caption } catch { $null = $_ }
        try { $ramGb = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB } catch { $null = $_ }
        $arch = $env:PROCESSOR_ARCHITECTURE
        if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
        Note ('System:  {0} ({1}), PowerShell {2}' -f $caption, $arch, $PSVersionTable.PSVersion)
        if ($arch -ne 'AMD64' -and $arch -ne 'ARM64') {
            Fail ('This processor type ({0}) is not supported.' -f $arch) 'Vukoli needs a 64-bit Windows (x64 or ARM64).'
        }
        if ($arch -eq 'ARM64') { Warn 'Windows on ARM: some speech components may be missing for this processor. The app still works with typed answers.' }
        if ($ramGb -gt 0) {
            Note ('Memory:  {0:N1} GB RAM' -f $ramGb)
            if ($ramGb -lt 8) { Warn 'Less than 8 GB of RAM: the local language model will be slow. You can connect a cloud engine in the wizard instead.' }
        }

        # AC7: say up front what needs which rights
        Note 'Rights:  no administrator rights needed. Everything is installed for your user account only.'
        try {
            $id = [Security.Principal.WindowsIdentity]::GetCurrent()
            if ((New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
                Note '         (You are running as administrator; that is not needed. Files are still placed in your own profile.)'
            }
        } catch { $null = $_ }

        # prefix must be writable
        try {
            foreach ($d in @($S.Prefix, $S.Logs, $S.Tmp)) {
                if (-not (Test-Path -LiteralPath $d)) { $null = New-Item -ItemType Directory -Path $d -Force }
            }
            $probe = Join-Path $S.Prefix ('.write-test-' + $PID)
            [System.IO.File]::WriteAllText($probe, 'ok')
            Remove-Item -LiteralPath $probe -Force
        } catch {
            Fail ('Cannot write to {0}: {1}' -f $S.Prefix, $_.Exception.Message) 'Choose another folder with -Prefix (for example -Prefix C:\Users\<you>\Vukoli) or check that the drive is not read-only.'
        }

        # disk estimate (AC4: show it before downloading)
        $needGb = 1.5
        $parts = @('app + Python ~1.5 GB')
        if (-not $S.NoModels) { $needGb += 1.0; $parts += 'speech models ~1 GB' }
        if (-not $S.NoOllama) {
            $small = 2.5
            if ($ramGb -ge 15.5) { $small = 5.2 }
            $needGb += $small
            $parts += ('Ollama language model ~{0:N1} GB' -f $small)
            if (-not (Find-Ollama)) { $needGb += 1.7; $parts += 'Ollama itself ~1.7 GB' }
        }
        Note ('Needs:   about {0:N1} GB ({1})' -f $needGb, ($parts -join ', '))
        try {
            $root = [System.IO.Path]::GetPathRoot($S.Prefix)
            $freeGb = (New-Object System.IO.DriveInfo($root)).AvailableFreeSpace / 1GB
            Note ('Free:    {0:N1} GB on {1}' -f $freeGb, $root)
            if ($freeGb -lt $needGb) {
                Fail ('Not enough free disk space on {0}: {1:N1} GB free, about {2:N1} GB needed.' -f $root, $freeGb, $needGb) 'Free up some space (Settings > System > Storage), or install to another drive with -Prefix D:\Vukoli, or use -NoOllama / -NoModels to skip the big downloads.'
            }
        } catch [System.IO.IOException] {
            Note 'Free:    could not read free space for this location; continuing.'
        } catch [System.ArgumentException] {
            Note 'Free:    could not read free space for this location; continuing.'
        }

        # network
        $hosts = @('https://pypi.org/')
        if (-not $S.From) { $hosts += 'https://github.com/' }
        foreach ($h in $hosts) {
            if (-not (Get-Url200 $h 10)) {
                # a redirect or a 403 from a proxy is still "reachable"; only a connection failure matters
                $ok = $false
                try { $r = (New-WebReq $h 'HEAD').GetResponse(); $r.Close(); $ok = $true } catch [System.Net.WebException] { $ok = ($null -ne $_.Exception.Response) } catch { $ok = $false }
                if (-not $ok) {
                    Fail ('No connection to {0}' -f $h) 'Check your internet connection (and any proxy or VPN), then run the same command again.'
                }
            }
        }
        Note 'Network: OK'
    }
    function Find-Ollama {
        $c = Get-Command ollama -ErrorAction SilentlyContinue
        if ($c -and $c.Source) { return $c.Source }
        foreach ($p in @((Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'), (Join-Path $env:ProgramFiles 'Ollama\ollama.exe'))) {
            if ($p -and (Test-Path -LiteralPath $p)) { return $p }
        }
        return ''
    }

    # ------------------------------------------------------------------ step 2: the app
    function Step-App {
        $zip = ''
        $srcDir = ''
        if ($S.From) {
            $f = Resolve-FullPath $S.From
            if (-not (Test-Path -LiteralPath $f)) { Fail ('-From path not found: {0}' -f $f) 'Pass the path of vukoli.zip (or the unpacked folder) that you downloaded.' }
            if ((Get-Item -LiteralPath $f).PSIsContainer) { $srcDir = $f } else { $zip = $f }
            Note ('Using local copy: {0}' -f $f)
        } else {
            $base = $RELEASE_BASE
            if ($env:VUKOLI_RELEASE_URL) { $base = $env:VUKOLI_RELEASE_URL.TrimEnd('/') }
            $zip = Join-Path $S.Tmp 'vukoli.zip'
            Save-Url ($base + '/vukoli.zip') $zip 'Vukoli app (vukoli.zip)'
            $sums = Join-Path $S.Tmp 'SHA256SUMS'
            Save-Url ($base + '/SHA256SUMS') $sums 'checksums (SHA256SUMS)'
            $expected = ''
            foreach ($line in (Get-Content -LiteralPath $sums)) {
                if ($line -match '^\s*([0-9a-fA-F]{64})\s+\*?(\S+)\s*$' -and $Matches[2] -eq 'vukoli.zip') { $expected = $Matches[1].ToLower() }
            }
            if (-not $expected) { Fail 'SHA256SUMS has no entry for vukoli.zip, so the download cannot be verified.' ('Try again in a few minutes. If it keeps failing, report it at ' + $REPO_URL + '/issues') }
            $actual = Get-Sha256 $zip
            if ($actual -ne $expected) {
                Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
                Fail 'The downloaded file does not match its checksum (corrupted or tampered download). It was deleted.' 'Run the same command again. If it fails again, report it at the project page.'
            }
            Note 'Checksum OK (SHA-256).'
        }

        $root = ''
        if ($zip) {
            $ex = Join-Path $S.Tmp 'extract'
            if (Test-Path -LiteralPath $ex) { Remove-Item -LiteralPath $ex -Recurse -Force }
            Note 'Unpacking...'
            try {
                Add-Type -AssemblyName System.IO.Compression.FileSystem
                [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $ex)
            } catch {
                if (Test-Path -LiteralPath $ex) { Remove-Item -LiteralPath $ex -Recurse -Force -ErrorAction SilentlyContinue }
                try { Expand-Archive -LiteralPath $zip -DestinationPath $ex -Force }
                catch { Fail ('Could not unpack the archive: {0}' -f $_.Exception.Message) 'The file may be damaged. Download it again (delete the file and re-run).' }
            }
            $root = $ex
        } else {
            $root = $srcDir
        }
        if (-not (Test-Path -LiteralPath (Join-Path $root 'server'))) {
            $kids = @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)
            $hit = @($kids | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'server') })
            if ($hit.Count -ge 1) { $root = $hit[0].FullName }
        }
        foreach ($need in @('server\requirements.txt', 'web\dist\index.html', 'install')) {
            if (-not (Test-Path -LiteralPath (Join-Path $root $need))) {
                Fail ('This does not look like a Vukoli release (missing {0}).' -f $need) 'Use vukoli.zip from the Releases page, or run the install command without -From.'
            }
        }

        # replace the app, keep user data (it lives outside the prefix)
        Stop-VukoliServer
        if (Test-Path -LiteralPath $S.App) {
            Note 'Replacing the previous version (your data is kept)...'
            $old = $S.App + '.old'
            if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue }
            $moved = $false
            for ($i = 1; $i -le 6 -and -not $moved; $i++) {
                try { Move-Item -LiteralPath $S.App -Destination $old -Force; $moved = $true }
                catch { Start-Sleep -Seconds 2 }
            }
            if (-not $moved) { Fail 'The old version is in use and could not be replaced.' 'Close Vukoli (and any window that shows its folder), then run the same command again.' }
            Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ($srcDir) {
            $null = New-Item -ItemType Directory -Path $S.App -Force
            Copy-Item -Path (Join-Path $root '*') -Destination $S.App -Recurse -Force
        } else {
            Move-Item -LiteralPath $root -Destination $S.App
        }
        if (Test-Path -LiteralPath (Join-Path $S.Tmp 'extract')) { Remove-Item -LiteralPath (Join-Path $S.Tmp 'extract') -Recurse -Force -ErrorAction SilentlyContinue }
        $ver = ''
        $vf = Join-Path $S.App 'VERSION'
        if (Test-Path -LiteralPath $vf) { $ver = (Get-Content -LiteralPath $vf -TotalCount 1).Trim() }
        $S.Version = $ver
        Note ('App {0} is in {1}' -f $(if ($ver) { $ver } else { '(version unknown)' }), $S.App)
    }

    # ------------------------------------------------------------------ step 3: Python
    function Step-Python {
        foreach ($d in @($S.UvDir, $S.PyDir, $S.Logs)) {
            if (-not (Test-Path -LiteralPath $d)) { $null = New-Item -ItemType Directory -Path $d -Force }
        }
        $cache = $env:UV_CACHE_DIR
        if ([string]::IsNullOrWhiteSpace($cache)) { $cache = Join-Path $S.Prefix 'cache' }
        Set-TempEnv 'UV_PYTHON_INSTALL_DIR' $S.PyDir
        Set-TempEnv 'UV_CACHE_DIR' $cache
        Set-TempEnv 'UV_PYTHON_PREFERENCE' 'only-managed'
        Set-TempEnv 'UV_NO_MODIFY_PATH' '1'
        Set-TempEnv 'UV_INSTALL_DIR' $S.UvDir
        Set-TempEnv 'UV_DISABLE_UPDATE' '1'
        try {
            if (-not (Test-Path -LiteralPath $S.Uv)) {
                Note 'Installing uv (a small Python manager from astral.sh) into the Vukoli folder...'
                $uvScript = Join-Path $S.Tmp 'uv-install.ps1'
                Save-Url $UV_INSTALL_URL $uvScript 'uv installer script'
                $rc = Invoke-Native (Get-HostExe) @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $uvScript)
                if ($rc -ne 0 -or -not (Test-Path -LiteralPath $S.Uv)) {
                    Fail 'The uv installer did not finish.' 'Check the messages above. A firewall or antivirus may block astral.sh / github.com; allow them and run the same command again.'
                }
            } else {
                Note 'uv already installed.'
            }

            if (-not (Test-Path -LiteralPath $S.VenvPy)) {
                Note 'Creating the Python 3.12 environment (downloads Python ~30 MB the first time)...'
                $venvArgs = @('venv', '--python', '3.12')
                if (Test-Path -LiteralPath $S.Venv) { $venvArgs += '--clear' }
                $venvArgs += $S.Venv
                $rc = Invoke-Native $S.Uv $venvArgs
                if ($rc -ne 0 -or -not (Test-Path -LiteralPath $S.VenvPy)) {
                    Fail 'Could not create the Python environment.' 'Check the messages above (network, disk space, antivirus), then run the same command again.'
                }
            } else {
                Note 'Python environment already exists.'
            }

            $req = Join-Path $S.AppServer 'requirements.txt'
            Note 'Installing the app dependencies (about 1 GB; this is the longest part)...'
            $rc = Invoke-Native $S.Uv @('pip', 'install', '--python', $S.VenvPy, '-r', $req)
            if ($rc -ne 0) {
                Fail 'Installing the app dependencies failed.' 'Check the messages above (network, disk space), then run the same command again; downloaded packages are reused.'
            }
        }
        finally { Restore-TempEnv }
    }

    # ------------------------------------------------------------------ step 4: speech models
    function Step-Models {
        if ($S.NoModels) { $S.NoRecord = $true; Note 'Skipped (-NoModels). Text answers work; speech models can be added later.'; return }
        $data = Get-DataDir
        if (-not $data) { Fail 'Could not find the data folder of the app.' ('Look at ' + (Join-Path $S.Logs 'install.log') + ' and run the same command again.') }
        Note ('Your data folder: {0}' -f $data)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $kdir = Join-Path (Join-Path $data 'models') 'kokoro'
            foreach ($f in @('kokoro-v1.0.onnx', 'voices-v1.0.bin')) {
                $dest = Join-Path $kdir $f
                if ((Test-Path -LiteralPath $dest) -and ((Get-Item -LiteralPath $dest).Length -gt 1MB)) {
                    Note ('{0} already downloaded.' -f $f)
                } else {
                    Save-Url ($KOKORO_BASE + '/' + $f) $dest ('speech voice file ' + $f)
                }
            }
            $script = Join-Path $S.Tmp 'whisper.py'
            Write-TextFile $script ("import sys`nsys.path.insert(0, sys.argv[1])`nfrom server.stt import default_model`nfrom faster_whisper.utils import download_model`n" +
                "name = default_model('faster_whisper')`nprint('Speech recognition model (Whisper):', name, flush=True)`npath = download_model(name)`nprint('Ready:', path, flush=True)`n")
            Note 'Downloading the speech recognition model (Whisper, a few hundred MB)...'
            Set-TempEnv 'HF_HUB_DISABLE_SYMLINKS_WARNING' '1'
            Set-TempEnv 'PYTHONUTF8' '1'
            try {
                $rc = Invoke-Native $S.VenvPy @('-u', $script, $S.AppServer)
            }
            finally { Restore-TempEnv }
            if ($rc -ne 0) {
                Fail 'The speech recognition model could not be downloaded.' 'Check your connection and free disk space, then run the same command again. The app also works without it (typed answers).'
            }
        }
        finally {
            $S.ModelSeconds += $sw.Elapsed.TotalSeconds
        }
    }

    # ------------------------------------------------------------------ step 5: Ollama
    function Wait-OllamaApi([int]$Seconds) {
        $end = (Get-Date).AddSeconds($Seconds)
        while ((Get-Date) -lt $end) {
            if (Get-Url200 'http://127.0.0.1:11434' 2) { return $true }
            Start-Sleep -Seconds 2
        }
        return $false
    }
    function Start-OllamaApp([string]$OllamaExe) {
        $dir = Split-Path -Parent $OllamaExe
        $appExe = Join-Path $dir 'ollama app.exe'
        if (Test-Path -LiteralPath $appExe) {
            Start-Process -FilePath $appExe -WorkingDirectory $dir -WindowStyle Hidden
        } else {
            Start-Process -FilePath $OllamaExe -ArgumentList 'serve' -WindowStyle Hidden
        }
    }
    function Enable-OllamaStartup([string]$OllamaExe) {
        # AC3: Ollama starts with Windows; one line says so and how to turn it off.
        $startupDir = [Environment]::GetFolderPath('Startup')
        $has = $false
        if ($startupDir -and (Test-Path -LiteralPath $startupDir)) {
            $has = [bool](Get-ChildItem -LiteralPath $startupDir -Filter '*llama*.lnk' -ErrorAction SilentlyContinue)
        }
        if (-not $has) {
            try {
                $run = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue
                if ($run -and ($run.PSObject.Properties | Where-Object { $_.Name -like '*llama*' })) { $has = $true }
            } catch { $null = $_ }
        }
        if (-not $has) {
            $dir = Split-Path -Parent $OllamaExe
            $target = Join-Path $dir 'ollama app.exe'
            if (-not (Test-Path -LiteralPath $target)) { $target = $OllamaExe }
            try {
                $sh = New-Object -ComObject WScript.Shell
                $lnk = $sh.CreateShortcut((Join-Path $startupDir 'Ollama.lnk'))
                $lnk.TargetPath = $target
                $lnk.WorkingDirectory = $dir
                $lnk.WindowStyle = 7
                $lnk.Description = 'Ollama (added by the Vukoli installer)'
                $lnk.Save()
                $S.ChangedOllamaStartup = 'added a shortcut to the Startup folder'
            } catch {
                Warn ('Could not add Ollama to Windows startup: {0}' -f $_.Exception.Message)
                return
            }
        }
        Note 'Ollama now starts with Windows. To turn that off: Settings > Apps > Startup > Ollama.'
    }
    function Step-Ollama {
        if ($S.NoOllama) { Note 'Skipped (-NoOllama). The wizard will let you connect another engine.'; return }
        $exe = Find-Ollama
        if ($exe) {
            Note ('Ollama found: {0} (reusing it).' -f $exe)
        } else {
            Note 'Ollama is not installed. It runs the language model on your computer (free, no account).'
            if (-not (Confirm-Default 'Install Ollama now from ollama.com (about 1.7 GB, no admin rights)?')) {
                Note 'Not installing Ollama. You can connect another service in the first-run wizard, or install Ollama later from https://ollama.com/download'
                return
            }
            $setup = Join-Path $S.Tmp 'OllamaSetup.exe'
            Save-Url $OLLAMA_SETUP_URL $setup 'Ollama installer (OllamaSetup.exe, official)'
            try {
                $sig = Get-AuthenticodeSignature -LiteralPath $setup
                if ($sig.Status -ne 'Valid') { Warn ('The Ollama installer signature status is: {0}. Continuing, because it came from ollama.com over HTTPS.' -f $sig.Status) }
                else { Note ('Installer signed by: {0}' -f $sig.SignerCertificate.Subject) }
            } catch { $null = $_ }
            Note 'Running the Ollama installer silently (for your user only)...'
            $p = Start-Process -FilePath $setup -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-' -PassThru
            $null = $p.Handle
            $p.WaitForExit()
            Remove-Item -LiteralPath $setup -Force -ErrorAction SilentlyContinue
            if ($p.ExitCode -ne 0) {
                Fail ('The Ollama installer stopped with code {0}.' -f $p.ExitCode) 'Install Ollama yourself from https://ollama.com/download, then run the same command again. Or use -NoOllama to continue without it.'
            }
            $exe = Find-Ollama
            if (-not $exe) { Fail 'Ollama was installed but ollama.exe was not found.' 'Open a new PowerShell window and run the same command again.' }
            Note ('Ollama installed: {0}' -f $exe)
        }
        $S.Ollama = $exe
        if (-not (Get-Url200 'http://127.0.0.1:11434' 2)) {
            Note 'Starting Ollama...'
            Start-OllamaApp $exe
        }
        if (-not (Wait-OllamaApi 60)) {
            Fail 'Ollama did not start (no answer on http://127.0.0.1:11434 after 60 s).' 'Open Ollama from the Start menu, wait until it is running, then run the same command again.'
        }
        $S.OllamaOk = $true
        Note 'Ollama is running.'
        Enable-OllamaStartup $exe
    }

    # ------------------------------------------------------------------ step 6: language models
    function Get-RecommendedModel {
        $name = 'qwen3:4b-instruct'
        try {
            $script = Join-Path $S.Tmp 'recommended.py'
            Write-TextFile $script "import sys`nsys.path.insert(0, sys.argv[1])`nfrom server.engines.ollama import recommended_model`nprint(recommended_model())`n"
            $lines = Invoke-NativeCapture $S.VenvPy @($script, $S.AppServer)
            $last = ''
            foreach ($l in $lines) { if ($l.Trim() -ne '') { $last = $l.Trim() } }
            if ($last -match '^[A-Za-z0-9._:/-]+$') { return $last }
        } catch { $null = $_ }
        try {
            if ((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB -ge 15.5) { $name = 'qwen3:8b' }
        } catch { $null = $_ }
        return $name
    }
    function Step-Pull {
        $S.NoRecord = $true
        if ($S.NoOllama) { Note 'Skipped (-NoOllama).'; return }
        if ($S.NoModels) { Note 'Skipped (-NoModels).'; return }
        if (-not $S.OllamaOk) { Note 'Skipped: Ollama is not set up (you can pick another engine in the wizard).'; return }
        $rec = Get-RecommendedModel
        $want = @('qwen3:4b-instruct')
        if ($rec -ne 'qwen3:4b-instruct') { $want += $rec }
        $sizes = @{ 'qwen3:4b-instruct' = '~2.5 GB'; 'qwen3:8b' = '~5.2 GB' }
        Note ('Recommended for this computer: {0}. Voice sessions use qwen3:4b-instruct.' -f $rec)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $installed = Invoke-NativeCapture $S.Ollama @('list')
            foreach ($m in $want) {
                $have = @($installed | Where-Object { $_ -match ('^' + [regex]::Escape($m) + '\s') })
                if ($have.Count -gt 0) { Note ('{0} is already downloaded.' -f $m); continue }
                $sz = 'size varies'
                if ($sizes.ContainsKey($m)) { $sz = $sizes[$m] }
                Note ('Downloading {0} ({1}) with Ollama...' -f $m, $sz)
                $rc = Invoke-Native $S.Ollama @('pull', $m)
                if ($rc -ne 0) {
                    Fail ('Ollama could not download {0}.' -f $m) ('Check your connection and free disk space, then run the same command again, or run:  "' + $S.Ollama + '" pull ' + $m)
                }
            }
            $S.NoRecord = $false
        }
        finally { $S.ModelSeconds += $sw.Elapsed.TotalSeconds }
    }

    # ------------------------------------------------------------------ step 7: launchers
    function New-Shortcut([string]$LnkPath, [string]$Description) {
        $dir = Split-Path -Parent $LnkPath
        if (-not (Test-Path -LiteralPath $dir)) { $null = New-Item -ItemType Directory -Path $dir -Force }
        $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $sh = New-Object -ComObject WScript.Shell
        $lnk = $sh.CreateShortcut($LnkPath)
        $lnk.TargetPath = $ps
        $lnk.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $S.Launcher + '"'
        $lnk.WorkingDirectory = $S.Prefix
        $lnk.WindowStyle = 7
        $lnk.Description = $Description
        if (Test-Path -LiteralPath $S.Icon) { $lnk.IconLocation = $S.Icon + ',0' }
        $lnk.Save()
    }
    function Step-Launchers {
        if (-not (Test-Path -LiteralPath $S.Launcher)) {
            Fail 'The launcher script is missing from the app folder.' 'The archive may be incomplete. Run the install command again without -From, or rebuild the zip.'
        }
        # the icon lives in the install folder (not in app\), so it stays when the app folder is replaced on upgrade
        $iconSrc = Join-Path (Split-Path -Parent $S.Launcher) 'Vukoli.ico'
        try { if (Test-Path -LiteralPath $iconSrc) { Copy-Item -LiteralPath $iconSrc -Destination $S.Icon -Force } }
        catch { Warn ('Could not copy the app icon: {0}' -f $_.Exception.Message) }
        $made = @()
        foreach ($lnk in (Get-ShortcutPaths)) {
            try { New-Shortcut $lnk 'Vukoli - practise interviews with an AI interviewer'; $made += $lnk }
            catch { Warn ('Could not create the shortcut {0}: {1}' -f $lnk, $_.Exception.Message) }
        }
        foreach ($m in $made) { Note ('Shortcut: {0}' -f $m) }

        # a short command: <prefix>\bin\Vukoli.cmd
        if (-not (Test-Path -LiteralPath $S.Bin)) { $null = New-Item -ItemType Directory -Path $S.Bin -Force }
        $cmdBody = "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"" + $S.Launcher + "`" %*`r`nexit /b %ERRORLEVEL%`r`n"
        [System.IO.File]::WriteAllText((Join-Path $S.Bin 'Vukoli.cmd'), $cmdBody, [System.Text.Encoding]::ASCII)
        Note ('Command: {0}\Vukoli.cmd   (Vukoli.cmd stop  stops the app)' -f $S.Bin)

        # vukoli://start: the "Start Vukoli" button on the page an installed, closed app shows. Starts the server and opens
        # nothing (the window that asked is already open). Current user only, no admin.
        try {
            $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
            $cmdKey = $S.UrlKey + '\shell\open\command'
            $null = New-Item -Path $cmdKey -Force
            Set-ItemProperty -Path $S.UrlKey -Name '(default)' -Value 'URL:Vukoli'
            Set-ItemProperty -Path $S.UrlKey -Name 'URL Protocol' -Value ''
            Set-ItemProperty -Path $cmdKey -Name '(default)' -Value ('"' + $ps + '" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $S.Launcher + '" "%1"')
            Note 'Link vukoli://start registered (lets a closed Vukoli window start the app).'
        } catch { Warn ('Could not register the vukoli:// link: {0}' -f $_.Exception.Message) }

        # Apps & features entry (current user only, no admin)
        try {
            $installScript = Join-Path (Join-Path $S.App 'install') 'install.ps1'
            $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
            $key = $S.UninstallKey
            if (-not (Test-Path -LiteralPath $key)) { $null = New-Item -Path $key -Force }
            $ver = $S.Version
            if (-not $ver) { $ver = '0' }
            Set-ItemProperty -Path $key -Name 'DisplayName' -Value 'Vukoli'
            Set-ItemProperty -Path $key -Name 'DisplayVersion' -Value $ver
            Set-ItemProperty -Path $key -Name 'Publisher' -Value 'Vukoli'
            Set-ItemProperty -Path $key -Name 'InstallLocation' -Value $S.Prefix
            if (Test-Path -LiteralPath $S.Icon) { Set-ItemProperty -Path $key -Name 'DisplayIcon' -Value $S.Icon }
            Set-ItemProperty -Path $key -Name 'UninstallString' -Value ('"' + $ps + '" -NoProfile -ExecutionPolicy Bypass -File "' + $installScript + '" -Uninstall -Prefix "' + $S.Prefix + '"')
            Set-ItemProperty -Path $key -Name 'NoModify' -Value 1 -Type DWord
            Set-ItemProperty -Path $key -Name 'NoRepair' -Value 1 -Type DWord
            Note 'Uninstall entry added to Settings > Apps (removes the app, keeps your data).'
        } catch { Warn ('Could not add the uninstall entry: {0}' -f $_.Exception.Message) }
    }

    # ------------------------------------------------------------------ step 8: start
    function Step-Launch {
        if ($S.NoLaunch) {
            Note 'Not starting the app (-NoLaunch).'
            Note ('Start it from the Start menu (Vukoli) or run: {0}\Vukoli.cmd' -f $S.Bin)
            return
        }
        $rc = Invoke-Native (Get-HostExe) @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $S.Launcher)
        if ($rc -ne 0) {
            Fail 'The app did not start.' ('Look at ' + (Join-Path $S.Logs 'server.log') + ' and run the same command again. Or start it from the Start menu.')
        }
    }

    # ------------------------------------------------------------------ uninstall
    function Invoke-Uninstall {
        Initialize-Paths
        Write-Host ''
        Write-Host 'Vukoli uninstall' -ForegroundColor Cyan
        $safe = (Test-Path -LiteralPath $S.StateFile) -or (Test-Path -LiteralPath $S.App) -or (Test-Path -LiteralPath $S.VenvPy)
        $root = [System.IO.Path]::GetPathRoot($S.Prefix)
        if ($S.Prefix.TrimEnd('\') -eq $root.TrimEnd('\') -or $S.Prefix -eq $env:USERPROFILE -or $S.Prefix -eq $env:LOCALAPPDATA) {
            Fail ('Refusing to remove {0}: it is not a Vukoli folder.' -f $S.Prefix) 'Pass the real install folder with -Prefix.'
        }
        if (-not $safe) {
            Note ('Nothing to remove: {0} does not look like a Vukoli install.' -f $S.Prefix)
            return
        }
        Push-Location -LiteralPath $env:SystemRoot    # so no folder we delete is the current directory
        try {
        $dataDir = ''
        if (Test-Path -LiteralPath $S.VenvPy) {
            try { $dataDir = Get-DataDir } catch { $dataDir = '' }
        }
        if (-not $dataDir) { $dataDir = Get-FallbackDataDir }

        Note 'Stopping the app...'
        Stop-VukoliServer

        foreach ($lnk in (Get-ShortcutPaths)) {
            if (Test-Path -LiteralPath $lnk) {
                $mine = $true
                try {
                    $sh = New-Object -ComObject WScript.Shell
                    $mine = (($sh.CreateShortcut($lnk).Arguments) -like ('*' + $S.Prefix + '*'))
                } catch { $mine = $true }
                if ($mine) { Remove-Item -LiteralPath $lnk -Force -ErrorAction SilentlyContinue; Note ('Removed shortcut {0}' -f $lnk) }
            }
        }
        if (Test-Path -LiteralPath $S.UrlKey) {
            $cmd = (Get-ItemProperty -Path ($S.UrlKey + '\shell\open\command') -ErrorAction SilentlyContinue).'(default)'
            if (-not $cmd -or $cmd -like ('*' + $S.Prefix + '*')) { Remove-Item -Path $S.UrlKey -Recurse -Force -ErrorAction SilentlyContinue }
        }
        if (Test-Path -LiteralPath $S.UninstallKey) {
            $loc = (Get-ItemProperty -Path $S.UninstallKey -ErrorAction SilentlyContinue).InstallLocation
            if (-not $loc -or ($loc.TrimEnd('\') -eq $S.Prefix)) { Remove-Item -Path $S.UninstallKey -Recurse -Force -ErrorAction SilentlyContinue }
        }

        $removed = $false
        for ($i = 1; $i -le 5 -and -not $removed; $i++) {
            try {
                if (Test-Path -LiteralPath $S.Prefix) { Remove-Item -LiteralPath $S.Prefix -Recurse -Force }
                $removed = $true
            } catch { Start-Sleep -Seconds 2 }
        }
        if (-not $removed) {
            Fail ('Could not remove everything in {0} (some file is in use).' -f $S.Prefix) 'Close Vukoli and any window showing that folder, then run the uninstall command again.'
        }
        Note ('Removed {0}' -f $S.Prefix)

        if ($Opt.Purge) {
            if ($dataDir -and (Test-Path -LiteralPath $dataDir)) {
                Remove-Item -LiteralPath $dataDir -Recurse -Force -ErrorAction SilentlyContinue
                Note ('Deleted your data: {0}' -f $dataDir)
            } else {
                Note 'No user data folder found.'
            }
        } else {
            Note ('Your data was kept: {0}   (add -Purge to delete it)' -f $dataDir)
        }
        Write-Host ''
        Note 'Ollama and its models were not touched. To remove Ollama: Settings > Apps > Installed apps > Ollama > Uninstall.'
        Note 'Downloaded Whisper files (if any) stay in %USERPROFILE%\.cache\huggingface and can be deleted by hand.'
        Write-Host 'Done.' -ForegroundColor Green
        }
        finally { Pop-Location }
    }

    # ------------------------------------------------------------------ main
    if ($Opt.Help) {
        Write-Host 'Vukoli installer for Windows'
        Write-Host '  Options (parameter / environment variable):'
        Write-Host '    -From <zip-or-folder>  VUKOLI_FROM        use a local archive instead of downloading'
        Write-Host '    -Yes                   VUKOLI_YES=1       no questions (installs Ollama if missing)'
        Write-Host '    -NoOllama              VUKOLI_NO_OLLAMA=1 do not install Ollama / pull models'
        Write-Host '    -NoModels              VUKOLI_NO_MODELS=1 skip speech models and model downloads'
        Write-Host '    -NoLaunch              VUKOLI_NO_LAUNCH=1 do not start the app at the end'
        Write-Host '    -Prefix <dir>          VUKOLI_PREFIX      install folder (default %LOCALAPPDATA%\Vukoli)'
        Write-Host '    -Uninstall [-Purge]                       remove the app (and with -Purge your data)'
        return
    }

    $S.Yes = ($Opt.Yes -or (Test-Truthy $env:VUKOLI_YES))
    $S.NoOllama = ($Opt.NoOllama -or (Test-Truthy $env:VUKOLI_NO_OLLAMA))
    $S.NoModels = ($Opt.NoModels -or (Test-Truthy $env:VUKOLI_NO_MODELS))
    $S.NoLaunch = ($Opt.NoLaunch -or (Test-Truthy $env:VUKOLI_NO_LAUNCH))
    $S.From = $Opt.From
    if ([string]::IsNullOrWhiteSpace($S.From)) { $S.From = $env:VUKOLI_FROM }
    $S.Version = ''

    Initialize-Network
    $transcript = $false
    $clock = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        if ($Opt.Uninstall) {
            Invoke-Uninstall
            return
        }

        Initialize-Paths
        foreach ($d in @($S.Prefix, $S.Logs, $S.Tmp)) {
            if (-not (Test-Path -LiteralPath $d)) {
                try { $null = New-Item -ItemType Directory -Path $d -Force } catch { $null = $_ }
            }
        }
        try { Start-Transcript -Path (Join-Path $S.Logs 'install.log') -Append | Out-Null; $transcript = $true } catch { $transcript = $false }

        Write-Host ''
        Write-Host 'Vukoli installer' -ForegroundColor Cyan
        Write-Host ('Install folder: {0}' -f $S.Prefix)
        if (Test-StepDone 'complete') {
            # a finished install is re-run as an update: start the step list over (everything is checked, nothing is re-downloaded needlessly)
            Remove-Item -LiteralPath $S.StateFile -Force -ErrorAction SilentlyContinue
        }

        Invoke-Step 1 'Checking your computer' '' { Step-Preflight } $null
        Invoke-Step 2 'Getting the app' 'app' { Step-App } { Test-Path -LiteralPath (Join-Path $S.AppServer 'requirements.txt') }
        Invoke-Step 3 'Installing Python and the app dependencies' 'python' { Step-Python } { Test-Path -LiteralPath $S.VenvPy }
        Invoke-Step 4 'Downloading speech models (voice and recognition)' 'models' { Step-Models } $null
        Invoke-Step 5 'Setting up Ollama (runs the language model on this computer)' '' { Step-Ollama } $null
        Invoke-Step 6 'Downloading the language model' 'pull' { Step-Pull } $null
        Invoke-Step 7 'Creating shortcuts' '' { Step-Launchers } $null
        Set-StepDone 'complete'
        Invoke-Step 8 'Starting Vukoli' '' { Step-Launch } $null

        $sec = $clock.Elapsed.TotalSeconds
        Write-Host ''
        Write-Host 'Done.' -ForegroundColor Green
        Write-Host ('  Total time:            {0}' -f (Format-Duration $sec))
        Write-Host ('  Model download time:   {0}   (speech + language models; included in the total)' -f (Format-Duration $S.ModelSeconds))
        Write-Host ('  Install without models: {0}' -f (Format-Duration ($sec - $S.ModelSeconds)))
        if (-not $S.NoLaunch) {
            $shownPort = '8000'
            if ($env:IC_PORT -and ($env:IC_PORT.Trim() -match '^\d+$')) { $shownPort = $env:IC_PORT.Trim() }
            Write-Host ('  Vukoli opens in its own window (Edge or Chrome app mode): http://127.0.0.1:{0}  (the first-run wizard guides you).' -f $shownPort)
        }
        Write-Host '  Next time: Start menu > Vukoli, or the Desktop shortcut.'
        if ($S.NoOllama) {
            Write-Host '  No local language model was installed; the wizard shows how to connect an engine.'
        }
    }
    catch {
        $msg = $_.Exception.Message
        $hint = ''
        try { $hint = [string]$_.Exception.Data['hint'] } catch { $hint = '' }
        Write-Host ''
        if ($S.Step -gt 0) {
            Write-Host ('Step {0}/{1} failed: {2}' -f $S.Step, $TOTAL, $S.StepTitle) -ForegroundColor Red
        } else {
            Write-Host 'Vukoli could not finish.' -ForegroundColor Red
        }
        Write-Host ('  What happened: {0}' -f $msg) -ForegroundColor Red
        if ($hint) { Write-Host ('  What to do:    {0}' -f $hint) }
        else { Write-Host '  What to do:    Run the same command again. If it keeps failing, copy this window and open an issue at the project page.' }
        if ($S.Prefix -and -not $Opt.Uninstall) {
            Write-Host '  Finished steps are remembered, so running the same command again continues from here.'
            Write-Host ('  Log: {0}' -f (Join-Path $S.Logs 'install.log'))
        }
        $Opt.Result.Code = 1
    }
    finally {
        Restore-TempEnv
        if ($transcript) { try { Stop-Transcript | Out-Null } catch { $null = $_ } }
    }
} $vkOptions

# Exit handling. `exit` would close the user's PowerShell window when this is piped to iex, so it is used only for a file run.
if ($vkResult.Code -ne 0) {
    if ($PSCommandPath) { exit $vkResult.Code }
    throw 'Vukoli install failed - see the message above.'
}
