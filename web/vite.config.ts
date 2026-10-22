/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on 5173; the FastAPI backend (127.0.0.1:8000) accepts this origin (IC_DEV_ORIGINS).
// `npm run build` writes app/web/dist, which the backend serves at "/".
// VITE_UT_ENDPOINT (user test build, `npm run ut`, internal tooling) adds the tracker; without it the build is the normal one.
// The plugin file exists only in the private checkout, so it is imported lazily and only when the variable is set.
export default defineConfig(async ({ mode }) => {
  const utEndpoint = loadEnv(mode, ".", "VITE_").VITE_UT_ENDPOINT ?? "";
  const utPlugin = utEndpoint
    ? [(await import(new URL("./scripts/ut-tracker-plugin.mjs", import.meta.url).href)).userTestTracker(utEndpoint)]
    : [];
  return {
  plugins: [react(), ...utPlugin],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: false },
      "/ws": { target: "ws://127.0.0.1:8000", ws: true, changeOrigin: false },
    },
  },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  };
});
