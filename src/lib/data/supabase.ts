import "server-only";
import { db, requireAdmin } from "@/lib/db/server";
import { resolveBrand } from "@/config/brand";
import { bookingInputSchema, commandSchema } from "./commands";
import { snapshotQuerySchema } from "./snapshot-query";
import {
  DataError,
  type DataRepository,
  type Settings,
  type ManagedService,
  type Category,
  type BookingInput,
  type PublicBooking,
  type Slot,
  type Contact,
  type Snapshot,
  type SnapshotQuery,
} from "./types";
export type RepositoryRpc = (
  name: string,
  args?: Record<string, unknown>,
) => PromiseLike<{
  data: unknown;
  error: { code?: string; message?: string; details?: string } | null;
}>;
const settings = (value: Partial<Settings>): Settings => ({
  slotStepMinutes: 30,
  defaultDurationMinutes: 60,
  planningStartHour: 8,
  planningEndHour: 21,
  localBookingEnabled: false,
  ...value,
  ...resolveBrand(value),
});
export class SupabaseRepository implements DataRepository {
  readonly provider = "supabase" as const;
  constructor(
    private readonly rpc: RepositoryRpc = (name, args) => db().rpc(name, args),
  ) {}
  private async call<T>(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await this.rpc(name, args);
    if (error) {
      if (error.code === "23P01") {
        let conflicts = [];
        try {
          conflicts = JSON.parse(error.details || "{}").conflicts || [];
        } catch {
          /* Native exclusion details need not contain JSON. */
        }
        throw new DataError(
          "Créneau indisponible. Un rendez-vous ou blocage occupe cette période.",
          conflicts,
        );
      }
      if (error.code === "23503")
        throw new DataError(
          "Cet élément est référencé par un historique et ne peut pas être supprimé.",
        );
      if (error.code === "23505")
        throw new DataError("Cet identifiant ou ce nom existe déjà.");
      throw new DataError(
        error.code === "P0001"
          ? error.message || "Action refusée."
          : "Opération indisponible. Vérifiez le schéma Supabase et ses permissions.",
      );
    }
    return data as T;
  }
  private catalogue() {
    return this.call<{
      settings: Partial<Settings>;
      services: ManagedService[];
      categories: Category[];
    }>("repository_catalogue");
  }
  async settings() {
    return settings((await this.catalogue()).settings);
  }
  async services() {
    return (await this.catalogue()).services;
  }
  async categories() {
    return (await this.catalogue()).categories;
  }
  async availability(serviceId: string, date: string) {
    return this.call<Slot[]>("availability", {
      p_service: serviceId,
      p_date: date,
    });
  }
  async createBooking(input: BookingInput, actor?: string) {
    return this.call<PublicBooking>("management_save_booking", {
      p_input: bookingInputSchema.parse(input),
      p_actor: actor || null,
      p_existing: null,
    });
  }
  async publicBooking(token: string) {
    return this.call<PublicBooking | null>("repository_booking_status", {
      p_token: token,
    });
  }
  async storeContact(input: Omit<Contact, "id" | "status" | "created_at">) {
    await this.call("store_contact", { p_data: input });
  }
  async rateLimit(key: string, max: number) {
    return this.call<boolean>("take_rate_limit", { p_key: key, p_max: max });
  }
  async snapshot(query: SnapshotQuery = {}, actor?: string): Promise<Snapshot> {
    const id = actor || (await requireAdmin()).user.id;
    const data = await this.call<Snapshot>("management_snapshot", {
      p_actor: id,
      p_query: snapshotQuerySchema.parse(query),
    });
    return {
      ...data,
      settings: settings(data.settings),
      hours: data.hours.map((h) => ({
        ...h,
        opens: h.opens.slice(0, 5),
        closes: h.closes.slice(0, 5),
      })),
    };
  }
  async mutate(command: unknown, actor: string): Promise<unknown> {
    return this.call("management_mutate", {
      p_actor: actor,
      p_command: commandSchema.parse(command),
    });
  }
}
