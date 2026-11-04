"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="section narrow">
      <h1>Un instant…</h1>
      <p role="alert">
        Les informations ne sont pas accessibles pour le moment. Aucune
        réservation n’a été confirmée par cette page.
      </p>
      <button className="button" onClick={reset}>
        Réessayer
      </button>
    </section>
  );
}
