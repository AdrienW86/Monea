// Build/preview isolés : le serveur de développement du propriétaire reste sur 3210.
import { spawn } from "node:child_process";
const env = {
  ...process.env,
  NEXT_DIST_DIR: ".next-qa",
  NEXT_TELEMETRY_DISABLED: "1",
};
function run(args) {
  return spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], {
    env,
    stdio: "inherit",
    windowsHide: true,
  });
}
const build = run(["build"]);
const status = await new Promise((resolve) => build.on("exit", resolve));
if (status !== 0) process.exit(Number(status) || 1);
const server = run(["start", "--hostname", "127.0.0.1", "--port", "3211"]);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.kill(signal);
    process.exit(0);
  });
server.on("exit", (code) => process.exit(code || 0));
