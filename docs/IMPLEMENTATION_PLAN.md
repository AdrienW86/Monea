# Plan de réalisation locale

Le dossier initial était vide. Le cahier des charges intégral et le flyer fournis ont été copiés dans `docs/` et `design/`.

1. Next.js App Router, TypeScript strict et Tailwind ; identité centralisée, catalogue de 16 prestations et pages publiques accessibles.
2. Postgres/Supabase : RLS fermée, administratrice unique, allocations communes avec exclusion GiST, RPC transactionnelles et audit.
3. Back-office SSR : agenda, rendez-vous manuels, fermetures, prestations, horaires, messages, notifications et paramètres.
4. Réservation publique : validation, quotas persistants, hold 35 minutes, Checkout 30 minutes, webhook signé, réconciliation et outbox.
5. Tests unitaires, SQL/intégration et navigateur ; build, lint et TypeScript ; documentation de branchement et de lancement.

## Contraintes et décisions

- Aucune inscription cliente, aucune inscription admin publique, aucun commit, push ou déploiement.
- Aucun paiement réel et aucun message externe pendant la réalisation : clés Stripe live refusées par défaut et en développement ; leur activation future exige le mode production et une autorisation explicite dans l’environnement. Les transports restent verrouillés par configuration explicite.
- Aucun horaire, identité légale, adresse, compte social ou avis inventé. Les fonctions dépendantes sont désactivées.
- Horaires UTC en stockage, Europe/Paris à l'affichage ; intervalle semi-ouvert pour autoriser les rendez-vous adjacents.
- Auth Supabase SSR + UUID admin en base, sans rôle déterminé par email ou métadonnées éditables.
- Absence initiale de Docker et de psql : rechercher une solution locale de test Postgres, sinon signaler précisément les vérifications non exécutées.

## Prérequis manquants

Supabase URL/clé publique/service_role, UUID admin réel, horaires réels, identité juridique et politique de conservation validées ; Stripe test et webhook ; numéro WhatsApp professionnel, configuration Cloud API et template approuvé ; fournisseur email et expéditeur vérifié. Voir `.env.example` et la checklist de lancement.
