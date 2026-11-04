import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  create: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({
  db: () => ({ rpc: mocks.rpc }),
  dbConfigured: () => true,
}));
vi.mock("@/lib/db/queries", () => ({
  integrationStatus: () => ({ Stripe: true, Supabase: true }),
}));
vi.mock("@/lib/payments/stripe", async () => {
  const { default: Sdk } = await import("stripe");
  return {
    stripeClient: () => ({
      checkout: {
        sessions: { create: mocks.create, retrieve: mocks.retrieve },
      },
      webhooks: Sdk.webhooks,
    }),
    livePaymentsAllowed: () => false,
    stripeSecretKey: () => "sk_test_fixture",
  };
});
import { POST as book } from "@/app/api/bookings/route";
import { POST as webhook } from "@/app/api/webhooks/stripe/route";
let pg: PGlite;
const secret = "whsec_isolatedfixture",
  origin = "http://localhost:3210";
const service = "00000000-0000-4000-8000-000000000001";
const sessions = new Map<
  string,
  {
    id: string;
    url: string;
    status: string;
    metadata: { booking_id: string; request_id: string };
    amount_total: number;
  }
>();
let index = 0;
beforeAll(async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  vi.stubEnv("DATA_PROVIDER", "supabase");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  vi.stubEnv("RATE_LIMIT_SALT", "isolatedfixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  pg = new PGlite();
  await pg.exec(
    "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await pg.exec(readFileSync("supabase/seed.sql", "utf8"));
  await pg.exec(
    `update public.site_settings set value='{"bookingEnabled":true,"legalReady":true,"privacyReady":true,"pricesValidated":true,"noticeHours":1,"horizonDays":365}';insert into public.business_hours(weekday,opens,closes) select i,'08:00','20:00' from generate_series(0,6)i;update public.services set price_cents=3675 where id='${service}';`,
  );
  mocks.rpc.mockImplementation(
    async (name: string, args: Record<string, unknown>) => {
      const entries = Object.entries(args);
      if (
        !/^[a-z_]+$/.test(name) ||
        entries.some(([key]) => !/^p_[a-z_]+$/.test(key))
      )
        throw Error("RPC invalide");
      try {
        const result = await pg.query<{ value: unknown }>(
          `select public.${name}(${entries.map(([key], i) => `${key}=>$${i + 1}`).join(",")}) value`,
          entries.map(([, value]) =>
            value && typeof value === "object" ? JSON.stringify(value) : value,
          ),
        );
        return { data: result.rows[0].value, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  );
  mocks.create.mockImplementation(
    async (params: Stripe.Checkout.SessionCreateParams) => {
      const session = {
        id: `cs_test_${randomUUID()}`,
        url: "https://checkout.stripe.com/testfixture",
        status: "open",
        metadata: params.metadata as { booking_id: string; request_id: string },
        amount_total: params.line_items![0].price_data!.unit_amount!,
      };
      sessions.set(session.id, session);
      return session;
    },
  );
  mocks.retrieve.mockImplementation(async (id: string) => sessions.get(id));
});
afterAll(async () => {
  await pg?.close();
  vi.unstubAllEnvs();
});
async function reservation() {
  index++;
  const time = new Date();
  time.setUTCDate(time.getUTCDate() + index + 2);
  time.setUTCHours(10, 0, 0, 0);
  const input = {
    service_id: service,
    start_at: time.toISOString(),
    request_id: randomUUID(),
    first_name: "Test",
    last_name: "Stripe",
    email: "stripe@example.invalid",
    phone: "0612345678",
    consent: true,
    website: "",
    price_cents: 1,
  };
  const request = () =>
    new NextRequest(`${origin}/api/bookings`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-real-ip": `127.0.1.${index}`,
      },
      body: JSON.stringify(input),
    });
  expect((await book(request())).status).toBe(200);
  const session = [...sessions.values()].at(-1)!;
  return { session, request };
}
function signed(
  session: ReturnType<typeof sessions.get>,
  type = "checkout.session.completed",
  patch: Record<string, unknown> = {},
  eventId = `evt_${randomUUID()}`,
  valid = true,
) {
  const payload = JSON.stringify({
    id: eventId,
    type,
    livemode: false,
    data: {
      object: {
        ...session,
        currency: "eur",
        payment_status: "paid",
        payment_intent: `pi_${session!.id}`,
        ...patch,
      },
    },
  });
  return new NextRequest(`${origin}/api/webhooks/stripe`, {
    method: "POST",
    body: payload,
    headers: {
      "stripe-signature": Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: valid ? secret : "wrong",
      }),
    },
  });
}
it("réservation → tarif réel en base → Checkout simulé unique → webhook signé → confirmation unique", async () => {
  const count = mocks.create.mock.calls.length;
  const { session, request } = await reservation();
  expect(session.amount_total).toBe(3675);
  expect(mocks.create.mock.calls.at(-1)![0]).toMatchObject({
    mode: "payment",
    allowed_payment_method_types: ["card"],
    metadata: session.metadata,
  });
  expect((await book(request())).status).toBe(200);
  expect(mocks.create.mock.calls.length).toBe(count + 1);
  expect(
    (
      await pg.query("select status from public.bookings where id=$1", [
        session.metadata.booking_id,
      ])
    ).rows[0],
  ).toMatchObject({ status: "pending" });
  const id = `evt_${randomUUID()}`;
  expect(
    (await webhook(signed(session, "checkout.session.completed", {}, id)))
      .status,
  ).toBe(200);
  expect(
    await (
      await webhook(signed(session, "checkout.session.completed", {}, id))
    ).json(),
  ).toMatchObject({ result: "duplicate" });
  expect(await (await webhook(signed(session))).json()).toMatchObject({
    result: "already_paid",
  });
  expect(
    (
      await pg.query(
        "select b.status,p.status payment_status,(select count(*)::int from public.notification_outbox where booking_id=b.id) notifications from public.bookings b join public.payments p on p.booking_id=b.id where b.id=$1",
        [session.metadata.booking_id],
      )
    ).rows[0],
  ).toEqual({ status: "confirmed", payment_status: "paid", notifications: 2 });
});
it("mock ignores signed events without changing a pending Stripe booking or event ledger", async () => {
  const { session } = await reservation();
  const before = await pg.query(
    "select b.status,p.status payment_status,p.refunded_cents from public.bookings b join public.payments p on p.booking_id=b.id where b.id=$1",
    [session.metadata.booking_id],
  );
  const calls = mocks.rpc.mock.calls.length;
  vi.stubEnv("PAYMENT_PROVIDER", "mock");
  try {
    for (const type of [
      "checkout.session.completed",
      "checkout.session.expired",
      "charge.refunded",
    ]) {
      expect((await webhook(signed(session, type))).status).toBe(503);
    }
    expect(mocks.rpc.mock.calls.length).toBe(calls);
    expect(
      (
        await pg.query(
          "select b.status,p.status payment_status,p.refunded_cents from public.bookings b join public.payments p on p.booking_id=b.id where b.id=$1",
          [session.metadata.booking_id],
        )
      ).rows,
    ).toEqual(before.rows);
  } finally {
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  }
  expect((await webhook(signed(session))).status).toBe(200);
});
it("refuse signature et montant falsifiés, puis autorise le rejeu après rollback", async () => {
  const { session } = await reservation();
  const id = `evt_${randomUUID()}`;
  expect(
    (
      await webhook(
        signed(session, "checkout.session.completed", {}, id, false),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await webhook(
        signed(session, "checkout.session.completed", { amount_total: 1 }, id),
      )
    ).status,
  ).toBe(500);
  expect(
    (await pg.query("select * from public.webhook_events where id=$1", [id]))
      .rows,
  ).toHaveLength(0);
  expect(
    (await webhook(signed(session, "checkout.session.completed", {}, id)))
      .status,
  ).toBe(200);
});
it.each(["checkout.session.async_payment_failed", "checkout.session.expired"])(
  "%s libère le créneau sans confirmer ni notifier",
  async (type) => {
    const { session } = await reservation();
    expect(
      (await webhook(signed(session, type, { payment_status: "unpaid" })))
        .status,
    ).toBe(200);
    expect(
      (
        await pg.query(
          "select b.status,a.state,(select count(*)::int from public.notification_outbox where booking_id=b.id) notifications from public.bookings b join public.time_allocations a on a.id=b.allocation_id where b.id=$1",
          [session.metadata.booking_id],
        )
      ).rows[0],
    ).toEqual({ status: "expired", state: "expired", notifications: 0 });
  },
);
