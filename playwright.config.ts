import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  workers: 4,
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:3211", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/qa-server.mjs",
    url: "http://127.0.0.1:3211",
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3211",
      DATA_PROVIDER: "supabase",
      PAYMENT_PROVIDER: "stripe",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      ENABLE_EXTERNAL_NOTIFICATIONS: "false",
      ALLOW_LIVE_PAYMENTS: "false",
    },
    timeout: 120000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
      },
    },
  ],
});
