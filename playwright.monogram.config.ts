import { defineConfig } from "@playwright/test";
import brand from "./playwright.brand.config";

export default defineConfig({
  ...brand,
  testDir: "e2e-monogram",
  outputDir: ".local/test-results-monogram",
});
