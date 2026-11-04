import "server-only";
import { isLocalProvider } from "@/lib/data/provider";
import { requireLocalAdmin } from "./local";
import { requireAdmin } from "@/lib/db/server";
export async function requireManagementAdmin() {
  if (isLocalProvider()) return requireLocalAdmin();
  const { user } = await requireAdmin();
  return { id: user.id, email: user.email };
}
