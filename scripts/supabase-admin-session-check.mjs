// Temporary loopback-only session verification. No credentials or cookies are logged.
// The existing .env.local and main SQLite process are never changed.
import nextEnv from "@next/env";
import { createServer, request } from "node:http";
import { spawn } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
if (
  process.env.DATA_PROVIDER !== "local" ||
  process.env.PAYMENT_PROVIDER !== "mock" ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") !==
    "https://qnmpfswaeexpchietwzf.supabase.co"
)
  throw Error("Configuration inattendue : recette non démarrée.");
const origin = "http://127.0.0.1:3217";
const backend = "http://127.0.0.1:3224";
const childEnv = {
  ...process.env,
  NODE_ENV: "development",
  DATA_PROVIDER: "supabase",
  PAYMENT_PROVIDER: "mock",
  NEXT_PUBLIC_APP_URL: origin,
  NEXT_DIST_DIR: ".next-supabase-qa",
  ENABLE_EXTERNAL_NOTIFICATIONS: "false",
  STRIPE_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_PUBLISHABLE_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
};
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3224",
  ],
  {
    env: childEnv,
    windowsHide: true,
    stdio: "ignore",
  },
);
async function verifySession(cookie) {
  try {
    const response = await fetch(`${backend}/api/admin/manage?section=lookup`, {
      headers: { cookie, host: "127.0.0.1:3217" },
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    console.log(
      JSON.stringify({
        check: "authenticated_nextjs_snapshot",
        status: response.status,
        provider: data.provider ?? null,
        categories: data.categories?.length ?? null,
        services: data.services?.length ?? null,
        bookings: data.bookings?.length ?? null,
      }),
    );
  } catch {
    console.log(
      JSON.stringify({
        check: "authenticated_nextjs_snapshot",
        verified: false,
      }),
    );
  }
}
const server = createServer((req, res) => {
  const url = new URL(req.url, origin);
  const read = ["GET", "HEAD"].includes(req.method);
  const auth =
    req.method === "POST" &&
    ["/api/admin/login", "/api/admin/logout"].includes(url.pathname);
  const allowedRead =
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/branding/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/fonts/") ||
    ["/icon.png", "/favicon.ico", "/api/admin/manage"].includes(url.pathname);
  if (
    !(auth || (read && allowedRead)) ||
    url.searchParams.has("export") ||
    req.headers.upgrade
  ) {
    res.writeHead(403, { "content-type": "application/json" });
    return res.end(
      JSON.stringify({
        error: "Cette recette autorise uniquement connexion et consultation.",
      }),
    );
  }
  const upstream = request(
    new URL(req.url, backend),
    { method: req.method, headers: { ...req.headers, host: "127.0.0.1:3217" } },
    (reply) => {
      if (url.pathname === "/api/admin/login") {
        console.log(
          JSON.stringify({ check: "nextjs_login", status: reply.statusCode }),
        );
        if (reply.statusCode === 200) {
          // Keep the session only in memory for a single backend access check.
          const cookies = new Map(
            (req.headers.cookie || "")
              .split(";")
              .filter(Boolean)
              .map((s) => {
                const i = s.indexOf("=");
                return [s.slice(0, i).trim(), s.slice(i + 1)];
              }),
          );
          for (const header of reply.headers["set-cookie"] || []) {
            const pair = header.split(";")[0],
              i = pair.indexOf("=");
            cookies.set(pair.slice(0, i), pair.slice(i + 1));
          }
          void verifySession(
            [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          );
        }
      }
      res.writeHead(reply.statusCode || 502, reply.headers);
      reply.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(503);
    res.end("Recette en cours de démarrage.");
  });
  req.pipe(upstream);
});
// Next.js dev waits for its HMR connection before completing hydration.
// Forward only this development WebSocket; business endpoints remain restricted.
server.on("upgrade", (req, socket, head) => {
  if (
    new URL(req.url, origin).pathname !== "/_next/hmr" ||
    req.headers.origin !== origin
  ) {
    socket.destroy();
    return;
  }
  const upstream = request(new URL(req.url, backend), {
    headers: { ...req.headers, host: "127.0.0.1:3217" },
  });
  upstream.on("upgrade", (reply, remote, remoteHead) => {
    socket.write(
      `HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}\r\n` +
        reply.rawHeaders.reduce(
          (s, v, i, a) => (i % 2 === 0 ? s + `${v}: ${a[i + 1]}\r\n` : s),
          "",
        ) +
        "\r\n",
    );
    if (remoteHead.length) socket.write(remoteHead);
    if (head.length) remote.write(head);
    socket.on("error", () => remote.destroy());
    remote.on("error", () => socket.destroy());
    socket.pipe(remote).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  upstream.on("response", () => socket.destroy());
  upstream.end();
});
server.listen(3217, "127.0.0.1", () =>
  console.log(
    "Recette administratrice : http://127.0.0.1:3217/admin/connexion — mutations métier bloquées.",
  ),
);
const stop = () => {
  server.close();
  child.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("error", () => {
  console.error("Serveur de recette indisponible.");
  stop();
});
child.on("exit", () => server.close());
