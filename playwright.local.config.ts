import { defineConfig, devices } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
process.env.MONEA_E2E_PASSWORD ||= randomBytes(24).toString("hex");
process.env.MONEA_E2E_DB ||= ".local/e2e/" + randomUUID() + ".sqlite";
export default defineConfig({
  testDir: "e2e-local",
  outputDir: ".local/test-results-management",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3212", trace: "retain-on-failure" },
  webServer: {
    command: "npm.cmd run dev -- --port 3212",
    url: "http://127.0.0.1:3212",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATA_PROVIDER: "local",
      PAYMENT_PROVIDER: "mock",
      NEXT_DIST_DIR: ".next-local-qa",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3212",
      LOCAL_DATABASE_PATH: process.env.MONEA_E2E_DB,
      LOCAL_ADMIN_EMAIL: "e2e@example.invalid",
      LOCAL_ADMIN_PASSWORD: process.env.MONEA_E2E_PASSWORD,
      LOCAL_SESSION_SECRET: randomBytes(32).toString("hex"),
      RATE_LIMIT_SALT: randomBytes(32).toString("hex"),
      ENABLE_EXTERNAL_NOTIFICATIONS: "false",
      ALLOW_LIVE_PAYMENTS: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  projects: [
    {
      name: "local-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "local-mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
      },
    },
  ],
});
