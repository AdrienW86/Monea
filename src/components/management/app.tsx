"use client";
import { useEffect, useRef, useState, useId, useCallback } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import Image from "next/image";
import { serviceVisual } from "@/config/editorial";
import { NO_IMAGE } from "@/lib/media";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { blockPeriod, type BlockPreset } from "@/lib/booking/block-period";
import { formatInTimeZone } from "date-fns-tz";
import {
  CalendarDays,
  Users,
  BookOpen,
  Clock3,
  LockKeyhole,
  Bell,
  Mail,
  Settings,
  LayoutDashboard,
  Layers,
  Plus,
  LogOut,
  Search,
  X,
  Menu,
} from "lucide-react";
import { eligible, euro } from "@/lib/catalogue";
import { categoryLabel, serviceDescription } from "@/lib/service-presentation";
import { localDate, parisInstant } from "@/lib/booking/time";
import type {
  Snapshot,
  ManagedBooking,
  Client,
  ManagedService,
  Category,
  Product,
  Allocation,
} from "@/lib/data/types";
import { Planning, statuses } from "./planning";
const navigation = [
  ["", "Tableau de bord", LayoutDashboard],
  ["planning", "Planning", CalendarDays],
  ["rendez-vous", "Rendez-vous", BookOpen],
  ["clientes", "Clientes", Users],
  ["indisponibilites", "Indisponibilités", LockKeyhole],
  ["horaires", "Horaires", Clock3],
  ["catalogue", "Catalogue", Layers],
  ["categories", "Catégories", Layers],
  ["notifications", "Notifications", Bell],
  ["messages", "Messages", Mail],
  ["parametres", "Paramètres", Settings],
] as const;
type DialogState =
  | {
      kind: "booking";
      value?: ManagedBooking;
      start?: { date: string; time: string };
    }
  | { kind: "client"; value?: Client }
  | { kind: "service"; value?: ManagedService }
  | { kind: "category"; value?: Category }
  | { kind: "product"; value?: Product }
  | { kind: "block"; value?: Allocation; date?: string };
type Command = { action: string; data: unknown };
type Perform = (command: Command, confirm?: string) => Promise<unknown>;
const today = () => formatInTimeZone(new Date(), "Europe/Paris", "yyyy-MM-dd");
const string = (f: FormData, key: string) => String(f.get(key) || "");
const checked = (f: FormData, key: string) => f.get(key) === "on";
const number = (f: FormData, key: string) => Number(f.get(key));
function Input({
  name,
  label,
  value = "",
  type = "text",
  required = true,
  ...rest
}: {
  name: string;
  label: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        {...rest}
      />
    </label>
  );
}
function Textarea({
  name,
  label,
  value = "",
}: {
  name: string;
  label: string;
  value?: string;
}) {
  return (
    <label className="full">
      {label}
      <textarea
        name={name}
        aria-label={label}
        defaultValue={value}
        maxLength={4000}
      />
    </label>
  );
}
function Check({
  name,
  label,
  value = false,
}: {
  name: string;
  label: string;
  value?: boolean;
}) {
  return (
    <label className="check">
      <input type="checkbox" name={name} defaultChecked={value} />
      {label}
    </label>
  );
}
function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: { id: string; name: string }[];
}) {
  return (
    <label>
      {label}
      <select name={name} aria-label={label} defaultValue={value}>
        {options.map((v) => (
          <option value={v.id} key={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function EditForm({
  children,
  onSubmit,
  label = "Enregistrer",
}: {
  children: React.ReactNode;
  onSubmit: (f: FormData) => Promise<unknown>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="management-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          if (e.currentTarget.querySelector('[data-uploading="true"]'))
            throw Error("Patientez jusqu’à la fin de l’import de l’image.");
          await onSubmit(new FormData(e.currentTarget));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Informations invalides.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p className="full management-error" role="alert">
          {error}
        </p>
      )}
      <div className="full form-submit">
        <button className="management-primary" disabled={busy}>
          {busy ? "Enregistrement…" : label}
        </button>
      </div>
    </form>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      className="management-dialog"
      aria-labelledby={titleId}
      ref={ref}
      onCancel={onClose}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label="Fermer la fenêtre" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}
function ImageField({
  value = "",
  fallback,
}: {
  value?: string | null;
  fallback?: string | null;
}) {
  const [image, setImage] = useState(value || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = image === NO_IMAGE ? null : image || fallback;
  return (
    <div className="full management-image-field" data-uploading={busy}>
      <input name="image" type="hidden" value={image} />
      <label className="media-field">
        {preview ? "Remplacer l’image" : "Ajouter une image"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = "";
            if (file.size > 4 * 1024 * 1024) {
              setError("Choisissez une image de moins de 4 Mo.");
              return;
            }
            setBusy(true);
            setError("");
            const form = new FormData();
            form.set("file", file);
            try {
              const response = await fetch("/api/admin/media", {
                method: "POST",
                body: form,
              });
              const result = await response.json();
              if (!response.ok) throw Error(result.error);
              setImage(result.image);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Import impossible.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && <p>Optimisation de l’image…</p>}
      <p className="management-hint">
        JPG, PNG ou WebP · 4 Mo maximum. Enregistrez pour appliquer le
        changement.
      </p>
      {preview && (
        <Image
          src={preview}
          alt="Aperçu du visuel"
          width={100}
          height={75}
          className="media-preview"
        />
      )}
      <div className="actions">
        {preview && (
          <button
            type="button"
            disabled={busy}
            className="management-danger"
            onClick={() => {
              setImage(NO_IMAGE);
              setError("");
            }}
          >
            Supprimer l’image
          </button>
        )}
        {image && (
          <button
            type="button"
            disabled={busy}
            className="management-secondary"
            onClick={() => {
              setImage("");
              setError("");
            }}
          >
            Rétablir l’image par défaut
          </button>
        )}
      </div>
      {image === NO_IMAGE && <p>Aucune image ne sera affichée.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function ManagementApp({
  initialData,
  section,
  initialId,
}: {
  initialData: Snapshot;
  section: string;
  initialId?: string;
}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const remote = initialData.provider === "supabase";
  const [scope, setScope] = useState<Record<string, string>>({
    section,
    page: String(initialData.pagination?.page || 0),
  });
  const snapshotUrl = (values: Record<string, string>) =>
    `/api/admin/manage?${new URLSearchParams(Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== "date" || value !== "")))}`;
  const planningRange = useCallback(
    (from: string, to: string) =>
      setScope((old) =>
        old.from === from && old.to === to
          ? old
          : { section: "planning", page: "0", from, to },
      ),
    [],
  );
  useEffect(() => {
    if (!remote) return;
    const controller = new AbortController();
    fetch(snapshotUrl(scope), { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error("Consultation indisponible.");
        setData(await r.json());
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [remote, scope]);
  const [dialog, setDialog] = useState<DialogState | null>(() =>
    initialId && section === "rendez-vous"
      ? {
          kind: "booking",
          value: initialData.bookings.find((b) => b.id === initialId),
        }
      : null,
  );
  const [notice, setNotice] = useState("");
  const [conflicts, setConflicts] = useState<
    { id: string; start_at: string; end_at: string }[]
  >([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  useEffect(() => {
    if (!remote || !["clientes", "rendez-vous"].includes(section)) return;
    const timer = setTimeout(
      () =>
        setScope((old) => ({
          ...old,
          search: query,
          status,
          ...(dateFilter ? { date: dateFilter } : { date: "" }),
          page: "0",
        })),
      250,
    );
    return () => clearTimeout(timer);
  }, [query, remote, section, status, dateFilter]);
  const [tab, setTab] = useState("services");
  const [menu, setMenu] = useState(false);
  const [generated, setGenerated] = useState<{
    total: number;
    days: { date: string; slots: { start_at: string; available: boolean }[] }[];
  } | null>(null);
  const router = useRouter();
  const perform: Perform = async (command, confirm) => {
    if (confirm && !window.confirm(confirm)) return null;
    setError("");
    setNotice("");
    setConflicts([]);
    try {
      const legacy =
        remote &&
        [
          "refund",
          "retry_notification",
          "run_outbox",
          "anonymize",
          "settings",
        ].includes(command.action);
      const r = await fetch(
        legacy ? "/api/admin/mutate" : "/api/admin/manage",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        },
      );
      const body = await r.json();
      if (!r.ok) {
        setConflicts(body.conflicts || []);
        throw Error(body.error);
      }
      const response = await fetch(
        remote ? snapshotUrl(scope) : "/api/admin/manage",
        { cache: "no-store" },
      );
      if (!response.ok)
        throw Error(
          "Données enregistrées mais actualisation impossible. Rechargez la page.",
        );
      setData(await response.json());
      setNotice(
        remote
          ? "Modification enregistrée."
          : "Modification enregistrée dans la base locale.",
      );
      return legacy ? body : body.result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
      return null;
    }
  };
  const save = async (action: string, payload: unknown, confirm?: string) => {
    const result = await perform({ action, data: payload }, confirm);
    if (result) setDialog(null);
    return result;
  };
  const q = query.toLowerCase();
  const rows = data.bookings.filter(
    (b) =>
      (!status || b.status === status) &&
      (!dateFilter ||
        formatInTimeZone(
          b.allocation.start_at,
          "Europe/Paris",
          "yyyy-MM-dd",
        ) === dateFilter) &&
      (remote
        ? ""
        : `${b.client.first_name} ${b.client.last_name} ${b.client.email} ${b.client.phone} ${b.service_name} ${localDate(b.allocation.start_at)}`
      )
        .toLowerCase()
        .includes(remote ? "" : q),
  );
  const title =
    navigation.find(([path]) => path === section)?.[1] || "Administration";
  const openBooking = (
    value?: ManagedBooking,
    start?: { date: string; time: string },
  ) => {
    setDialog({ kind: "booking", value, start });
    if (remote && value)
      fetch(snapshotUrl({ section: "rendez-vous", bookingId: value.id }), {
        cache: "no-store",
      })
        .then(async (r) => {
          if (!r.ok) throw Error("Historique indisponible.");
          const detail: Snapshot = await r.json();
          setData((old) => ({ ...old, audit: detail.audit }));
        })
        .catch((e) => setError(e.message));
  };
  let content: React.ReactNode;
  if (section === "") {
    const upcoming = data.bookings.filter(
      (b) =>
        b.status === "confirmed" &&
        b.allocation.start_at > new Date().toISOString(),
    );
    const simulated = data.bookings
      .filter((b) => b.payment?.status === "mock_paid")
      .reduce((n, b) => n + b.price_cents, 0);
    const received = data.bookings.reduce(
      (n, b) =>
        n +
        (b.payment?.provider === "stripe" &&
        [
          "paid",
          "partial_refund",
          "refunded",
          "refund_pending",
          "reconciliation",
        ].includes(b.payment.status)
          ? b.payment.amount_cents - (b.payment.refunded_cents || 0)
          : !b.payment && b.offline_status === "paid_offline"
            ? b.price_cents
            : 0),
      0,
    );
    content = (
      <>
        <div className="management-stats">
          {[
            [data.summary?.upcoming ?? upcoming.length, "Rendez-vous à venir"],
            [data.summary?.clients ?? data.clients.length, "Clientes"],
            [
              data.summary?.pending ??
                data.bookings.filter((b) => b.status === "pending").length,
              "En attente de paiement",
            ],
            [
              euro(remote ? (data.summary?.received ?? received) : simulated),
              remote
                ? "Encaissé (Stripe / hors ligne)"
                : "Paiements simulés · 0 € encaissé",
            ],
          ].map(([v, l]) => (
            <div key={l}>
              <strong>{v}</strong>
              <span>{l}</span>
            </div>
          ))}
        </div>
        <div className="management-two-columns">
          <section className="management-card">
            <h2>Vos prochains rendez-vous</h2>
            {upcoming.slice(0, 8).map((b) => (
              <button
                className="upcoming-row"
                key={b.id}
                onClick={() => openBooking(b)}
              >
                <span>{localDate(b.allocation.start_at)}</span>
                <strong>
                  {b.client.first_name} {b.client.last_name}
                </strong>
                <small>{b.service_name}</small>
              </button>
            ))}
            {!upcoming.length && (
              <p>
                Aucun rendez-vous à venir. Configurez vos horaires puis créez
                votre premier rendez-vous.
              </p>
            )}
            <Link href="/admin/planning" className="management-link">
              Ouvrir le planning →
            </Link>
          </section>
          <section className="management-card">
            <h2>Prêt à tester</h2>
            <ul className="readiness-list">
              <li>✓ Stockage {remote ? "Supabase" : "SQLite"} persistant</li>
              <li>
                {data.hours.length ? "✓" : "○"} Horaires d’ouverture configurés
              </li>
              <li>✓ Réservations protégées par transaction</li>
              <li>✓ Paiement fictif distinct d’un encaissement réel</li>
              <li>✓ Aucun envoi externe</li>
            </ul>
            <Link href="/reservation" className="management-primary">
              Voir le calendrier public
            </Link>
            <p className="management-hint">
              Les données de démonstration ne se chargent jamais
              automatiquement.
            </p>
            <button
              disabled={remote}
              className="management-secondary"
              onClick={() =>
                perform(
                  { action: "demo_load", data: { confirmed: true } },
                  "Charger ou recharger uniquement le jeu de rendez-vous fictifs ? Les données saisies manuellement sont conservées. Les horaires de démonstration seront ajoutés uniquement si aucun horaire n’existe.",
                )
              }
            >
              Charger le jeu de démonstration
            </button>
          </section>
        </div>
        <section className="management-card">
          <h2>Dernières notifications</h2>
          {data.notifications.slice(0, 4).map((n) => (
            <p key={n.id}>
              <strong>{n.title}</strong> · {n.message}
            </p>
          ))}
        </section>
      </>
    );
  } else if (section === "planning") {
    content = (
      <section className="management-card">
        <Planning
          onRangeChange={remote ? planningRange : undefined}
          data={data}
          onCreate={(v) => openBooking(undefined, v)}
          onOpen={(b) => openBooking(b)}
          onBlock={(a) => setDialog({ kind: "block", value: a })}
          onCreateBlock={(date) => setDialog({ kind: "block", date })}
        />
      </section>
    );
  } else if (section === "rendez-vous") {
    content = (
      <section className="management-card">
        <div className="management-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Rechercher un rendez-vous"
              placeholder="Cliente, prestation, téléphone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrer par statut"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(statuses).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            aria-label="Filtrer par date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
        <BookingTable rows={rows} onOpen={(b) => openBooking(b)} />
      </section>
    );
  } else if (section === "clientes") {
    content = (
      <section className="management-card">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Rechercher une cliente"
            placeholder="Nom, email, téléphone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="management-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Coordonnées</th>
                <th>Rendez-vous</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.clients
                .filter((c) =>
                  `${c.first_name} ${c.last_name} ${c.email} ${c.phone}`
                    .toLowerCase()
                    .includes(q),
                )
                .map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>
                        {c.first_name} {c.last_name}
                      </strong>
                      {c.demo && (
                        <span className="management-tag">Fictive</span>
                      )}
                    </td>
                    <td>
                      {c.email}
                      <br />
                      {c.phone}
                    </td>
                    <td>
                      {c.booking_count ??
                        data.bookings.filter((b) => b.client_id === c.id)
                          .length}
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setDialog({ kind: "client", value: c });
                          if (remote)
                            setScope({
                              section: "clientes",
                              clientId: c.id,
                              page: "0",
                            });
                        }}
                      >
                        Ouvrir la fiche
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  } else if (section === "catalogue") {
    content = (
      <>
        <div className="management-tabs">
          <button
            className={tab === "services" ? "active" : ""}
            onClick={() => setTab("services")}
          >
            Prestations
          </button>
          <button
            className={tab === "products" ? "active" : ""}
            onClick={() => setTab("products")}
          >
            Produits
          </button>
          <button
            className="management-secondary"
            onClick={() =>
              setDialog({ kind: tab === "services" ? "service" : "product" })
            }
          >
            <Plus size={16} /> Ajouter{" "}
            {tab === "services" ? "une prestation" : "un produit"}
          </button>
        </div>
        <section className="management-card">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Rechercher dans le catalogue"
              placeholder="Nom ou catégorie…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="management-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Prix</th>
                  <th>{tab === "services" ? "Description" : "Stock / état"}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tab === "services"
                  ? data.services
                      .filter((s) =>
                        `${s.name} ${s.category}`.toLowerCase().includes(q),
                      )
                      .map((s) => (
                        <tr key={s.id}>
                          <td>
                            <strong>{s.name}</strong>
                          </td>
                          <td>{categoryLabel(s.category)}</td>
                          <td>
                            {s.price_cents === null ? "—" : euro(s.price_cents)}
                          </td>
                          <td>{serviceDescription(s)}</td>
                          <td>
                            <button
                              onClick={() =>
                                setDialog({ kind: "service", value: s })
                              }
                            >
                              Modifier
                            </button>
                          </td>
                        </tr>
                      ))
                  : data.products
                      .filter((p) => p.name.toLowerCase().includes(q))
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                          </td>
                          <td>
                            {
                              data.categories.find(
                                (c) => c.id === p.category_id,
                              )?.name
                            }
                          </td>
                          <td>{euro(p.price_cents)}</td>
                          <td>
                            {p.stock ?? "Non suivi"} · {p.status}
                          </td>
                          <td>
                            <button
                              onClick={() =>
                                setDialog({ kind: "product", value: p })
                              }
                            >
                              Modifier
                            </button>
                          </td>
                        </tr>
                      ))}
              </tbody>
            </table>
          </div>
          {tab === "products" && (
            <p className="management-hint">
              Les produits n’occupent aucun créneau. La vente en ligne réelle
              reste désactivée.
            </p>
          )}
        </section>
      </>
    );
  } else if (section === "categories") {
    content = (
      <section className="management-card">
        <div className="management-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Description</th>
                <th>Ordre</th>
                <th>État</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{categoryLabel(c.name)}</strong>
                  </td>
                  <td>{c.description || "—"}</td>
                  <td>{c.sort_order}</td>
                  <td>{c.active ? "Visible" : "Masquée"}</td>
                  <td>
                    <button
                      onClick={() => setDialog({ kind: "category", value: c })}
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  } else if (section === "indisponibilites") {
    content = (
      <section className="management-card">
        <p>
          Bloquez une période ou une récurrence. Tout conflit avec un
          rendez-vous ou une réservation provisoire est refusé avec la liste des
          périodes à résoudre.
        </p>
        <div className="management-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Période</th>
                <th>Motif interne</th>
                <th>Récurrence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.allocations
                .filter((a) => a.kind === "block" && a.state === "active")
                .sort((a, b) => a.start_at.localeCompare(b.start_at))
                .map((a) => (
                  <tr key={a.id}>
                    <td>
                      {localDate(a.start_at)}
                      <br />→ {localDate(a.end_at)}
                    </td>
                    <td>{a.reason || "—"}</td>
                    <td>{a.series_id ? "Hebdomadaire" : "Ponctuelle"}</td>
                    <td>
                      <button
                        onClick={() => setDialog({ kind: "block", value: a })}
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() =>
                          perform(
                            {
                              action: "block_delete",
                              data: {
                                id: a.id,
                                series: false,
                                confirmed: true,
                              },
                            },
                            "Supprimer uniquement cette indisponibilité ?",
                          )
                        }
                      >
                        Débloquer
                      </button>
                      {a.series_id && (
                        <button
                          onClick={() =>
                            perform(
                              {
                                action: "block_delete",
                                data: {
                                  id: a.id,
                                  series: true,
                                  confirmed: true,
                                },
                              },
                              "Supprimer toute la série récurrente ?",
                            )
                          }
                        >
                          Supprimer la série
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  } else if (section === "horaires") {
    content = (
      <>
        <HoursEditor data={data} perform={perform} />
        <BookingRules data={data} perform={perform} />
        <section className="management-card">
          <h2>Générer les disponibilités</h2>
          <p className="management-hint">
            Calcul serveur à partir des horaires, réservations et blocages.
            Cette action ne supprime jamais un rendez-vous. Le calendrier public
            recalcule toujours les créneaux en temps réel.
          </p>
          <EditForm
            label="Générer les disponibilités"
            onSubmit={async (f) => {
              const result = await perform({
                action: "generate",
                data: {
                  start_date: string(f, "start_date"),
                  end_date: string(f, "end_date"),
                  service_id: string(f, "service_id"),
                },
              });
              if (result) setGenerated(result as typeof generated);
            }}
          >
            <Input
              name="start_date"
              label="Début de la période"
              type="date"
              value={today()}
            />
            <Input
              name="end_date"
              label="Fin de la période"
              type="date"
              value={format(addDays(new Date(), 30), "yyyy-MM-dd")}
            />
            <Select
              name="service_id"
              label="Prestation"
              options={data.services
                .filter(eligible)
                .map((s) => ({ id: s.id, name: s.name }))}
            />
          </EditForm>
          {generated && (
            <div className="generated-summary" role="status">
              <strong>{generated.total} créneaux disponibles calculés.</strong>
              {generated.days.map((d) => (
                <details key={d.date}>
                  <summary>
                    {d.date} · {d.slots.filter((s) => s.available).length}{" "}
                    disponibles
                  </summary>
                  <div className="generated-slots">
                    {d.slots.map((s) => (
                      <span
                        key={s.start_at}
                        className={s.available ? "" : "unavailable"}
                      >
                        {formatInTimeZone(s.start_at, "Europe/Paris", "HH:mm")}
                      </span>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </>
    );
  } else if (section === "notifications") {
    content = (
      <section className="management-card">
        <p className="management-hint">
          {remote
            ? "Notifications internes et état de la file d’envoi. Les transports dépendent de la configuration serveur."
            : "Outbox locale uniquement. Les futurs canaux email et WhatsApp sont préparés, aucun envoi externe ne part depuis ce mode."}
        </p>
        {remote && (
          <button
            className="management-secondary"
            onClick={() =>
              perform(
                { action: "run_outbox", data: {} },
                "Traiter la file selon les transports autorisés dans la configuration serveur ?",
              )
            }
          >
            Traiter la file d’envoi
          </button>
        )}
        {data.notifications.map((n) => (
          <article
            className={`notification-row ${n.status === "unread" ? "unread" : ""}`}
            key={n.id}
          >
            <div>
              <span className="management-tag">
                {n.transport === "local" ? "Local" : n.transport} ·{" "}
                {n.status === "unread" ? "Non lue" : "Lue"}
              </span>
              <h3>{n.title}</h3>
              <p>{n.message}</p>
              <small>{localDate(n.created_at)}</small>
            </div>
            {n.status === "unread" && (
              <button
                onClick={() =>
                  perform({ action: "notification_read", data: { id: n.id } })
                }
              >
                Marquer comme lue
              </button>
            )}
            {remote &&
              ["failed", "unconfigured"].includes(n.delivery_status || "") && (
                <button
                  onClick={() =>
                    perform(
                      { action: "retry_notification", data: { id: n.id } },
                      "Reprogrammer cette notification ?",
                    )
                  }
                >
                  Reprogrammer l’envoi
                </button>
              )}
          </article>
        ))}
        {!data.notifications.length && (
          <p>Aucune notification pour le moment.</p>
        )}
      </section>
    );
  } else if (section === "messages") {
    content = (
      <section className="management-card">
        <h2>Messages du formulaire de contact</h2>
        <p className="management-hint">
          Retrouvez ici les demandes envoyées depuis le site. Cette section
          n’est pas reliée à votre boîte e-mail. « Répondre par e-mail » ouvre
          votre messagerie habituelle.
        </p>
        {data.messages.map((m) => (
          <article className="message-row" key={m.id}>
            <span className="management-tag">
              {m.status === "new" ? "Nouveau" : "Traité"}
            </span>
            <h2>{m.subject}</h2>
            <p>
              {m.first_name} · {m.email} · {m.phone}
            </p>
            <p className="message-text">{m.message}</p>
            <small>{localDate(m.created_at)}</small>
            <div className="actions">
              <a
                className="management-secondary"
                href={`mailto:${m.email}?subject=${encodeURIComponent(`Re : ${m.subject}`)}`}
              >
                Répondre par e-mail
              </a>
              <button
                onClick={() =>
                  perform({ action: "contact_processed", data: { id: m.id } })
                }
              >
                Marquer comme traité
              </button>
              <button
                onClick={() =>
                  perform(
                    {
                      action: "contact_delete",
                      data: { id: m.id, confirmed: true },
                    },
                    "Supprimer ce message local ?",
                  )
                }
              >
                Supprimer
              </button>
            </div>
          </article>
        ))}
        {!data.messages.length && <p>Aucun message reçu.</p>}
      </section>
    );
  } else {
    const s = data.settings;
    content = (
      <>
        <section className="management-card">
          <h2>Configuration générale et règles de réservation</h2>
          <EditForm
            onSubmit={(f) =>
              perform({
                action: "settings_save",
                data: {
                  name: s.name,
                  subtitle: s.subtitle,
                  slogan: string(f, "slogan"),
                  city: string(f, "city"),
                  ...Object.fromEntries(
                    [
                      "address",
                      "phone",
                      "email",
                      "whatsapp",
                      "website",
                      "instagram",
                      "tiktok",
                      "snapchat",
                    ].map((key) => [key, string(f, key).trim()]),
                  ),
                  slotStepMinutes: number(f, "slotStepMinutes"),
                  defaultDurationMinutes: number(f, "defaultDurationMinutes"),
                  noticeHours: number(f, "noticeHours"),
                  horizonDays: number(f, "horizonDays"),
                  planningStartHour: number(f, "planningStartHour"),
                  planningEndHour: number(f, "planningEndHour"),
                  localBookingEnabled: checked(f, "localBookingEnabled"),
                },
              })
            }
          >
            <p className="full">MONÉA · Institut de beauté</p>
            {(
              [
                ["address", "Adresse de l’établissement"],
                ["phone", "Téléphone professionnel (format +33…)"],
                ["email", "E-mail professionnel"],
                ["whatsapp", "WhatsApp professionnel (format +33…)"],
                ["website", "Domaine officiel validé (https://…)"],
                ["instagram", "Instagram (https://www.instagram.com/…)"],
                ["tiktok", "TikTok (https://www.tiktok.com/…)"],
                ["snapchat", "Snapchat (https://www.snapchat.com/…)"],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                name={key}
                label={label}
                value={s[key]}
                required={false}
              />
            ))}
            <p className="management-hint full">
              Laissez les coordonnées inconnues vides. Le domaine enregistré
              doit être validé avant publication des URLs de référencement.
            </p>
            <Input name="slogan" label="Slogan" value={s.slogan} />
            <Input name="city" label="Ville" value={s.city} />
            <Input
              name="slotStepMinutes"
              label="Intervalle des départs (minutes)"
              type="number"
              value={s.slotStepMinutes}
              min={5}
              max={120}
            />
            <Input
              name="defaultDurationMinutes"
              label="Durée par défaut des nouvelles prestations"
              type="number"
              value={s.defaultDurationMinutes}
              min={15}
              max={480}
            />
            <Input
              name="noticeHours"
              label="Délai minimal (heures)"
              type="number"
              value={s.noticeHours}
              min={0}
            />
            <Input
              name="horizonDays"
              label="Horizon de réservation (jours)"
              type="number"
              value={s.horizonDays}
              min={1}
              max={365}
            />
            <Input
              name="planningStartHour"
              label="Début de grille du planning (heure)"
              type="number"
              value={s.planningStartHour}
              min={0}
              max={22}
            />
            <Input
              name="planningEndHour"
              label="Fin de grille du planning (heure)"
              type="number"
              value={s.planningEndHour}
              min={1}
              max={24}
            />
            <Check
              name="localBookingEnabled"
              label="Activer les demandes publiques locales"
              value={s.localBookingEnabled}
            />
          </EditForm>
          {remote && (
            <details>
              <summary>
                Informations légales et ouverture des réservations
              </summary>
              <EditForm
                onSubmit={(f) =>
                  perform(
                    {
                      action: "settings",
                      data: {
                        ...s,
                        ...Object.fromEntries(
                          [
                            "legalName",
                            "legalAddress",
                            "registration",
                            "vatNumber",
                            "publisher",
                            "host",
                            "mediator",
                          ].map((key) => [key, string(f, key)]),
                        ),
                        ...Object.fromEntries(
                          [
                            "legalReady",
                            "privacyReady",
                            "pricesValidated",
                            "bookingEnabled",
                          ].map((key) => [key, checked(f, key)]),
                        ),
                        ...Object.fromEntries(
                          [
                            "checkoutMinutes",
                            "holdMinutes",
                            "retentionDays",
                          ].map((key) => [key, number(f, key)]),
                        ),
                      },
                    },
                    "Enregistrer les validations et règles d’ouverture ? Aucun paiement n’est déclenché par cet enregistrement.",
                  )
                }
              >
                {(
                  [
                    ["legalName", "Raison sociale"],
                    ["legalAddress", "Adresse légale"],
                    ["registration", "Immatriculation"],
                    ["vatNumber", "Numéro de TVA, si applicable"],
                    ["publisher", "Responsable de publication"],
                    ["host", "Hébergeur"],
                    ["mediator", "Médiateur"],
                  ] as const
                ).map(([key, label]) => (
                  <Input
                    key={key}
                    name={key}
                    label={label}
                    value={s[key]}
                    required={false}
                  />
                ))}
                <Input
                  name="checkoutMinutes"
                  label="Durée Checkout (minutes)"
                  type="number"
                  value={s.checkoutMinutes}
                  min={30}
                  max={60}
                />
                <Input
                  name="holdMinutes"
                  label="Rétention du créneau (minutes)"
                  type="number"
                  value={s.holdMinutes}
                  min={35}
                  max={120}
                />
                <Input
                  name="retentionDays"
                  label="Conservation avant anonymisation (jours)"
                  type="number"
                  value={s.retentionDays}
                  min={30}
                  max={3650}
                />
                {(
                  [
                    ["legalReady", "Mentions légales validées"],
                    ["privacyReady", "Confidentialité validée"],
                    ["pricesValidated", "Tarifs validés"],
                    ["bookingEnabled", "Réservations publiques activées"],
                  ] as const
                ).map(([key, label]) => (
                  <Check key={key} name={key} label={label} value={s[key]} />
                ))}
              </EditForm>
            </details>
          )}
        </section>
        <section className="management-card">
          <h2>Stockage, export et données fictives</h2>
          <p>
            {remote ? (
              "Données persistantes dans Supabase. Une seule administratrice, session Supabase Auth."
            ) : (
              <>
                SQLite persistant dans{" "}
                <code>.local/data/monea-development.sqlite</code>. Aucun
                effacement au démarrage. Une seule administratrice, session
                HttpOnly enregistrée côté serveur.
              </>
            )}
          </p>
          <a
            className="management-secondary"
            href="/api/admin/manage?export=json"
          >
            {remote
              ? "Exporter les données (JSON privé)"
              : "Exporter les données locales (JSON privé)"}
          </a>
          <p className="management-hint">
            L’export contient des données personnelles. Il exclut les sessions
            et secrets. Les paiements mock restent marqués comme fictifs pour
            toute migration future.
          </p>
          <button
            disabled={remote}
            className="management-secondary"
            onClick={() =>
              perform(
                { action: "demo_load", data: { confirmed: true } },
                "Recharger uniquement les données fictives ? Vos saisies manuelles sont conservées.",
              )
            }
          >
            Recharger le jeu de démonstration
          </button>
        </section>
        <section className="management-card">
          <h2>Historique des opérations</h2>
          <div className="management-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Entité</th>
                </tr>
              </thead>
              <tbody>
                {data.audit.slice(0, 100).map((a) => (
                  <tr key={a.id}>
                    <td>{localDate(a.created_at)}</td>
                    <td>{a.action}</td>
                    <td>{a.entity_id.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }
  const newAction = () =>
    section === "clientes"
      ? setDialog({ kind: "client" })
      : section === "categories"
        ? setDialog({ kind: "category" })
        : section === "catalogue"
          ? setDialog({ kind: tab === "products" ? "product" : "service" })
          : section === "indisponibilites"
            ? setDialog({ kind: "block" })
            : openBooking();
  return (
    <div className="management-shell">
      <aside className={`management-sidebar ${menu ? "is-open" : ""}`}>
        <Link href="/admin" className="management-brand">
          <BrandLogo light />
          <span>GESTION DE L’INSTITUT</span>
        </Link>
        <nav aria-label="Gestion de l’institut">
          {navigation.map(([path, label, Icon]) => (
            <Link
              href={`/admin${path ? "/" + path : ""}`}
              key={path}
              className={section === path ? "active" : ""}
              onClick={() => setMenu(false)}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/">↗ Voir le site public</Link>
          <button
            onClick={async () => {
              const r = await fetch("/api/admin/logout", { method: "POST" });
              if (r.ok) {
                router.push("/admin/connexion");
                router.refresh();
              }
            }}
          >
            <LogOut size={17} /> Déconnexion
          </button>
        </div>
      </aside>
      <div className="management-main">
        <header className="management-topbar">
          <button
            className="management-menu-button"
            aria-label="Navigation administratrice"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={22} />
          </button>
          <div>
            <p className="management-topbar-brand">
              <BrandLogo size={24} />
              <span>ESPACE PRIVÉ</span>
            </p>
            <h1>{title}</h1>
          </div>
          <span className="local-mode-pill">
            {remote ? "Supabase" : "Local · SQLite"}
          </span>
          {[
            "",
            "planning",
            "rendez-vous",
            "clientes",
            "catalogue",
            "categories",
            "indisponibilites",
          ].includes(section) && (
            <button className="management-primary" onClick={newAction}>
              <Plus size={17} />
              {section === "clientes"
                ? "Nouvelle cliente"
                : section === "categories"
                  ? "Nouvelle catégorie"
                  : section === "catalogue"
                    ? "Ajouter"
                    : section === "indisponibilites"
                      ? "Bloquer une période"
                      : "Nouveau rendez-vous"}
            </button>
          )}
        </header>
        <div className="local-mode-banner">
          {remote
            ? "Gestion Supabase · Les paiements simulés importés restent identifiés comme fictifs."
            : "Mode de développement local : paiements fictifs, données séparées de la production, aucun message externe."}
        </div>
        <div className="management-content">
          {notice && (
            <p className="management-success" role="status">
              {notice}
            </p>
          )}
          {error && (
            <div className="management-error" role="alert">
              <strong>{error}</strong>
              {conflicts.map((c) => (
                <p key={c.id}>
                  {localDate(c.start_at)} → {localDate(c.end_at)} ·{" "}
                  {data.bookings.find((b) => b.allocation_id === c.id)?.client
                    .first_name || "Blocage existant"}
                </p>
              ))}
            </div>
          )}
          {content}
        </div>
      </div>
      {remote &&
        data.pagination &&
        data.pagination.total > data.pagination.pageSize &&
        !dialog && (
          <div className="actions" aria-label="Pagination de la gestion">
            <button
              disabled={data.pagination.page === 0}
              onClick={() =>
                setScope((old) => ({
                  ...old,
                  page: String(Number(old.page || 0) - 1),
                }))
              }
            >
              Précédent
            </button>
            <span>
              Page {data.pagination.page + 1} /{" "}
              {Math.ceil(data.pagination.total / data.pagination.pageSize)}
            </span>
            <button
              disabled={
                (data.pagination.page + 1) * data.pagination.pageSize >=
                data.pagination.total
              }
              onClick={() =>
                setScope((old) => ({
                  ...old,
                  page: String(Number(old.page || 0) + 1),
                }))
              }
            >
              Suivant
            </button>
          </div>
        )}
      {dialog && (
        <Dialog
          title={
            dialog.kind === "booking"
              ? dialog.value
                ? "Fiche du rendez-vous"
                : "Nouveau rendez-vous"
              : dialog.kind === "client"
                ? "Fiche cliente"
                : dialog.kind === "service"
                  ? "Prestation"
                  : dialog.kind === "category"
                    ? "Catégorie"
                    : dialog.kind === "product"
                      ? "Produit"
                      : "Indisponibilité"
          }
          onClose={() => {
            setDialog(null);
            if (remote && scope.clientId) setScope({ section, page: "0" });
          }}
        >
          {error && (
            <p className="management-error" role="alert">
              {error}
              {conflicts.map((c) => (
                <span key={c.id}>
                  {localDate(c.start_at)} → {localDate(c.end_at)}
                </span>
              ))}
            </p>
          )}
          {dialog.kind === "booking" ? (
            <BookingEditor
              data={data}
              value={dialog.value}
              start={dialog.start}
              save={save}
              perform={perform}
            />
          ) : dialog.kind === "client" ? (
            <>
              <ClientEditor
                value={
                  remote
                    ? data.clients.find((c) => c.id === dialog.value?.id) ||
                      dialog.value
                    : dialog.value
                }
                save={save}
              />
              {remote && dialog.value && (
                <button
                  className="management-danger"
                  onClick={() =>
                    perform(
                      {
                        action: "anonymize",
                        data: { id: dialog.value!.id, confirmed: true },
                      },
                      "Anonymiser cette cliente et ses notes après contrôle du délai de conservation ?",
                    )
                  }
                >
                  Anonymiser la cliente
                </button>
              )}
              {dialog.value && (
                <>
                  <h3>Rendez-vous de cette cliente</h3>
                  <BookingTable
                    rows={data.bookings.filter(
                      (b) => b.client_id === dialog.value?.id,
                    )}
                    onOpen={(b) => openBooking(b)}
                  />
                  {remote &&
                    data.pagination &&
                    data.pagination.total > data.pagination.pageSize && (
                      <div className="actions">
                        <button
                          disabled={data.pagination.page === 0}
                          onClick={() =>
                            setScope((old) => ({
                              ...old,
                              page: String(Number(old.page || 0) - 1),
                            }))
                          }
                        >
                          Historique précédent
                        </button>
                        <button
                          disabled={
                            (data.pagination.page + 1) *
                              data.pagination.pageSize >=
                            data.pagination.total
                          }
                          onClick={() =>
                            setScope((old) => ({
                              ...old,
                              page: String(Number(old.page || 0) + 1),
                            }))
                          }
                        >
                          Historique suivant
                        </button>
                      </div>
                    )}
                </>
              )}
            </>
          ) : dialog.kind === "service" ? (
            <ServiceEditor data={data} value={dialog.value} save={save} />
          ) : dialog.kind === "category" ? (
            <CategoryEditor value={dialog.value} save={save} />
          ) : dialog.kind === "product" ? (
            <ProductEditor data={data} value={dialog.value} save={save} />
          ) : (
            <BlockEditor value={dialog.value} date={dialog.date} save={save} />
          )}
        </Dialog>
      )}
    </div>
  );
}
function BookingTable({
  rows,
  onOpen,
}: {
  rows: ManagedBooking[];
  onOpen: (b: ManagedBooking) => void;
}) {
  return (
    <div className="management-table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date / heure</th>
            <th>Cliente</th>
            <th>Prestations</th>
            <th>Statut</th>
            <th>Règlement</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>
                {localDate(b.allocation.start_at)}
                <br />
                <small>{b.duration_minutes} min</small>
              </td>
              <td>
                {b.client.first_name} {b.client.last_name}
                {b.demo && <span className="management-tag">Fictif</span>}
              </td>
              <td>
                {b.service_name}
                <br />
                {euro(b.price_cents)}
              </td>
              <td>
                <span className={`management-tag tag-${b.status}`}>
                  {statuses[b.status]}
                </span>
              </td>
              <td>
                {b.payment
                  ? b.payment.provider === "stripe"
                    ? `Stripe · ${b.payment.status}`
                    : b.payment.status === "mock_paid"
                      ? "Fictif accepté"
                      : `Mock · ${b.payment.status}`
                  : b.offline_status === "paid_offline"
                    ? "Payé hors ligne"
                    : "Non payé"}
              </td>
              <td>
                <button onClick={() => onOpen(b)}>Ouvrir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="management-empty">
          Aucun rendez-vous ne correspond à cette sélection.
        </p>
      )}
    </div>
  );
}
function ClientEditor({
  value,
  save,
}: {
  value?: Client;
  save: (action: string, data: unknown, confirm?: string) => Promise<unknown>;
}) {
  return (
    <>
      <EditForm
        onSubmit={(f) =>
          save("client_save", {
            id: value?.id,
            first_name: string(f, "first_name"),
            last_name: string(f, "last_name"),
            email: string(f, "email"),
            phone: string(f, "phone"),
            notes: string(f, "notes"),
          })
        }
      >
        <Input name="first_name" label="Prénom" value={value?.first_name} />
        <Input name="last_name" label="Nom" value={value?.last_name} />
        <Input name="email" label="Email" type="email" value={value?.email} />
        <Input name="phone" label="Téléphone" type="tel" value={value?.phone} />
        <Textarea
          name="notes"
          label="Notes privées (aucune donnée médicale)"
          value={value?.notes}
        />
      </EditForm>
      {value && (
        <button
          className="management-danger"
          onClick={() =>
            save(
              "client_delete",
              { id: value.id, confirmed: true },
              "Supprimer cette cliente sans historique ?",
            )
          }
        >
          Supprimer la cliente
        </button>
      )}
    </>
  );
}
function BookingEditor({
  data,
  value,
  start,
  save,
  perform,
}: {
  data: Snapshot;
  value?: ManagedBooking;
  start?: { date: string; time: string };
  save: (action: string, data: unknown, confirm?: string) => Promise<unknown>;
  perform: Perform;
}) {
  const [clientId, setClientId] = useState(value?.client_id || "");
  const [clientSearch, setClientSearch] = useState("");
  const [clientPage, setClientPage] = useState(0);
  const [clientTotal, setClientTotal] = useState(data.clients.length);
  const [clientOptions, setClientOptions] = useState(data.clients);
  useEffect(() => {
    if (data.provider !== "supabase") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        `/api/admin/manage?${new URLSearchParams({ section: "lookup", search: clientSearch, page: String(clientPage) })}`,
        { signal: controller.signal, cache: "no-store" },
      )
        .then(async (r) => {
          if (!r.ok) throw Error("Recherche indisponible.");
          const result: Snapshot = await r.json();
          setClientOptions((old) =>
            clientPage === 0 ? result.clients : [...old, ...result.clients],
          );
          setClientTotal(result.pagination?.total || 0);
        })
        .catch(() => {
          /* Existing choices remain available on transient errors. */
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [clientSearch, clientPage, data.provider]);
  const [selected, setSelected] = useState(
    value?.lines.map((l) => l.service_id) || [],
  );
  return (
    <>
      {value && (
        <div className="booking-summary">
          <strong>
            {value.client.first_name} {value.client.last_name}
          </strong>
          <p>
            {value.client.email} · {value.client.phone}
          </p>
          <p>
            {localDate(value.allocation.start_at)} →{" "}
            {localDate(value.allocation.end_at)}
          </p>
          <p>
            {value.service_name} · {euro(value.price_cents)} ·{" "}
            {statuses[value.status]}
          </p>
          <span className="management-tag">
            {value.payment
              ? `${value.payment.provider === "mock" ? "Paiement fictif" : "Paiement Stripe"} : ${value.payment.status}`
              : value.offline_status === "paid_offline"
                ? "Règlement hors ligne déclaré"
                : "Non payé"}
          </span>
        </div>
      )}
      <EditForm
        onSubmit={(f) =>
          save(
            "booking_save",
            {
              id: value?.id,
              client_id: clientId || undefined,
              client: clientId
                ? undefined
                : {
                    first_name: string(f, "first_name"),
                    last_name: string(f, "last_name"),
                    email: string(f, "email"),
                    phone: string(f, "phone"),
                  },
              service_ids: selected,
              start_at: (() => {
                const [date, time] = string(f, "start_at").split("T");
                return parisInstant(date, time);
              })(),
              request_id: crypto.randomUUID(),
              offline_status:
                value?.source === "online"
                  ? undefined
                  : string(f, "offline_status"),
              status: string(f, "status"),
              notes: string(f, "notes"),
              confirmed: !!value,
            },
            value
              ? "Confirmer les modifications du rendez-vous ? Aucun remboursement automatique."
              : undefined,
          )
        }
      >
        {data.provider === "supabase" && (
          <label className="full">
            Rechercher une cliente
            <input
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setClientPage(0);
              }}
            />
          </label>
        )}
        <label className="full">
          Cliente
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Créer une nouvelle cliente</option>
            {(data.provider === "supabase"
              ? [
                  ...(value &&
                  !clientOptions.some((c) => c.id === value.client_id)
                    ? [value.client]
                    : []),
                  ...clientOptions,
                ]
              : data.clients
            ).map((c) => (
              <option value={c.id} key={c.id}>
                {c.first_name} {c.last_name} · {c.email}
              </option>
            ))}
          </select>
        </label>
        {data.provider === "supabase" && clientOptions.length < clientTotal && (
          <button type="button" onClick={() => setClientPage((old) => old + 1)}>
            Afficher d’autres clientes
          </button>
        )}
        {!clientId && (
          <>
            <Input name="first_name" label="Prénom" />
            <Input name="last_name" label="Nom" />
            <Input name="email" label="Email" type="email" />
            <Input name="phone" label="Téléphone" type="tel" />
          </>
        )}
        <fieldset className="full service-checkboxes">
          <legend>Prestations consécutives</legend>
          {data.services
            .filter((s) => s.visibility)
            .map((s) => (
              <label
                key={s.id}
                className={`check ${!eligible(s) ? "disabled-service" : ""}`}
              >
                <input
                  type="checkbox"
                  value={s.id}
                  checked={selected.includes(s.id)}
                  disabled={!eligible(s)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, s.id]
                        : selected.filter((id) => id !== s.id),
                    )
                  }
                />
                <span>
                  {s.name}{" "}
                  <small>
                    {s.duration_minutes} min ·{" "}
                    {s.price_cents === null
                      ? "Sans tarif"
                      : euro(s.price_cents)}{" "}
                    {!eligible(s) ? "· réservation en ligne fermée" : ""}
                  </small>
                </span>
              </label>
            ))}
          <p>
            {selected.length} prestation(s) ·{" "}
            {selected.reduce(
              (n, id) =>
                n +
                (data.services.find((s) => s.id === id)?.duration_minutes || 0),
              0,
            )}{" "}
            min. Les prix sont figés à la création.
          </p>
        </fieldset>
        <Input
          name="start_at"
          label="Début (Europe/Paris)"
          type="datetime-local"
          value={
            value
              ? formatInTimeZone(
                  value.allocation.start_at,
                  "Europe/Paris",
                  "yyyy-MM-dd'T'HH:mm",
                )
              : `${start?.date || today()}T${start?.time || "10:00"}`
          }
        />
        <Select
          name="status"
          label="Statut du rendez-vous"
          value={value?.status || "confirmed"}
          options={Object.entries(statuses)
            .filter(([k]) =>
              [
                "pending",
                "confirmed",
                "completed",
                "cancelled",
                "no_show",
              ].includes(k),
            )
            .map(([id, name]) => ({ id, name }))}
        />
        {value?.source !== "online" && (
          <Select
            name="offline_status"
            label="Règlement manuel (sans Stripe)"
            value={value?.offline_status || "unpaid"}
            options={[
              { id: "unpaid", name: "Non payé" },
              { id: "paid_offline", name: "Payé hors ligne" },
            ]}
          />
        )}
        <Textarea
          name="notes"
          label="Note administrative privée"
          value={value?.notes}
        />
      </EditForm>
      {value && (
        <>
          <div className="actions">
            {value.payment?.provider === "stripe" &&
              [
                "paid",
                "partial_refund",
                "reconciliation",
                "refund_pending",
              ].includes(value.payment.status) && (
                <button
                  className="management-danger"
                  onClick={() =>
                    perform(
                      {
                        action: "refund",
                        data: { id: value.id, confirmed: true },
                      },
                      "Demander le remboursement intégral du montant restant auprès de Stripe ? Cette action peut retourner des fonds si Stripe est configuré.",
                    )
                  }
                >
                  Demander le remboursement intégral
                </button>
              )}
            <button
              className="management-danger"
              onClick={() =>
                save(
                  "booking_cancel",
                  {
                    id: value.id,
                    reason: "Annulation administrative",
                    confirmed: true,
                  },
                  "Annuler et libérer ce créneau ? Un paiement déjà reçu ne sera pas remboursé automatiquement.",
                )
              }
            >
              Annuler ce rendez-vous
            </button>
            {value.status === "cancelled" && !value.payment && (
              <button
                className="management-danger"
                onClick={() =>
                  save(
                    "booking_delete",
                    { id: value.id, confirmed: true },
                    "Supprimer définitivement ce rendez-vous manuel annulé ?",
                  )
                }
              >
                Supprimer le rendez-vous
              </button>
            )}
          </div>
          <h3>Historique des modifications</h3>
          <div className="booking-history">
            {data.audit
              .filter((a) => a.entity_id === value.id)
              .map((a) => (
                <details key={a.id}>
                  <summary>
                    {localDate(a.created_at)} · {a.action}
                  </summary>
                  <pre>{JSON.stringify(a.detail, null, 2)}</pre>
                </details>
              ))}
          </div>
          {data.notifications.some((n) => n.entity_id === value.id) && (
            <button
              className="management-secondary"
              onClick={() =>
                perform({
                  action: "notification_read",
                  data: {
                    id: data.notifications.find((n) => n.entity_id === value.id)
                      ?.id,
                  },
                })
              }
            >
              Marquer la notification liée comme lue
            </button>
          )}
        </>
      )}
    </>
  );
}
function CategoryEditor({
  value,
  save,
}: {
  value?: Category;
  save: (action: string, data: unknown, confirm?: string) => Promise<unknown>;
}) {
  return (
    <>
      <EditForm
        onSubmit={(f) =>
          save("category_save", {
            id: value?.id,
            name: string(f, "name"),
            description: string(f, "description"),
            image: string(f, "image"),
            sort_order: value?.sort_order ?? 0,
            active: value?.active ?? true,
          })
        }
      >
        <Input
          name="name"
          label="Nom de la catégorie"
          value={value ? categoryLabel(value.name) : ""}
        />
        <Textarea
          name="description"
          label="Description"
          value={value?.description}
        />
        <ImageField
          value={value?.image}
          fallback={value ? serviceVisual("", value.name) : undefined}
        />
      </EditForm>
      {value && (
        <button
          className="management-danger"
          onClick={() =>
            save(
              "category_delete",
              { id: value.id, confirmed: true },
              "Supprimer cette catégorie si aucune prestation ou produit ne l’utilise ?",
            )
          }
        >
          Supprimer la catégorie
        </button>
      )}
    </>
  );
}

function ServiceEditor({
  data,
  value,
  save,
}: {
  data: Snapshot;
  value?: ManagedService;
  save: (action: string, data: unknown, confirm?: string) => Promise<unknown>;
}) {
  return (
    <>
      <EditForm
        onSubmit={(f) => {
          const price =
            string(f, "price") === ""
              ? null
              : Math.round(number(f, "price") * 100);
          return save("service_save", {
            id: value?.id,
            name: string(f, "name"),
            category_id: string(f, "category_id"),
            description: string(f, "description"),
            price_cents: price,
            duration_minutes:
              value?.duration_minutes ?? data.settings.defaultDurationMinutes,
            image: string(f, "image"),
            sort_order: value?.sort_order ?? 0,
            visibility: value?.visibility ?? true,
            bookable: price !== null,
            operational_status:
              price !== null
                ? "active"
                : (value?.operational_status ?? "coming_soon"),
            qualification_requirement:
              value?.qualification_requirement ?? "none",
          });
        }}
      >
        <Input name="name" label="Nom de la prestation" value={value?.name} />
        <Select
          name="category_id"
          label="Catégorie"
          value={value?.category_id}
          options={data.categories.map((c) => ({
            id: c.id,
            name: categoryLabel(c.name),
          }))}
        />
        <Textarea
          name="description"
          label="Description"
          value={value ? serviceDescription(value) : ""}
        />
        <Input
          name="price"
          label="Prix TTC en euros"
          type="number"
          value={value?.price_cents == null ? "" : value.price_cents / 100}
          required={value?.price_cents !== null}
          min={1}
          step="0.01"
        />
        <ImageField
          value={value?.image}
          fallback={
            value ? serviceVisual(value.slug, value.category) : undefined
          }
        />
      </EditForm>
      {value && (
        <button
          className="management-danger"
          onClick={() =>
            save(
              "service_archive",
              { id: value.id, confirmed: true },
              "Archiver cette prestation ? Les rendez-vous et prix historiques restent conservés.",
            )
          }
        >
          Archiver la prestation
        </button>
      )}
      {value && (
        <button
          className="management-danger"
          onClick={() =>
            save(
              "service_delete",
              { id: value.id, confirmed: true },
              "Supprimer définitivement cette prestation ? Si elle figure dans des rendez-vous, archivez-la pour conserver leur historique.",
            )
          }
        >
          Supprimer la prestation
        </button>
      )}
    </>
  );
}
function ProductEditor({
  data,
  value,
  save,
}: {
  data: Snapshot;
  value?: Product;
  save: (action: string, data: unknown, confirm?: string) => Promise<unknown>;
}) {
  return (
    <>
      <EditForm
        onSubmit={(f) =>
          save("product_save", {
            id: value?.id,
            name: string(f, "name"),
            description: string(f, "description"),
            category_id: string(f, "category_id"),
            price_cents: Math.round(number(f, "price") * 100),
            image: string(f, "image"),
            status: string(f, "status"),
            stock: string(f, "stock") === "" ? null : number(f, "stock"),
          })
        }
      >
        <Input name="name" label="Nom du produit" value={value?.name} />
        <Select
          name="category_id"
          label="Catégorie"
          value={value?.category_id}
          options={data.categories.map((c) => ({ id: c.id, name: c.name }))}
        />
        <Textarea
          name="description"
          label="Description"
          value={value?.description}
        />
        <Input
          name="price"
          label="Prix en euros"
          type="number"
          min={0}
          step="0.01"
          value={(value?.price_cents || 0) / 100}
        />
        <Input
          name="stock"
          label="Stock (facultatif)"
          type="number"
          min={0}
          required={false}
          value={value?.stock ?? ""}
        />
        <Select
          name="status"
          label="État"
          value={value?.status || "active"}
          options={[
            { id: "active", name: "Actif" },
            { id: "archived", name: "Archivé" },
          ]}
        />
        <ImageField value={value?.image} />
      </EditForm>
      {value && (
        <button
          className="management-danger"
          onClick={() =>
            save(
              "product_delete",
              { id: value.id, confirmed: true },
              "Supprimer ce produit local ?",
            )
          }
        >
          Supprimer le produit
        </button>
      )}
      <p className="management-hint">
        La vente en ligne est désactivée. Aucun créneau n’est créé pour ce
        produit.
      </p>
    </>
  );
}
function BlockEditor({
  value,
  date,
  save,
}: {
  value?: Allocation;
  date?: string;
  save: (action: string, data: unknown, confirm?: string) => Promise<unknown>;
}) {
  const [start, setStart] = useState(
    value
      ? formatInTimeZone(value.start_at, "Europe/Paris", "yyyy-MM-dd'T'HH:mm")
      : (date || today()) + "T09:00",
  );
  const [end, setEnd] = useState(
    value
      ? formatInTimeZone(value.end_at, "Europe/Paris", "yyyy-MM-dd'T'HH:mm")
      : (date || today()) + "T10:00",
  );
  const [repeat, setRepeat] = useState("none");
  const [preset, setPreset] = useState<BlockPreset>(value ? "custom" : "hour");
  const applyPreset = (next: BlockPreset, from = start) => {
    setPreset(next);
    if (next === "custom") return;
    const period = blockPeriod(from, next);
    setStart(period.start);
    setEnd(period.end);
  };
  return (
    <>
      <fieldset className="block-presets">
        <legend>Quelle période souhaitez-vous bloquer ?</legend>
        <div className="block-preset-buttons">
          {(
            [
              ["hour", "Une heure"],
              ["day", "Une journée"],
              ["week", "Une semaine"],
              ["month", "Un mois entier"],
              ["halfday", "Une demi-journée"],
              ["weeks", "Deux semaines"],
              ["custom", "Personnalisé"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={preset === id}
              className={
                preset === id ? "management-primary" : "management-secondary"
              }
              onClick={() => applyPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <EditForm
        label="Enregistrer l’indisponibilité"
        onSubmit={(f) =>
          save(
            "block_save",
            {
              id: value?.id,
              start_at: (() => {
                const [d, t] = start.split("T");
                return parisInstant(d, t);
              })(),
              end_at: (() => {
                const [d, t] = end.split("T");
                return parisInstant(d, t);
              })(),
              reason: string(f, "reason"),
              repeat,
              repeat_until:
                repeat === "weekly" ? string(f, "repeat_until") : undefined,
            },
            value ? "Modifier cette occurrence du blocage ?" : undefined,
          )
        }
      >
        <label>
          {preset === "month" ? "Mois à bloquer" : "Début de l’indisponibilité"}
          <input
            type={
              preset === "month"
                ? "month"
                : ["hour", "custom"].includes(preset)
                  ? "datetime-local"
                  : "date"
            }
            value={
              preset === "month"
                ? start.slice(0, 7)
                : ["hour", "custom"].includes(preset)
                  ? start
                  : start.slice(0, 10)
            }
            onChange={(e) => {
              if (!e.target.value) return;
              const next =
                preset === "month"
                  ? e.target.value + "-01T00:00"
                  : ["hour", "custom"].includes(preset)
                    ? e.target.value
                    : e.target.value + "T00:00";
              if (preset === "custom") setStart(next);
              else applyPreset(preset, next);
            }}
            required
          />
        </label>
        <label>
          Reprise des disponibilités
          <input
            type="datetime-local"
            value={end}
            readOnly={preset !== "custom"}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </label>
        <Textarea name="reason" label="Motif interne" value={value?.reason} />
        <label>
          Récurrence
          <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            <option value="none">Aucune</option>
            <option value="weekly">Chaque semaine</option>
          </select>
        </label>
        {repeat === "weekly" && (
          <Input
            name="repeat_until"
            label="Répéter jusqu’au"
            type="date"
            value={format(
              addDays(new Date(start.slice(0, 10) + "T12:00:00"), 28),
              "yyyy-MM-dd",
            )}
          />
        )}
        <p className="full management-hint">
          Heures de Paris. La période est bloquée jusqu’à l’heure de reprise
          indiquée. Une semaine couvre sept jours à partir de la date choisie ;
          un mois entier couvre le mois sélectionné. Si un rendez-vous existe
          déjà sur cette période, le blocage sera refusé et le rendez-vous
          conservé.
        </p>
      </EditForm>
    </>
  );
}
function BookingRules({ data, perform }: { data: Snapshot; perform: Perform }) {
  const s = data.settings;
  return (
    <section className="management-card">
      <h2>Règles du calendrier</h2>
      <EditForm
        onSubmit={(f) =>
          perform({
            action: "settings_save",
            data: {
              ...s,
              slotStepMinutes: number(f, "slotStepMinutes"),
              defaultDurationMinutes: number(f, "defaultDurationMinutes"),
              noticeHours: number(f, "noticeHours"),
              horizonDays: number(f, "horizonDays"),
            },
          })
        }
      >
        <Input
          name="slotStepMinutes"
          label="Intervalle des départs (minutes)"
          type="number"
          min={5}
          max={120}
          value={s.slotStepMinutes}
        />
        <Input
          name="defaultDurationMinutes"
          label="Durée initiale des nouvelles prestations (minutes)"
          type="number"
          min={15}
          max={480}
          value={s.defaultDurationMinutes}
        />
        <Input
          name="noticeHours"
          label="Préavis minimal (heures)"
          type="number"
          min={0}
          max={720}
          value={s.noticeHours}
        />
        <Input
          name="horizonDays"
          label="Horizon de réservation (jours)"
          type="number"
          min={1}
          max={365}
          value={s.horizonDays}
        />
      </EditForm>
    </section>
  );
}
function HoursEditor({ data, perform }: { data: Snapshot; perform: Perform }) {
  return (
    <>
      <section className="management-card">
        <h2>Ouvertures hebdomadaires et pauses</h2>
        <p className="management-hint">
          Cochez les jours réellement ouverts. Une seconde plage permet de
          définir une pause. Les champs proposés ne deviennent effectifs
          qu’après enregistrement.
        </p>
        <EditForm
          onSubmit={(f) => {
            const hours = [];
            for (let day = 0; day < 7; day++) {
              if (!checked(f, `enabled_${day}`)) continue;
              hours.push({
                weekday: day,
                opens: string(f, `opens_${day}`),
                closes: string(f, `closes_${day}`),
              });
              if (checked(f, `second_${day}`))
                hours.push({
                  weekday: day,
                  opens: string(f, `opens2_${day}`),
                  closes: string(f, `closes2_${day}`),
                });
            }
            return perform({ action: "hours_save", data: { hours } });
          }}
        >
          <div className="full weekly-hours">
            {[
              "Dimanche",
              "Lundi",
              "Mardi",
              "Mercredi",
              "Jeudi",
              "Vendredi",
              "Samedi",
            ].map((label, day) => {
              const hours = data.hours
                .filter((h) => h.weekday === day)
                .sort((a, b) => a.opens.localeCompare(b.opens));
              return (
                <fieldset key={day}>
                  <legend>{label}</legend>
                  <Check
                    name={`enabled_${day}`}
                    label="Ouvert"
                    value={!!hours.length}
                  />
                  <Input
                    name={`opens_${day}`}
                    label="Ouverture"
                    type="time"
                    value={hours[0]?.opens || "09:00"}
                  />
                  <Input
                    name={`closes_${day}`}
                    label="Fin de première plage"
                    type="time"
                    value={hours[0]?.closes || "12:00"}
                  />
                  <Check
                    name={`second_${day}`}
                    label="Deuxième plage"
                    value={hours.length > 1}
                  />
                  <Input
                    name={`opens2_${day}`}
                    label="Reprise"
                    type="time"
                    value={hours[1]?.opens || "13:00"}
                  />
                  <Input
                    name={`closes2_${day}`}
                    label="Fermeture"
                    type="time"
                    value={hours[1]?.closes || "18:00"}
                  />
                </fieldset>
              );
            })}
          </div>
        </EditForm>
      </section>
      <section className="management-card">
        <h2>Horaires exceptionnels et jours fériés</h2>
        <EditForm
          onSubmit={(f) =>
            perform({
              action: "special_save",
              data: {
                date: string(f, "date"),
                reason: string(f, "reason"),
                intervals: checked(f, "closed")
                  ? []
                  : [
                      {
                        opens: string(f, "opens"),
                        closes: string(f, "closes"),
                      },
                    ],
              },
            })
          }
        >
          <Input
            name="date"
            label="Date exceptionnelle"
            type="date"
            value={today()}
          />
          <Input name="reason" label="Motif interne" required={false} />
          <Input name="opens" label="Ouverture" type="time" value="09:00" />
          <Input name="closes" label="Fermeture" type="time" value="18:00" />
          <Check name="closed" label="Fermer entièrement cette journée" />
        </EditForm>
        <p className="management-hint">
          Ces horaires remplacent ceux du jour. Ils ne suppriment aucun
          rendez-vous. Pour contrôler les conflits d’une fermeture, créez une
          indisponibilité.
        </p>
        {data.special.map((s) => (
          <div className="special-row" key={s.date}>
            <span>
              {s.date} ·{" "}
              {s.intervals.length
                ? s.intervals.map((i) => i.opens + " – " + i.closes).join(", ")
                : "Fermé"}{" "}
              · {s.reason}
            </span>
            <button
              onClick={() =>
                perform(
                  { action: "special_delete", data: { date: s.date } },
                  "Revenir aux horaires habituels pour ce jour ?",
                )
              }
            >
              Supprimer l’exception
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
