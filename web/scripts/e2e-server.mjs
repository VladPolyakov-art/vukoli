/*
 * The server the e2e suite runs against (Playwright `webServer`, see ../playwright.config.ts).
 *
 *   1. builds the web app into .e2e-dist (never `dist`: that one is served to the owner; skip with E2E_SKIP_BUILD=1)
 *   2. starts the Python backend on port 8010 (or E2E_PORT) in test mode (IC_E2E=1: scripted AI engine, /api/_e2e/*
 *      routes), with an empty data folder under .e2e-data/<port>/ (one per server, so parallel shards never share
 *      or wipe each other's data) and no connection to the real Ollama (11434) or to any speech model
 *   3. stays in the foreground and passes SIGTERM on, so Playwright can stop it
 *
 * Ports 8000, 8001, 8002, 11434 and 11435 belong to the owner's own runs: this script never touches them.
 */
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = resolve(web, "..", "server");
const outDir = join(web, ".e2e-dist");
const PORT = process.env.E2E_PORT ?? "8010";
const root = join(web, ".e2e-data", PORT);
const dataDir = join(root, "data");

if (["8000", "8001", "8002", "11434", "11435"].includes(PORT)) {
  console.error(`e2e-server: port ${PORT} is reserved for the owner's own runs.`);
  process.exit(1);
}

if (process.env.E2E_SKIP_BUILD !== "1" || !existsSync(join(outDir, "index.html"))) {
  console.log("e2e-server: building the web app into .e2e-dist");
  const build = spawnSync("npx", ["vite", "build", "--outDir", ".e2e-dist", "--emptyOutDir"], { cwd: web, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

rmSync(root, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

// The server's log goes to a file (keeps the test report readable); a failed run points here.
const logFile = join(root, "server.log");
const log = openSync(logFile, "a");
const python = join(server, ".venv", "bin", "python");
const child = spawn(existsSync(python) ? python : "python3", ["-m", "server", "--port", PORT], {
  cwd: server,
  stdio: ["ignore", log, log],
  env: {
    ...process.env,
    IC_E2E: "1",
    IC_PORT: PORT,
    IC_DATA_DIR: dataDir,
    IC_WEB_DIST: outDir,
    IC_PRELOAD: "0",                                       // no Whisper / Kokoro loading
    OLLAMA_URL: "http://127.0.0.1:9",                      // nothing listens there: the real Ollama is never asked
    KOKORO_MODEL_DIR: join(root, "no-kokoro"), // text mode only: no speech model
  },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  closeSync(log);
  if (code) console.error(`e2e-server: the backend exited with code ${code}, see ${logFile}`);
  process.exit(code ?? 0);
});
