import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({
  db: () => ({
    rpc: mock.rpc,
    from: () => ({
      update: mock.update,
      select: () => ({ eq: () => ({ single: mock.single }) }),
    }),
  }),
  dbConfigured: () => true,
}));
import { processOutbox } from "@/lib/notifications/worker";
beforeEach(() => {
  vi.stubEnv("ENABLE_EXTERNAL_NOTIFICATIONS", "");
  mock.rpc.mockResolvedValue({
    data: [
      {
        id: "job",
        booking_id: "booking",
        transport: "whatsapp",
        attempts: 1,
        idempotency_key: "wa-booking",
      },
    ],
  });
  mock.update.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  mock.single.mockResolvedValue({
    data: {
      id: "12345678",
      status: "confirmed",
      service_name: "Cils",
      clients: { first_name: "Test", email: "test@example.invalid" },
      time_allocations: { start_at: "2027-01-01T10:00:00Z" },
    },
    error: null,
  });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("ne fait aucun envoi externe par défaut et signale la configuration manquante", async () => {
  await processOutbox();
  expect(fetch).not.toHaveBeenCalled();
  expect(mock.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "unconfigured" }),
  );
});
function configure() {
  vi.stubEnv("ENABLE_EXTERNAL_NOTIFICATIONS", "true");
  for (const key of [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ADMIN_TO",
    "WHATSAPP_TEMPLATE_NAME",
    "WHATSAPP_TEMPLATE_LANG",
  ])
    vi.stubEnv(key, "fixture");
  vi.stubEnv("META_GRAPH_API_VERSION", "v26.0");
}
it("utilise un template utility et traite une seule fois le lot réclamé", async () => {
  configure();
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ messages: [{ id: "provider-fixture" }] }), {
      status: 200,
    }),
  );
  await processOutbox();
  mock.rpc.mockResolvedValue({ data: [] });
  await processOutbox();
  expect(fetch).toHaveBeenCalledTimes(1);
  const args = vi.mocked(fetch).mock.calls[0];
  expect(JSON.parse(args[1]!.body as string)).toMatchObject({
    type: "template",
    template: { name: "fixture" },
  });
  expect(mock.update).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "sent",
      provider_id: "provider-fixture",
    }),
  );
});
it("un échec WhatsApp est relançable et ne modifie aucun paiement ou rendez-vous", async () => {
  configure();
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 503 }));
  await processOutbox();
  expect(mock.update).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "pending",
      last_error: "Fournisseur HTTP 503",
    }),
  );
  expect(mock.update).not.toHaveBeenCalledWith(
    expect.objectContaining({ status: "cancelled" }),
  );
});
it("un résultat réseau incertain ne renvoie pas automatiquement un doublon", async () => {
  configure();
  vi.mocked(fetch).mockRejectedValue(new TypeError("network"));
  await processOutbox();
  expect(mock.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "uncertain" }),
  );
});
