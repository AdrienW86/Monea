/** Wire contracts for the three backend RPCs. UUID/date/timestamp values are strings.
 * These describe PostgreSQL JSONB before SupabaseRepository normalizes settings/hours.
 * Type-only module: no credentials, client, networking or application behavior.
 */
import type { z } from "zod";
import type { snapshotQuerySchema } from "./snapshot-query";
import type {
  Allocation,
  Audit,
  BookingLine,
  Category,
  Client,
  Contact,
  LocalPayment,
  ManagedBooking,
  ManagedService,
  Notification,
  PublicBooking,
  Settings,
  Snapshot,
  SnapshotQuery,
  SpecialHours,
} from "./types";

export type ManagementSnapshotQuery = Omit<SnapshotQuery, "section"> & {
  section?: z.output<typeof snapshotQuerySchema>["section"];
};

export type RpcClient = Client & { consent_at: string; created_at: string };
export type RpcAllocation = Omit<Allocation, "reason"> & {
  reason: string | null;
  created_at: string;
};
export type RpcPayment = LocalPayment & {
  currency: "eur";
  idempotency_key: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  checkout_expires_at: string | null;
  refunded_cents: number;
  refund_id: string | null;
  refund_request_id: string | null;
};
export type RpcBookingLine = BookingLine & {
  booking_id: string;
  position: number;
};
export type RpcManagedBooking = Omit<
  ManagedBooking,
  "client" | "allocation" | "payment" | "lines"
> & {
  service_id: string;
  client: RpcClient;
  allocation: RpcAllocation;
  payment: RpcPayment | null;
  lines: RpcBookingLine[];
};
export type RpcService = ManagedService & {
  category_active: boolean;
  updated_at: string;
};
export type RpcAudit = Omit<Audit, "actor_id" | "entity_id"> & {
  actor_id: string | null;
  entity_id: string | null;
};
export type RpcNotification = Omit<Notification, "entity_id"> & {
  entity_id: string | null;
};
export type RpcContact = Omit<Contact, "phone"> & {
  phone: string | null;
  consent_at: string;
};
export type RpcSpecialHours = Omit<SpecialHours, "reason"> & {
  reason: string | null;
};

export type ManagementSnapshotRpcArgs = {
  /** Verified by Next.js requireAdmin() and SQL assert_admin(). */
  p_actor: string;
  /** SQL default {}; Next.js applies snapshotQuerySchema before sending. */
  p_query?: ManagementSnapshotQuery;
};
export type ManagementSnapshotRpcResult = Omit<
  Snapshot,
  | "provider"
  | "settings"
  | "services"
  | "clients"
  | "bookings"
  | "allocations"
  | "special"
  | "messages"
  | "notifications"
  | "audit"
  | "pagination"
  | "summary"
> & {
  provider: "supabase";
  /** Raw settings; row id=1 is supplied by initial_schema. No defaults are written. */
  settings: Partial<Settings> | null;
  services: RpcService[];
  clients: RpcClient[];
  bookings: RpcManagedBooking[];
  allocations: RpcAllocation[];
  special: RpcSpecialHours[];
  messages: RpcContact[];
  notifications: RpcNotification[];
  audit: RpcAudit[];
  pagination: { page: number; pageSize: 50; total: number };
  summary: {
    clients: number;
    upcoming: number;
    pending: number;
    received: number;
  };
};

export type RepositoryCatalogueRpcArgs = Record<string, never>;
export type RepositoryCatalogueRpcResult = {
  settings: Partial<Settings> | null;
  services: RpcService[];
  categories: Category[];
};

export type RepositoryBookingStatusRpcArgs = { p_token: string };
/** Exactly these nine keys. No customer, notes, request ID or Stripe IDs. */
export type RepositoryBookingStatusRpcResult = Pick<
  PublicBooking,
  | "id"
  | "public_token"
  | "service_name"
  | "price_cents"
  | "status"
  | "start_at"
  | "end_at"
  | "payment_status"
  | "payment_provider"
> | null;

/** Same Args/Returns notation as Supabase's generated function definitions. */
export type BackendRpcContracts = {
  management_snapshot: {
    Args: ManagementSnapshotRpcArgs;
    Returns: ManagementSnapshotRpcResult;
  };
  repository_catalogue: {
    Args: RepositoryCatalogueRpcArgs;
    Returns: RepositoryCatalogueRpcResult;
  };
  repository_booking_status: {
    Args: RepositoryBookingStatusRpcArgs;
    Returns: RepositoryBookingStatusRpcResult;
  };
};
