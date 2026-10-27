/* End-to-end suite (docs/e2e.md). Run from app/web: `npm run test:e2e` (both projects), `npm run test:e2e:ui` to debug.
 *
 * The webServer (scripts/e2e-server.mjs) builds the app into .e2e-dist (never `dist`) and starts the Python backend on
 * port 8010 in test mode: IC_E2E=1 puts a scripted AI engine in the Ollama slot and adds /api/_e2e/* (reset, seed, steer
 * the engine). No real model, no microphone, nothing on the owner's ports (8000, 8001, 8002, 11434, 11435).
 * One worker, tests in file order: every test shares that one server and data folder, and resets it first.
 */
import { defineConfig, devices } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

const PORT = 8010;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    // The service worker (public/sw.js) would handle page loads itself, out of reach of page.route; the suite tests the app, not the install.
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // A fake microphone: the page sees a working input device (permission is granted per test with `permissions`).
    // Tests that need "no microphone" stub getUserMedia themselves (helpers.denyMicrophone).
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      // Chromium with a phone viewport (the installed browser): `isMobile` + `hasTouch` as the directive asks.
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `${BASE_URL}/api/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore", // the web build log; the backend log is in .e2e-data/server.log
    stderr: "pipe",
  },
});
