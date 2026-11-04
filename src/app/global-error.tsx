"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{
          background: "#f8f3ed",
          color: "#131c1b",
          fontFamily: "Arial,sans-serif",
          padding: 40,
        }}
      >
        <main>
          <h1>Un instant…</h1>
          <p role="alert">
            Le site ne peut pas charger sa configuration. Aucune réservation
            n’est confirmée par cette page.
          </p>
          <button onClick={reset}>Réessayer</button>
        </main>
      </body>
    </html>
  );
}
