import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";
export default defineConfig([
  globalIgnores([
    ".next/**",
    ".next-qa/**",
    ".next-local-qa/**",
    ".next-brand-qa/**",
    ".next-supabase-qa/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    ".local/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...ts.configs.recommended],
    plugins: { "react-hooks": hooks, "@next/next": next },
    rules: {
      ...hooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
    },
  },
]);
