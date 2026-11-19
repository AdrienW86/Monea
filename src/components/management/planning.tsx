"use client";
import { useState, useEffect } from "react";
import {
  addDays,
  addMonths,
  startOfMonth,
  startOfWeek,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import type { Snapshot, ManagedBooking, Allocation } from "@/lib/data/types";
import { parisInstant } from "@/lib/booking/time";
export const statuses: Record<string, string> = {
  pending: "En attente de paiement",
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absence cliente",
  expired: "Expiré",
  reconciliation: "À réconcilier",
};
const dateOf = (iso: string) =>
  formatInTimeZone(iso, "Europe/Paris", "yyyy-MM-dd");
const minuteOf = (iso: string) =>
  Number(formatInTimeZone(iso, "Europe/Paris", "H")) * 60 +
  Number(formatInTimeZone(iso, "Europe/Paris", "m"));
export function intervalsFor(data: Snapshot, date: string) {
  const special = data.special.find((s) => s.date === date);
  if (special) return special.intervals;
  const weekday = new Date(date + "T12:00:00").getDay();
  return data.hours.filter((h) => h.weekday === weekday);
}
export function Planning({
  data,
  onCreate,
  onOpen,
  onBlock,
  onCreateBlock,
  onRangeChange,
}: {
  data: Snapshot;
  onCreate: (value?: { date: string; time: string }) => void;
  onOpen: (b: ManagedBooking) => void;
  onBlock: (a?: Allocation) => void;
  onCreateBlock: (date: string) => void;
  onRangeChange?: (from: string, to: string) => void;
}) {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [date, setDate] = useState(() =>
    formatInTimeZone(new Date(), "Europe/Paris", "yyyy-MM-dd"),
  );
  const today = formatInTimeZone(new Date(), "Europe/Paris", "yyyy-MM-dd");
  const target = new Date(date + "T12:00:00");
  const first =
    view === "month"
      ? startOfWeek(startOfMonth(target), { weekStartsOn: 1 })
      : view === "week"
        ? startOfWeek(target, { weekStartsOn: 1 })
        : target;
  const days = Array.from(
    { length: view === "month" ? 42 : view === "week" ? 7 : 1 },
    (_, i) => format(addDays(first, i), "yyyy-MM-dd"),
  );
  const rangeStart = days[0],
    rangeEnd = days[days.length - 1];
  useEffect(() => {
    onRangeChange?.(rangeStart, rangeEnd);
  }, [onRangeChange, rangeStart, rangeEnd]);
  const previous = () =>
    setDate(
      format(
        view === "month"
          ? addMonths(target, -1)
          : addDays(target, view === "week" ? -7 : -1),
        "yyyy-MM-dd",
      ),
    );
  const next = () =>
    setDate(
      format(
        view === "month"
          ? addMonths(target, 1)
          : addDays(target, view === "week" ? 7 : 1),
        "yyyy-MM-dd",
      ),
    );
  const startMinute = data.settings.planningStartHour * 60,
    endMinute = data.settings.planningEndHour * 60,
    step = data.settings.slotStepMinutes,
    pixel = 1.15;
  const active = data.allocations.filter((a) => a.state === "active");
  const appointments = new Map(data.bookings.map((b) => [b.allocation_id, b]));
  return (
    <div className="planning">
      <div className="planning-toolbar">
        <button
          type="button"
          className="management-primary"
          onClick={() => onCreateBlock(date)}
        >
          Bloquer une période
        </button>
        <div className="planning-switch" aria-label="Vue du planning">
          {[
            ["day", "Journée"],
            ["week", "Semaine"],
            ["month", "Mois"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              aria-pressed={view === v}
              onClick={() => setView(v as typeof view)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="planning-navigation">
          <button aria-label="Période précédente" onClick={previous}>
            ←
          </button>
          <button onClick={() => setDate(today)}>Aujourd’hui</button>
          <button aria-label="Période suivante" onClick={next}>
            →
          </button>
          <label>
            <span className="sr-only">Date du planning</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || today)}
            />
          </label>
        </div>
      </div>
      <h2 className="planning-period">
        {format(target, view === "day" ? "EEEE d MMMM yyyy" : "MMMM yyyy", {
          locale: fr,
        })}
        <small>Europe/Paris · départs toutes les {step} min</small>
      </h2>
      <div className="planning-legend">
        <span className="legend-confirmed">Confirmé</span>
        <span className="legend-pending">En attente</span>
        <span className="legend-block">Indisponibilité</span>
        <span className="legend-closed">Fermé</span>
        <span>Créneau blanc = libre</span>
      </div>
      {view === "month" ? (
        <div className="planning-month">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <strong className="month-weekday" key={d}>
              {d}
            </strong>
          ))}
          {days.map((day) => {
            const count = data.bookings.filter(
              (b) =>
                dateOf(b.allocation.start_at) === day &&
                !["cancelled", "expired", "reconciliation"].includes(b.status),
            ).length;
            const intervals = intervalsFor(data, day);
            const closed =
              !intervals.length ||
              intervals.every((i) => {
                const a = parisInstant(day, i.opens),
                  b = parisInstant(day, i.closes);
                return active.some(
                  (v) => v.kind === "block" && v.start_at <= a && v.end_at >= b,
                );
              });
            return (
              <button
                className={`month-day ${day === today ? "is-today" : ""} ${day.slice(0, 7) !== date.slice(0, 7) ? "outside-month" : ""} ${closed ? "is-closed" : ""}`}
                key={day}
                onClick={() => {
                  setDate(day);
                  setView("day");
                }}
              >
                <strong>{Number(day.slice(-2))}</strong>
                <span>{count} RDV</span>
                <small>
                  {closed
                    ? "Fermé"
                    : count
                      ? "Partiellement réservé"
                      : "Disponibilités"}
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="planning-scroll">
          <div
            className={`time-calendar ${view === "day" ? "single-day" : ""}`}
            style={{
              gridTemplateColumns: `52px repeat(${days.length},minmax(${view === "day" ? 260 : 120}px,1fr))`,
            }}
          >
            <div className="calendar-corner" />
            {days.map((day) => (
              <button
                className={`time-day-heading ${day === today ? "is-today" : ""}`}
                key={day}
                onClick={() => {
                  setDate(day);
                  setView("day");
                }}
              >
                <span>
                  {format(new Date(day + "T12:00:00"), "EEE", { locale: fr })}
                </span>
                <strong>{Number(day.slice(-2))}</strong>
              </button>
            ))}
            <div
              className="calendar-hour-labels"
              style={{ height: (endMinute - startMinute) * pixel }}
            >
              {Array.from(
                { length: Math.ceil((endMinute - startMinute) / 60) },
                (_, i) => (
                  <span key={i} style={{ top: i * 60 * pixel }}>
                    {String(data.settings.planningStartHour + i).padStart(
                      2,
                      "0",
                    )}
                    :00
                  </span>
                ),
              )}
            </div>
            {days.map((day) => (
              <div
                className="time-day-lane"
                key={day}
                style={{ height: (endMinute - startMinute) * pixel }}
              >
                {Array.from(
                  { length: Math.ceil((endMinute - startMinute) / step) },
                  (_, i) => {
                    const minute = startMinute + i * step;
                    const time =
                      String(Math.floor(minute / 60)).padStart(2, "0") +
                      ":" +
                      String(minute % 60).padStart(2, "0");
                    let start = "";
                    try {
                      start = parisInstant(day, time);
                    } catch {
                      /* Heure inexistante lors du passage à l’heure d’été. */
                    }
                    const open =
                      !!start &&
                      intervalsFor(data, day).some(
                        (h) => time >= h.opens && time < h.closes,
                      );
                    const occupied = active.some(
                      (a) => a.start_at <= start && a.end_at > start,
                    );
                    return (
                      <button
                        className={`time-slot ${open ? "is-open" : "is-closed"}`}
                        key={time}
                        disabled={!open || occupied}
                        style={{ top: i * step * pixel, height: step * pixel }}
                        title={
                          open && !occupied
                            ? `Libre le ${day} à ${time}`
                            : "Indisponible"
                        }
                        aria-label={
                          open && !occupied
                            ? `Créer un rendez-vous le ${day} à ${time}`
                            : `Indisponible le ${day} à ${time}`
                        }
                        onClick={() => onCreate({ date: day, time })}
                      >
                        {open && !occupied && step >= 30 ? (
                          <span>{time}</span>
                        ) : null}
                      </button>
                    );
                  },
                )}
                {active
                  .filter(
                    (a) =>
                      dateOf(a.start_at) <= day &&
                      dateOf(
                        new Date(
                          new Date(a.end_at).getTime() - 1,
                        ).toISOString(),
                      ) >= day,
                  )
                  .map((a) => {
                    const top = Math.max(
                      startMinute,
                      dateOf(a.start_at) < day
                        ? startMinute
                        : minuteOf(a.start_at),
                    );
                    const bottom = Math.min(
                      endMinute,
                      dateOf(a.end_at) > day ? endMinute : minuteOf(a.end_at),
                    );
                    if (bottom <= top) return null;
                    const booking = appointments.get(a.id);
                    return (
                      <button
                        key={a.id}
                        className={`calendar-event ${a.kind === "block" ? "event-block" : `event-${booking?.status || "pending"}`}`}
                        style={{
                          top: (top - startMinute) * pixel,
                          height: Math.max(26, (bottom - top) * pixel - 2),
                        }}
                        onClick={() => (booking ? onOpen(booking) : onBlock(a))}
                        title={
                          booking
                            ? `${booking.client.first_name} ${booking.client.last_name} · ${booking.service_name}`
                            : `Indisponibilité : ${a.reason}`
                        }
                      >
                        <strong>
                          {booking ? booking.client.first_name : "Indisponible"}
                        </strong>
                        <span>
                          {booking
                            ? booking.service_name
                            : a.reason || "Blocage"}
                        </span>
                        <small>
                          {formatInTimeZone(
                            a.start_at,
                            "Europe/Paris",
                            "HH:mm",
                          )}{" "}
                          –{" "}
                          {formatInTimeZone(a.end_at, "Europe/Paris", "HH:mm")}
                          {booking ? " · " + statuses[booking.status] : ""}
                        </small>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
