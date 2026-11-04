// Compare imported business fields without printing any personal data.
import { isDeepStrictEqual } from "node:util";
const tables = {
  categories: [
    "categories",
    "id",
    "id name description image sort_order active demo",
  ],
  services: [
    "services",
    "id",
    "id slug name category category_id description qualification_requirement qualification_verified_at procedure_verified_at operational_status bookable visibility price_cents duration_minutes sort_order image demo",
  ],
  products: [
    "products",
    "id",
    "id name description category_id price_cents image status stock demo",
  ],
  clients: ["clients", "id", "id first_name last_name email phone notes demo"],
  allocations: [
    "time_allocations",
    "id",
    "id start_at end_at kind state expires_at reason series_id demo",
  ],
  bookings: [
    "bookings",
    "id",
    "id public_token request_id allocation_id client_id service_name price_cents duration_minutes status source offline_status notes created_at demo",
  ],
  hours: ["business_hours", "id", "id weekday opens closes"],
  special: ["special_hours", "date", "date intervals reason"],
  notifications: [
    "management_notifications",
    "id",
    "id kind entity_id title message status created_at",
  ],
  messages: [
    "contact_messages",
    "id",
    "id first_name email phone subject message status created_at",
  ],
  audit: ["admin_audit_log", "id", "id action entity_id created_at"],
  generated: ["generated_days", "id", "id date service_id generated_at slots"],
};
const normalize = (key, value) =>
  value != null && key.endsWith("_at")
    ? new Date(value).toISOString()
    : ["opens", "closes"].includes(key)
      ? value.slice(0, 5)
      : value;
export async function verifyLocalImport(client, envelope) {
  const counts = {};
  const compare = async (source, table, key, fields, cast = "uuid") => {
    if (!source.length) return 0;
    const { rows } = await client.query(
      `select * from public.${table} where ${key}=any($1::${cast}[])`,
      [source.map((r) => r[key])],
    );
    if (rows.length !== source.length)
      throw Error(`Comparaison incorrecte : ${table} (nombre).`);
    for (const original of source) {
      const imported = rows.find((r) => r[key] === original[key]);
      for (const field of fields.split(" ")) {
        if (original[field] === undefined) continue;
        if (
          !isDeepStrictEqual(
            normalize(field, imported[field]),
            normalize(field, original[field]),
          )
        )
          throw Error(`Comparaison incorrecte : ${table}.${field}.`);
      }
    }
    return rows.length;
  };
  for (const [collection, [table, key, fields]] of Object.entries(tables))
    counts[collection] = await compare(
      envelope.data[collection] || [],
      table,
      key,
      fields,
      key === "date" ? "date" : collection === "generated" ? "text" : "uuid",
    );
  counts.lines = await compare(
    envelope.data.bookings.flatMap((b) => b.lines),
    "booking_lines",
    "id",
    "id service_id service_name price_cents duration_minutes",
  );
  counts.mock_payments = await compare(
    envelope.data.bookings.map((b) => b.payment).filter(Boolean),
    "payments",
    "id",
    "id booking_id provider amount_cents status created_at",
  );
  const { rows } = await client.query(
    "select value from public.site_settings where id=1",
  );
  for (const [key, value] of Object.entries(envelope.data.settings))
    if (
      !isDeepStrictEqual(
        rows[0].value[key],
        key === "bookingEnabled" ? false : value,
      )
    )
      throw Error(`Comparaison incorrecte : settings.${key}.`);
  return { verified: true, counts };
}
