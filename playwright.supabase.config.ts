import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
process.env.MONEA_E2E_PASSWORD ||= randomBytes(24).toString("hex");
export default defineConfig({
  testDir: "e2e-supabase",
  outputDir: ".local/test-results-supabase",
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3213", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/supabase-qa-server.mjs",
    url: "http://127.0.0.1:3213",
    reuseExistingServer: false,
    timeout: 120000,
    env: { MONEA_E2E_PASSWORD: process.env.MONEA_E2E_PASSWORD },
  },
  projects: [
    {
      name: "postgres-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "postgres-mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
      },
    },
  ],
});
