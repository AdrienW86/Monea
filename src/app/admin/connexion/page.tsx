import { PageIntro } from "@/components/site";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/admin-forms";
import { dbConfigured } from "@/lib/db/server";
import { localAuthConfigured, isLocalProvider } from "@/lib/data/provider";
export default function Login() {
  return (
    <section className="section">
      <div className="login">
        <BrandLogo />
        <PageIntro eyebrow="ESPACE PRIVÉ MONÉA" title="Bienvenue chez MONÉA.">
          <p>
            Connectez-vous pour gérer vos rendez-vous. Cet espace est réservé au
            seul compte autorisé.
          </p>
        </PageIntro>
        {isLocalProvider() && (
          <p className="notice">
            Connexion locale de développement · identifiants dans .env.local ·
            aucune donnée de production.
          </p>
        )}
        <LoginForm
          enabled={isLocalProvider() ? localAuthConfigured() : dbConfigured()}
        />
      </div>
    </section>
  );
}
