# Bilan du logiciel local — 28 octobre 2026

Les onze rubriques de gestion sont opérationnelles en mode local. L’authentification, le stockage SQLite, les allocations transactionnelles, les formulaires d’édition, le planning jour/semaine/mois et le parcours public avec paiement fictif fonctionnent sans Supabase ou Stripe. Aucun push, déploiement, paiement réel ou envoi externe.

## Accès

Serveur de travail vérifié sur **http://localhost:3210** ; connexion sur **http://localhost:3210/admin/connexion**. Identifiants dans `.env.local`, clés `LOCAL_ADMIN_EMAIL` et `LOCAL_ADMIN_PASSWORD`. Configuration locale générée sans impression des secrets. La base de travail ne contient pas de rendez-vous de test ajoutés par la recette : les scénarios utilisent des fichiers isolés. Charger explicitement les exemples depuis le tableau de bord, ou configurer ses propres horaires.

Stockage : `.local/data/monea-development.sqlite`, migrations versionnées, WAL, clés étrangères et exclusion des intervalles par triggers. Aucune réinitialisation au lancement. Export privé JSON complet dans Paramètres ; visuels importés dans `public/assets/uploads/`.

## Résultats vérifiés

| Contrôle | Résultat |
| --- | --- |
| TypeScript strict | Réussi |
| ESLint | Réussi |
| Vitest, SQLite et PostgreSQL embarqué | **80 tests réussis**, 10 fichiers |
| Playwright du logiciel local | **10 tests réussis**, ordinateur et mobile |
| Playwright du site public | **27 tests réussis**, ordinateur, tablette et mobile |
| Compilation `next build` | Réussie |
| Connexion au serveur de travail, export privé, préparation de migration et déconnexion | Réussis |

Les tests couvrent les 18 scénarios demandés. La persistance est vérifiée par fermeture/réouverture de la base. Deux workers SQLite indépendants tentent simultanément une allocation : une seule gagne. Les tests vérifient les déplacements, les blocages d’un jour/semaine/mois, les récurrences atomiques, les anciennes lignes tarifaires, les produits sans planning, les paiements simulés, la protection de l’administration, les projections publiques sans coordonnées et les qualifications.

Inspection réelle des captures Playwright : planning hebdomadaire et mensuel, fiche rendez-vous, formulaire catalogue, horaires et paiement fictif sur ordinateur et smartphone. Corrections : origine de développement Next.js, noms accessibles des listes, titre des dialogues, contraste de l’onglet sélectionné et mois entièrement visible sur smartphone. Le site public et ses cartes Polaroid conservent leur direction artistique.

Captures conservées : [semaine sur ordinateur](screenshots/gestion-locale/local-desktop-planning-week.png), [mois sur mobile](screenshots/gestion-locale/local-mobile-planning-month.png), [fiche mobile](screenshots/gestion-locale/local-mobile-booking.png), [catalogue](screenshots/gestion-locale/local-desktop-catalogue-form.png), [paiement fictif](screenshots/gestion-locale/local-desktop-mock-checkout.png). Les identités visibles appartiennent exclusivement aux fixtures isolées.

Sur Node 22.13, le moteur natif `node:sqlite` affiche un avertissement expérimental. La compilation et les tests passent avec cette version. Aucun autre service n’a été démarré pour SQLite. Les tests PostgreSQL utilisent des moteurs embarqués ; aucun compte Supabase distant n’a été sollicité.

## Passage ultérieur aux services réels

Le [guide d’exploitation et de migration](LOCAL_MANAGEMENT.md) détaille les commandes et la reprise des données. La migration SQL supplémentaire prépare catégories, produits, lignes figées et archive d’import avec RLS. Le script `local:prepare-import` vérifie l’export et prépare une archive privée idempotente, sans connexion externe et sans transformer un paiement fictif en paiement Stripe.

Le back-office avancé fonctionne actuellement avec SQLite. **Son raccordement complet à Supabase reste à réaliser et à recetter avant basculement** ; le back-office Supabase historique demeure conservé. Les réservations multiples distantes ne sont pas annoncées comme disponibles. Les archives ne promeuvent pas automatiquement les données fictives dans les tables de production.

Avant production : terminer cette adaptation distante, reprendre les données utiles avec contrôle des UUID et des chevauchements, configurer Supabase Auth et le compte unique, régler les paramètres juridiques et commerciaux, tester Stripe et son webhook en mode test, puis configurer les canaux WhatsApp/email et autoriser les envois. Les ventes de produits physiques restent désactivées.
