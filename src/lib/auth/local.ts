import "server-only";
import { cookies } from "next/headers";
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { localRepository } from "@/lib/data/local";
import { localAuthConfigured } from "@/lib/data/provider";
const cookieName = "monea_local_session";
const identityHash = () =>
  createHash("sha256")
    .update(
      `${process.env.LOCAL_ADMIN_EMAIL}:${process.env.LOCAL_ADMIN_PASSWORD}:${process.env.LOCAL_SESSION_SECRET}`,
    )
    .digest("hex");
const tokenHash = (token: string) =>
  createHmac("sha256", process.env.LOCAL_SESSION_SECRET || "")
    .update(token)
    .digest("hex");
export async function localSignIn(email: string, password: string) {
  if (!localAuthConfigured()) throw Error("UNAUTHORIZED");
  const expected = scryptSync(
    process.env.LOCAL_ADMIN_PASSWORD!,
    process.env.LOCAL_SESSION_SECRET!,
    64,
  );
  const actual = scryptSync(password, process.env.LOCAL_SESSION_SECRET!, 64);
  if (
    !timingSafeEqual(expected, actual) ||
    email.toLowerCase() !== process.env.LOCAL_ADMIN_EMAIL!.toLowerCase()
  )
    throw Error("UNAUTHORIZED");
  const repo = localRepository();
  const token = randomBytes(32).toString("hex");
  repo.connection
    .prepare("DELETE FROM local_sessions WHERE expires_at<?")
    .run(Date.now());
  repo.connection
    .prepare("INSERT INTO local_sessions VALUES(?,?,?)")
    .run(tokenHash(token), Date.now() + 12 * 3600000, identityHash());
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 12 * 3600,
  });
}
export async function requireLocalAdmin() {
  if (!localAuthConfigured()) throw Error("UNAUTHORIZED");
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw Error("UNAUTHORIZED");
  const session = localRepository()
    .connection.prepare(
      "SELECT id FROM local_sessions WHERE id=? AND expires_at>? AND identity_hash=?",
    )
    .get(tokenHash(token), Date.now(), identityHash());
  if (!session) throw Error("UNAUTHORIZED");
  return { id: "local-admin", email: process.env.LOCAL_ADMIN_EMAIL! };
}
export async function localSignOut() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && localAuthConfigured())
    localRepository()
      .connection.prepare("DELETE FROM local_sessions WHERE id=?")
      .run(tokenHash(token));
  jar.delete(cookieName);
}
