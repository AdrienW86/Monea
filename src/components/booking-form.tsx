"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { euro, type Service } from "@/lib/catalogue";
type Slot = { start_at: string; end_at: string; available: boolean };
export function BookingForm({
  services,
  enabled,
  initial,
  checkoutMinutes,
  holdMinutes,
  localMode = false,
}: {
  services: Service[];
  enabled: boolean;
  initial?: string;
  checkoutMinutes: number;
  holdMinutes: number;
  localMode?: boolean;
}) {
  const [serviceId, setServiceId] = useState(
    initial && services.some((s) => s.id === initial)
      ? initial
      : services[0]?.id || "",
  );
  const [category, setCategory] = useState(
    initial
      ? services.find((s) => s.id === initial)?.category ||
          services[0]?.category ||
          ""
      : services[0]?.category || "",
  );
  const [date, setDate] = useState(() =>
    formatInTimeZone(new Date(), "Europe/Paris", "yyyy-MM-dd"),
  );
  const [week, setWeek] = useState(date);
  const [days, setDays] = useState<{ date: string; slots: Slot[] }[]>([]);
  const slots = days.find((d) => d.date === date)?.slots || [];
  const [slot, setSlot] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const service = services.find((s) => s.id === serviceId);
  useEffect(() => {
    if (!enabled || !serviceId) return;
    const controller = new AbortController();
    fetch(`/api/availability?service=${serviceId}&date=${week}&days=7`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setDays(d.days);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setMessage("Les disponibilités ne sont pas accessibles.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [enabled, serviceId, week]);
  return (
    <div className="booking-layout">
      <div>
        {localMode && (
          <p className="notice">
            Paiement simulé : aucun débit et aucun message envoyé.
          </p>
        )}
        <div className="steps">
          <span>01 · Prestation</span>
          <span>02 · Créneau</span>
          <span>03 · {localMode ? "Simulation" : "Paiement sécurisé"}</span>
        </div>
        <label>
          Votre catégorie
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setServiceId(
                services.find((s) => s.category === e.target.value)?.id || "",
              );
              setSlot("");
              setDays([]);
              setLoading(true);
            }}
          >
            {[...new Set(services.map((s) => s.category))].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Votre prestation
          <select
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setSlot("");
              setDays([]);
              setLoading(true);
            }}
          >
            {services
              .filter((s) => s.category === category)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        {!enabled && (
          <p className="notice">
            La réservation et le paiement en ligne sont indisponibles.
          </p>
        )}
        <div className="calendar-head">
          <button
            aria-label="Semaine précédente"
            disabled={!enabled}
            onClick={() => {
              setSlot("");
              setDays([]);
              setLoading(true);
              setWeek(
                format(addDays(new Date(week + "T12:00:00"), -7), "yyyy-MM-dd"),
              );
            }}
          >
            ←
          </button>
          <strong>
            {format(new Date(week + "T12:00:00"), "MMMM yyyy", { locale: fr })}
          </strong>
          <button
            aria-label="Semaine suivante"
            disabled={!enabled}
            onClick={() => {
              setSlot("");
              setDays([]);
              setLoading(true);
              setWeek(
                format(addDays(new Date(week + "T12:00:00"), 7), "yyyy-MM-dd"),
              );
            }}
          >
            →
          </button>
        </div>
        <div className="week-grid">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(new Date(week + "T12:00:00"), i);
            const iso = format(d, "yyyy-MM-dd");
            return (
              <button
                className={`day-button ${date === iso ? "selected" : ""}`}
                key={iso}
                disabled={
                  !enabled ||
                  !days
                    .find((d) => d.date === iso)
                    ?.slots.some((s) => s.available) ||
                  iso <
                    formatInTimeZone(new Date(), "Europe/Paris", "yyyy-MM-dd")
                }
                aria-pressed={date === iso}
                onClick={() => {
                  setDate(iso);
                  setSlot("");
                  setLoading(false);
                }}
              >
                {format(d, "EEE", { locale: fr })}
                <span>{format(d, "dd")}</span>
              </button>
            );
          })}
        </div>
        <div aria-live="polite">
          {loading && enabled ? (
            <p>Recherche des disponibilités…</p>
          ) : enabled && slots.length === 0 ? (
            <p className="notice">Aucun créneau ouvert ce jour.</p>
          ) : null}
        </div>
        <div className="slots">
          {slots.map((s) => (
            <button
              key={s.start_at}
              disabled={!s.available}
              className={`slot ${slot === s.start_at ? "selected" : ""}`}
              aria-pressed={slot === s.start_at}
              onClick={() => setSlot(s.start_at)}
            >
              {formatInTimeZone(s.start_at, "Europe/Paris", "HH:mm")}
              {!s.available && <span className="sr-only"> indisponible</span>}
            </button>
          ))}
        </div>
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            const form = new FormData(e.currentTarget);
            const fingerprint = JSON.stringify({
              serviceId,
              slot,
              client: Object.fromEntries(form),
            });
            if (attempt.current?.fingerprint !== fingerprint)
              attempt.current = { fingerprint, id: crypto.randomUUID() };
            try {
              const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...Object.fromEntries(form),
                  service_id: serviceId,
                  start_at: slot,
                  request_id: attempt.current.id,
                  consent: form.get("consent") === "on",
                }),
              });
              const result = await res.json();
              if (
                res.ok &&
                typeof result.url === "string" &&
                /^\/reservation\/retour\?token=[a-f0-9-]+$/i.test(result.url)
              ) {
                window.location.assign(result.url);
              } else if (
                res.ok &&
                localMode &&
                result.provider === "mock" &&
                /^\/paiement-local\?token=[a-f0-9-]+$/i.test(result.url)
              ) {
                window.location.assign(result.url);
              } else if (
                res.ok &&
                typeof result.url === "string" &&
                new URL(result.url).hostname === "checkout.stripe.com"
              ) {
                window.location.assign(result.url);
              } else {
                setMessage(result.error || "Paiement indisponible.");
                if (res.status === 409) setSlot("");
              }
            } catch {
              setMessage(
                "Connexion interrompue. Aucune confirmation de paiement reçue.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Prénom
            <input
              name="first_name"
              required
              autoComplete="given-name"
              maxLength={80}
            />
          </label>
          <label>
            Nom
            <input
              name="last_name"
              required
              autoComplete="family-name"
              maxLength={80}
            />
          </label>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Téléphone
            <input name="phone" type="tel" required autoComplete="tel" />
          </label>
          <label className="honeypot" aria-hidden="true">
            Site
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="check full">
            <input name="consent" type="checkbox" required />
            <span>
              J’ai lu la{" "}
              <Link href="/confidentialite">politique de confidentialité</Link>.
              Je comprends que seul le paiement confirmé réserve le rendez-vous.
            </span>
          </label>
          <p className="full help">
            Avant de payer : {service?.name} · {service?.duration_minutes} min ·{" "}
            {service && service.price_cents !== null
              ? euro(service.price_cents)
              : "—"}{" "}
            TTC
            {slot
              ? ` · ${formatInTimeZone(slot, "Europe/Paris", "dd/MM/yyyy HH:mm")}`
              : ""}
            . Annuler un rendez-vous ne déclenche pas automatiquement un
            remboursement.
          </p>
          <button className="button full" disabled={!enabled || !slot || busy}>
            {busy
              ? "Préparation du paiement…"
              : enabled
                ? localMode
                  ? "Continuer vers le paiement fictif →"
                  : `Payer ${service && service.price_cents !== null ? euro(service.price_cents) : ""} sur Stripe ↗`
                : "Paiement indisponible pour le moment"}
          </button>
          <p role="status" className="full form-message">
            {message}
          </p>
        </form>
      </div>
      <aside className="booking-aside">
        <p className="eyebrow">VOTRE PARENTHÈSE</p>
        <h2>{service?.name || "Choisir une prestation"}</h2>
        <p>{service?.duration_minutes} minutes</p>
        <p>
          {service && service.price_cents !== null
            ? euro(service.price_cents) + " TTC"
            : "—"}
        </p>
        <hr />
        <p className="small-text">
          Le créneau est retenu pendant {holdMinutes} minutes. Le paiement
          Checkout expire après {checkoutMinutes} minutes.
        </p>
        <p className="help">
          Aucun compte nécessaire.
          <br />
          Horaires en Europe/Paris.
          <br />
          Confirmation après vérification du paiement.
        </p>
      </aside>
    </div>
  );
}
