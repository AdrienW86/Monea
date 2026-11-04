import { defineConfig } from "@playwright/test";
import brand from "./playwright.brand.config";
export default defineConfig({
  ...brand,
  testDir: "e2e-cleanup",
  outputDir: ".local/test-results-cleanup",
});
