import { defineConfig } from "@playwright/test";
import local from "./playwright.local.config";
export default defineConfig({
  ...local,
  testDir: "e2e-brand",
  outputDir: ".local/test-results-brand",
  use: { ...local.use, baseURL: "http://127.0.0.1:3210" },
  webServer: {
    ...local.webServer,
    command: "npm.cmd run dev -- --hostname 127.0.0.1 --port 3210",
    url: "http://127.0.0.1:3210",
    env: {
      ...(!Array.isArray(local.webServer) ? local.webServer?.env : {}),
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3210",
      NEXT_DIST_DIR: ".next-brand-qa",
    },
  },
});
