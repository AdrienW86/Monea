export function isLocalProvider() {
  return process.env.DATA_PROVIDER === "local";
}
export function assertLocalDevelopment() {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test")
    throw Error("Le mode local est interdit hors développement.");
}
export { mockPaymentsEnabled } from "@/lib/payments/provider.mjs";
export function localAuthConfigured() {
  return (
    isLocalProvider() &&
    process.env.NODE_ENV === "development" &&
    !!process.env.LOCAL_ADMIN_EMAIL &&
    !!process.env.LOCAL_ADMIN_PASSWORD &&
    !!process.env.LOCAL_SESSION_SECRET &&
    process.env.LOCAL_SESSION_SECRET.length >= 32
  );
}
