"use client";
import { useState } from "react";
import Link from "next/link";
export function ContactForm({ enabled }: { enabled: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const f = new FormData(e.currentTarget);
        try {
          const res = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...Object.fromEntries(f),
              consent: f.get("consent") === "on",
            }),
          });
          const data = await res.json();
          setMessage(res.ok ? "Votre demande a été enregistrée." : data.error);
        } catch {
          setMessage(
            "Connexion impossible. Votre demande n’a pas été enregistrée.",
          );
        } finally {
          setBusy(false);
        }
      }}
      className="form-grid"
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
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
        />
      </label>
      <label>
        Téléphone (facultatif)
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label>
        Sujet
        <input name="subject" required minLength={3} maxLength={160} />
      </label>
      <label className="full">
        Votre message
        <textarea name="message" required minLength={10} maxLength={4000} />
      </label>
      <label className="honeypot" aria-hidden="true">
        Site web
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="check full">
        <input type="checkbox" name="consent" required />
        <span>
          J’ai lu la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>{" "}
          concernant le traitement de ma demande.
        </span>
      </label>
      <div className="full">
        <button disabled={!enabled || busy} className="button">
          {busy ? "Enregistrement…" : "Envoyer ma demande ↗"}
        </button>
        {!enabled && (
          <p className="help">Le formulaire de contact est indisponible.</p>
        )}
        <p className="form-message" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </form>
  );
}
