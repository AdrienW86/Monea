import "server-only";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/server";
import { isLocalProvider } from "@/lib/data/provider";
import { localRepository } from "@/lib/data/local";
import { PaymentProviderDisabledError } from "@/lib/payments/provider.mjs";
export async function readText(req: NextRequest, maxBytes = 32768) {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw Error("TOO_LARGE");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function readJson(req: NextRequest): Promise<unknown> {
  return JSON.parse(await readText(req));
}
export function sameOrigin(req: NextRequest) {
  const expected = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  if (req.headers.get("origin") !== new URL(expected).origin)
    throw new Error("FORBIDDEN");
}
export async function limit(req: NextRequest, scope: string, max = 5) {
  if (!process.env.RATE_LIMIT_SALT)
    throw new Error("Protection anti-abus non configurée.");
  // Ne faire confiance à x-forwarded-for qu'après configuration du reverse proxy de production.
  const trustProxy =
    process.env.NODE_ENV !== "production" ||
    process.env.TRUST_PROXY_IP_HEADERS === "true";
  const ip = (trustProxy ? req.headers.get("x-real-ip") : null) || "shared";
  const key = createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT}:${scope}:${ip}`)
    .digest("hex");
  if (isLocalProvider()) {
    if (!(await localRepository().rateLimit(key, max)))
      throw Error("RATE_LIMIT");
    return;
  }
  const { data, error } = await db().rpc("take_rate_limit", {
    p_key: key,
    p_max: max,
  });
  if (error) throw new Error("Protection anti-abus indisponible.");
  if (!data) throw new Error("RATE_LIMIT");
}
export function failure(e: unknown) {
  if (e instanceof PaymentProviderDisabledError)
    return NextResponse.json(
      { error: e.message, code: e.code },
      { status: 503 },
    );
  const message = e instanceof Error ? e.message : "";
  const status =
    message === "TOO_LARGE"
      ? 413
      : message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message === "RATE_LIMIT"
            ? 429
            : message.includes("Créneau")
              ? 409
              : 400;
  return NextResponse.json(
    {
      error:
        status === 401
          ? "Connexion administratrice requise."
          : status === 403
            ? "Action refusée."
            : status === 429
              ? "Trop de demandes. Réessayez plus tard."
              : message === "UNAVAILABLE"
                ? "Service indisponible pour le moment."
                : status === 409
                  ? "Créneau indisponible. Choisissez un autre horaire."
                  : "Demande impossible. Vérifiez les informations ou la configuration.",
    },
    { status },
  );
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
}
