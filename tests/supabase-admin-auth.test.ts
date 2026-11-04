import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({
  getUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  membership: vi.fn(),
  eq: vi.fn(),
  rpc: vi.fn(),
  snapshot: vi.fn(),
  mutate: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: fake.getUser,
      getSession: fake.getSession,
      signInWithPassword: fake.signIn,
      signOut: fake.signOut,
    },
    from: () => ({ select: () => ({ eq: fake.eq }) }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: fake.rpc }),
}));
vi.mock("@/lib/data/repository", () => ({
  repository: () => ({ snapshot: fake.snapshot, mutate: fake.mutate }),
}));
import { requireAdmin } from "@/lib/db/server";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { GET as read, POST as manage } from "@/app/api/admin/manage/route";
import { POST as mutate } from "@/app/api/admin/mutate/route";
import { POST as media } from "@/app/api/admin/media/route";
import { GET as exportCsv } from "@/app/api/admin/export/route";
const id = "11111111-1111-4111-8111-111111111111";
const origin = "http://localhost:3210";
const user = {
  id,
  email: "admin@example.invalid",
  user_metadata: { role: "admin" },
};
const req = (path: string, body?: unknown) =>
  new NextRequest(
    origin + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATA_PROVIDER", "supabase");
  vi.stubEnv("PAYMENT_PROVIDER", "mock");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  vi.stubEnv("RATE_LIMIT_SALT", "fixture");
  fake.getUser.mockResolvedValue({ data: { user }, error: null });
  fake.signIn.mockResolvedValue({ data: { user }, error: null });
  fake.signOut.mockResolvedValue({ error: null });
  fake.membership.mockResolvedValue({ data: { user_id: id }, error: null });
  fake.eq.mockImplementation(() => ({ maybeSingle: fake.membership }));
  fake.rpc.mockResolvedValue({ data: true, error: null });
  fake.snapshot.mockResolvedValue({
    provider: "supabase",
    bookings: [],
    services: [],
    categories: [],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Network prohibited in auth tests");
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

for (const identity of ["anonymous", "ordinary"] as const) {
  it.each(["read", "manage", "mutate", "media", "export", "logout"])(
    `${identity} cannot access %s`,
    async (route) => {
      if (identity === "anonymous")
        fake.getUser.mockResolvedValue({ data: { user: null }, error: null });
      else fake.membership.mockResolvedValue({ data: null, error: null });
      const response =
        route === "read"
          ? await read(req("/api/admin/manage"))
          : route === "manage"
            ? await manage(
                req("/api/admin/manage", {
                  action: "booking_cancel",
                  data: { id },
                }),
              )
            : route === "mutate"
              ? await mutate(
                  req("/api/admin/mutate", {
                    action: "refund",
                    data: { id, confirmed: true },
                  }),
                )
              : route === "media"
                ? await media(req("/api/admin/media", {}))
                : route === "export"
                  ? await exportCsv()
                  : await logout(req("/api/admin/logout", {}));
      expect(response.status).toBe(401);
      expect(fake.snapshot).not.toHaveBeenCalled();
      expect(fake.mutate).not.toHaveBeenCalled();
      expect(fake.rpc).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(fake.getSession).not.toHaveBeenCalled();
    },
  );
}
it("ordinary Auth account with admin metadata is signed out at login", async () => {
  fake.membership.mockResolvedValue({ data: null, error: null });
  expect(
    (
      await login(
        req("/api/admin/login", {
          email: user.email,
          password: "fixture-password",
        }),
      )
    ).status,
  ).toBe(401);
  expect(fake.signOut).toHaveBeenCalledOnce();
  expect(fake.eq).toHaveBeenCalledWith("user_id", id);
});
it("invalid Auth credentials never reach membership lookup", async () => {
  fake.signIn.mockResolvedValue({
    data: { user: null },
    error: { message: "Invalid credentials" },
  });
  expect(
    (
      await login(
        req("/api/admin/login", {
          email: user.email,
          password: "fixture-password",
        }),
      )
    ).status,
  ).toBe(401);
  expect(fake.eq).not.toHaveBeenCalled();
});
it("verified admin can log in and request a snapshot using only the server-verified UUID", async () => {
  expect(
    (
      await login(
        req("/api/admin/login", {
          email: user.email,
          password: "fixture-password",
        }),
      )
    ).status,
  ).toBe(200);
  const response = await read(
    req("/api/admin/manage?section=lookup&p_actor=forged"),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    provider: "supabase",
    bookings: [],
  });
  expect(fake.snapshot).toHaveBeenCalledWith(
    expect.objectContaining({ section: "lookup" }),
    id,
  );
  expect(fake.getUser).toHaveBeenCalled();
  expect(fake.getSession).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("membership is rechecked after login and fails closed on database failure", async () => {
  await expect(requireAdmin()).resolves.toMatchObject({ user: { id } });
  fake.membership.mockResolvedValue({
    data: null,
    error: { code: "unavailable" },
  });
  await expect(requireAdmin()).rejects.toThrow("UNAUTHORIZED");
  expect(fake.membership).toHaveBeenCalledTimes(2);
});
it("Auth validation error rejects even a supplied user object", async () => {
  fake.getUser.mockResolvedValue({
    data: { user },
    error: { message: "Invalid token" },
  });
  await expect(requireAdmin()).rejects.toThrow("UNAUTHORIZED");
  expect(fake.membership).not.toHaveBeenCalled();
});
