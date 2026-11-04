import Link from "next/link";
export default function NotFound() {
  return (
    <section className="section narrow">
      <p className="eyebrow">404</p>
      <h1>
        Une petite
        <br />
        <em>échappée.</em>
      </h1>
      <p>Cette page n’existe pas ou a changé d’adresse.</p>
      <Link className="button" href="/">
        Revenir à l’accueil
      </Link>
    </section>
  );
}
