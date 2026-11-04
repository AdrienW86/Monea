"use client";
import { useRef } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
export function MobileMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details className="mobile-menu" ref={ref}>
      <summary aria-label="Ouvrir la navigation">
        <Menu size={23} />
      </summary>
      <nav
        aria-label="Navigation mobile"
        onClick={() => {
          if (ref.current) ref.current.open = false;
        }}
      >
        <Link href="/" aria-label="MONÉA · accueil">
          <BrandLogo />
        </Link>
        <Link href="/prestations">Les prestations</Link>
        <Link href="/#univers">L’univers beauté</Link>
        <Link href="/cartes-cadeaux">Cartes cadeaux</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </details>
  );
}
