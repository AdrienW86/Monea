"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function MockPayment({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <div className="actions">
        {[
          ["success", "Simuler un paiement réussi"],
          ["failed", "Simuler un refus"],
          ["expired", "Simuler une expiration"],
        ].map(([result, label]) => (
          <button
            className={result === "success" ? "button" : "button outline"}
            key={result}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch("/api/payments/mock", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token, result }),
                });
                const data = await r.json();
                if (!r.ok) throw Error(data.error);
                router.push(`/reservation/retour?token=${token}`);
                router.refresh();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Simulation indisponible",
                );
                setBusy(false);
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p role="alert">{error}</p>
    </div>
  );
}
