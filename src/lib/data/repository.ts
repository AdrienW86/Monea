import "server-only";
import { isLocalProvider } from "./provider";
import { localRepository } from "./local";
import { SupabaseRepository } from "./supabase";
import type { DataRepository } from "./types";
export function repository(): DataRepository {
  return isLocalProvider() ? localRepository() : new SupabaseRepository();
}
