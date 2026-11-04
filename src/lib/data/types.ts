import type { Brand } from "@/config/brand";
import type { Service } from "@/lib/catalogue";
export type Settings = Brand & {
  slotStepMinutes: number;
  defaultDurationMinutes: number;
  planningStartHour: number;
  planningEndHour: number;
  localBookingEnabled: boolean;
};
export type Category = {
  id: string;
  name: string;
  description: string;
  image: string;
  sort_order: number;
  active: boolean;
  demo: boolean;
};
export type Product = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  image: string;
  category_id: string;
  status: "active" | "archived";
  stock: number | null;
  demo: boolean;
};
export type Client = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
  demo: boolean;
  booking_count?: number;
};
export type ManagedService = Service & { category_id: string; demo: boolean };
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "expired"
  | "reconciliation";
export type Allocation = {
  id: string;
  start_at: string;
  end_at: string;
  kind: "hold" | "booking" | "manual" | "block";
  state: "active" | "expired" | "cancelled";
  expires_at: string | null;
  reason: string;
  series_id: string | null;
  demo: boolean;
};
export type BookingLine = {
  id: string;
  service_id: string;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
};
export type ManagedBooking = {
  id: string;
  public_token: string;
  request_id: string;
  allocation_id: string;
  client_id: string;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
  status: BookingStatus;
  source: "online" | "manual";
  offline_status: "paid_offline" | "unpaid" | null;
  notes: string;
  created_at: string;
  demo: boolean;
  lines: BookingLine[];
  client: Client;
  allocation: Allocation;
  payment: LocalPayment | null;
};
export type LocalPayment = {
  id: string;
  booking_id: string;
  provider: "mock" | "stripe";
  status:
    | "pending"
    | "mock_paid"
    | "paid"
    | "failed"
    | "expired"
    | "reconciliation"
    | "refund_pending"
    | "partial_refund"
    | "refunded";
  refunded_cents?: number;
  amount_cents: number;
  created_at: string;
};
export type Hours = {
  id: string;
  weekday: number;
  opens: string;
  closes: string;
};
export type SpecialHours = {
  date: string;
  intervals: { opens: string; closes: string }[];
  reason: string;
};
export type Notification = {
  id: string;
  kind: string;
  entity_id: string;
  title: string;
  message: string;
  status: "unread" | "read";
  transport: "local" | "email" | "whatsapp";
  delivery_status?: string;
  created_at: string;
};
export type Contact = {
  id: string;
  first_name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: "new" | "processed";
  created_at: string;
};
export type Audit = {
  id: string;
  actor_id: string;
  action: string;
  entity_id: string;
  detail: Record<string, unknown>;
  created_at: string;
};
export type Slot = { start_at: string; end_at: string; available: boolean };
export type Snapshot = {
  provider: "local" | "supabase";
  settings: Settings;
  categories: Category[];
  services: ManagedService[];
  products: Product[];
  clients: Client[];
  bookings: ManagedBooking[];
  allocations: Allocation[];
  hours: Hours[];
  special: SpecialHours[];
  notifications: Notification[];
  messages: Contact[];
  audit: Audit[];
  pagination?: { page: number; pageSize: number; total: number };
  summary?: {
    clients: number;
    upcoming: number;
    pending: number;
    received?: number;
  };
};
export type SnapshotQuery = {
  section?: string;
  page?: number;
  search?: string;
  from?: string;
  to?: string;
  clientId?: string;
  bookingId?: string;
  status?: "" | BookingStatus;
  date?: string;
};
export type PublicBooking = {
  id: string;
  public_token: string;
  service_name: string;
  price_cents: number;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  payment_status: string | null;
  payment_provider: "mock" | "stripe" | null;
  stripe_session_id?: string | null;
  checkout_expires_at?: string | null;
  checkout_minutes?: number;
};
export type BookingInput = {
  service_ids: string[];
  start_at: string;
  request_id: string;
  client_id?: string;
  client?: Omit<Client, "id" | "notes" | "demo">;
  offline_status?: "paid_offline" | "unpaid";
  status?: BookingStatus;
  notes?: string;
  demo?: boolean;
};
export interface DataRepository {
  readonly provider: "local" | "supabase";
  settings(): Promise<Settings>;
  services(): Promise<ManagedService[]>;
  categories(): Promise<Category[]>;
  availability(serviceId: string, date: string): Promise<Slot[]>;
  createBooking(input: BookingInput, actor?: string): Promise<PublicBooking>;
  publicBooking(token: string): Promise<PublicBooking | null>;
  storeContact(
    input: Omit<Contact, "id" | "status" | "created_at">,
  ): Promise<void>;
  snapshot(query?: SnapshotQuery, actor?: string): Promise<Snapshot>;
  mutate(command: unknown, actor: string): Promise<unknown>;
  rateLimit(key: string, max: number): Promise<boolean>;
}
export class DataError extends Error {
  constructor(
    message: string,
    public conflicts: Pick<
      Allocation,
      "id" | "start_at" | "end_at" | "kind"
    >[] = [],
  ) {
    super(message);
    this.name = "DataError";
  }
}
