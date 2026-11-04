// Read-only CLI fallback. Capture output so credentials and connection details are never printed.
import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const result = spawnSync(
  process.execPath,
  [
    "node_modules/supabase/dist/supabase.js",
    "migration",
    "list",
    "--project-ref",
    "qnmpfswaeexpchietwzf",
  ],
  {
    encoding: "utf8",
    timeout: 20000,
    maxBuffer: 1048576,
    windowsHide: true,
    env: { ...process.env, CI: "true" },
    input: "",
  },
);
const output = (result.stdout || "") + "\n" + (result.stderr || "");
console.log(
  JSON.stringify(
    {
      historyReadable: result.status === 0,
      authenticationRequired:
        /access token|login|password|permission|unauthorized/i.test(output),
      timedOut: result.error?.code === "ETIMEDOUT",
      versionsMentioned:
        result.status === 0
          ? [...new Set(output.match(/\b20\d{12}\b/g) || [])]
          : [],
    },
    null,
    2,
  ),
);
if (result.status !== 0) process.exitCode = 1;
