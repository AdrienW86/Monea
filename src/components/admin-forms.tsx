"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { parisInstant } from "@/lib/booking/time";
type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number | boolean;
  options?: { value: string; label: string }[];
  required?: boolean;
};
export function AdminForm({
  action,
  fields,
  submit = "Enregistrer",
  confirm = false,
  staticData = {},
  jsonFields = [],
}: {
  action: string;
  fields: Field[];
  submit?: string;
  confirm?: boolean;
  staticData?: Record<string, unknown>;
  jsonFields?: string[];
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          confirm &&
          !window.confirm(
            "Confirmer cette action ? Une annulation de rendez-vous ne déclenche aucun remboursement.",
          )
        )
          return;
        setBusy(true);
        setMessage("");
        try {
          const f = new FormData(e.currentTarget);
          const data: Record<string, unknown> = { ...staticData };
          fields.forEach((field) => {
            const value = f.get(field.name);
            data[field.name] =
              field.type === "checkbox"
                ? value === "on"
                : field.type === "number"
                  ? value === ""
                    ? null
                    : Number(value)
                  : field.type === "datetime-local"
                    ? (() => {
                        const [day, time] = String(value).split("T");
                        return parisInstant(day, time);
                      })()
                    : jsonFields.includes(field.name)
                      ? JSON.parse(String(value))
                      : value;
          });
          if (action === "manual") data.request_id = crypto.randomUUID();
          if (confirm) data.confirmed = true;
          const res = await fetch("/api/admin/mutate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, data }),
          });
          const body = await res.json();
          setMessage(res.ok ? "Modification enregistrée." : body.error);
          if (res.ok) router.refresh();
        } catch {
          setMessage(
            "Demande impossible. Vérifiez les champs et les horaires.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((f) =>
        f.type === "checkbox" ? (
          <label className="check" key={f.name}>
            <input type="checkbox" name={f.name} defaultChecked={!!f.value} />
            {f.label}
          </label>
        ) : (
          <label className={f.type === "textarea" ? "full" : ""} key={f.name}>
            {f.label}
            {f.options ? (
              <select name={f.name} defaultValue={String(f.value ?? "")}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                name={f.name}
                defaultValue={String(f.value ?? "")}
                required={f.required}
              />
            ) : (
              <input
                name={f.name}
                type={f.type || "text"}
                defaultValue={String(f.value ?? "")}
                required={f.required !== false}
              />
            )}
          </label>
        ),
      )}
      <div className="full">
        <button className="button small" disabled={busy}>
          {busy ? "Enregistrement…" : submit}
        </button>
        <p role="status" className="form-message">
          {message}
        </p>
      </div>
    </form>
  );
}
export function LoginForm({ enabled }: { enabled: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const f = new FormData(e.currentTarget);
          const r = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(f)),
          });
          if (r.ok) {
            router.push("/admin");
            router.refresh();
          } else {
            setMessage(
              "Connexion refusée. Vérifiez votre accès administratrice.",
            );
          }
        } catch {
          setMessage("Connexion indisponible.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label htmlFor="admin-password">Mot de passe</label>
      <div className="login-password-field">
        <input
          id="admin-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          minLength={8}
          required
        />
        <button
          type="button"
          className="password-toggle"
          aria-controls="admin-password"
          aria-label={
            showPassword
              ? "Masquer le mot de passe"
              : "Afficher le mot de passe"
          }
          onClick={() => setShowPassword((visible) => !visible)}
        >
          {showPassword ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
          {showPassword ? "Masquer" : "Afficher"}
        </button>
      </div>
      <div className="actions">
        <button className="button" disabled={!enabled || busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </div>
      {!enabled && (
        <p className="notice">
          Supabase Auth n’est pas configuré. Aucun accès de démonstration n’est
          ouvert.
        </p>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
export function Logout() {
  const router = useRouter();
  return (
    <button
      className="button small outline"
      onClick={async () => {
        const r = await fetch("/api/admin/logout", { method: "POST" });
        if (r.ok) {
          router.push("/admin/connexion");
          router.refresh();
        }
      }}
    >
      Déconnexion
    </button>
  );
}
