// Local rehearsal only. Remote promotion requires a separately authorized operation.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { validateExport } from "./local-transfer.mjs";
import { verifyLocalImport } from "./verify-local-import.mjs";
const url = new URL(process.env.PG_MIGRATION_URL || "postgres://invalid");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw Error("Ce script accepte uniquement un PostgreSQL local isolé.");
const actor = process.env.PG_MIGRATION_ACTOR;
if (!actor || !/^[a-f0-9-]{36}$/i.test(actor))
  throw Error("Identifiant administrateur UUID requis.");
const raw = readFileSync(process.argv[2], "utf8");
const envelope = validateExport(JSON.parse(raw));
const hash = createHash("sha256").update(raw).digest("hex");
const client = new Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "INSERT INTO public.local_import_archives(source,schema_version,sha256,payload) VALUES('local',2,$1,$2::jsonb) ON CONFLICT(sha256) DO NOTHING",
    [hash, JSON.stringify(envelope)],
  );
  const { rows } = await client.query(
    "SELECT public.management_import_archive($1,$2) result",
    [actor, hash],
  );
  const comparison = await verifyLocalImport(client, envelope);
  if (process.argv.includes("--apply-local")) await client.query("COMMIT");
  else await client.query("ROLLBACK");
  console.log(
    JSON.stringify(
      {
        sha256: hash,
        dry_run: !process.argv.includes("--apply-local"),
        comparison,
        ...rows[0].result,
      },
      null,
      2,
    ),
  );
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
