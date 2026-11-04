# Rapport de vérification locale

Réalisation et recette : **28 octobre 2026**, dans le workspace `monica-beauty`. Aucun service distant de l’utilisateur n’a été modifié. Aucun paiement réel, email, WhatsApp, commit, push ou déploiement.

## Fonctionnalités réalisées

| Périmètre | Implémentation |
|---|---|
| Public | Accueil éditorial responsive inspiré du flyer, catalogue filtrable de 16 prestations, fiches, réservation, retour Stripe, contact, cartes cadeaux sans achat, pages légales préparatoires, confidentialité, 404 et erreur |
| Identité | Configuration centralisée ; nom/logo/slogan/palette/coordonnées/canaux remplaçables dans les paramètres ; aucun contact ni horaire inventé |
| Catalogue | Prix/durée/catégorie/description/image/tri/visibilité/état administrables ; qualifications distinctes, attestations auditées, verrou spray tan et prestations à l’étude |
| Réservation | Semaine/jour, jours et créneaux indisponibles grisés, données minimales, Europe/Paris, préavis/fenêtre, jours spéciaux, prix/durée figés, validation serveur et quota persistant |
| Temps | Table commune, exclusion GiST semi-ouverte, verrous transactionnels communs pour éviter les inversions de verrouillage, holds expirables, blocages heure/jour/semaine/mois |
| Paiement | Checkout hébergé, clés de test par défaut, signature sur corps brut, déduplication, paiement asynchrone, expiration, reprise de session non attachée, réconciliation tardive, remboursement distinct et idempotent |
| Admin | Auth SSR et UUID unique en DB, agenda jour/semaine/mois, indicateurs, rendez-vous manuels, déplacement/annulation/notes, horaires/fermetures, messages, outbox, paramètres, CSV protégé, anonymisation contrôlée et audit |
| Notifications | Outbox transactionnelle après confirmation payée, modèle Meta, emails texte/HTML, retries bornés, verrou d’envoi externe, états non configurés/incertains honnêtes |
| Sécurité | RLS sur toutes les tables, écritures métier réservées au serveur, contrôle admin sur chaque action, CSRF par origine, Zod, cookies httpOnly, pas de cache privé, protections CSV/HTML, pas de secret navigateur |

## Résultats exécutés

- **54 tests Vitest réussis** : catalogue, normalisation, réglementation, fuseau été/hiver, validations, taille des requêtes, signatures Stripe, création Checkout interceptée, montant navigateur falsifié, transport WhatsApp intercepté, verrou live, calcul des encaissements après remboursement, migrations SQL et RLS.
- **Deux connexions PostgreSQL indépendantes** testées sur un serveur PostgreSQL Windows embarqué : la deuxième transaction attend le commit de la première, reçoit `23P01`, et une seule réservation existe. Le harness est une dépendance de développement (`embedded-postgres`, wrapper publié en beta), jamais utilisé comme stockage de l’application.
- SQL également exécuté sur **PGlite/Postgres WASM** : rendez-vous adjacent, conflits manuel/public et blocage/public, blocs 1/7/31 jours, expiration, qualification attestée, webhook idempotent, refus d’un montant incohérent, paiement tardif réattribué, snapshots stables, annulation sans remboursement, remboursement partiel, créneaux UTC lors des changements d’heure, contact/outbox et quotas.
- **14 tests Playwright réussis**, sur Chromium desktop et profil mobile : navigation réelle, catalogue/filtres/fiches, réservation indisponible, absence de fausse confirmation, admin inaccessible sans session, contact fermé, pages légales/cadeaux/404, origine étrangère, signature invalide et cron privé.
- **Axe WCAG A/AA/2.1 AA** : aucune violation détectée sur accueil, catalogue, réservation, contact, connexion et confidentialité, dans les deux profils. Des contrastes ont été corrigés pendant la recette. Cela ne remplace pas une revue d’accessibilité humaine.
- **TypeScript strict**, **ESLint** et **build Next.js de production** réussis.
- **Audit npm : aucune vulnérabilité connue** à la fin de la recette. La dépendance Zod initiale a été remplacée par une version corrigée. Lockfile présent.
- Captures : `docs/screenshots/accueil-desktop.png` et `accueil-mobile.png`.

## Limites de la preuve

La pile complète Supabase Auth/PostgREST n’a pas été démarrée : Docker est absent. Aucune URL/clé Supabase ni clé Stripe de test n’a été fournie. Il n’y a donc **pas de recette navigateur complète avec session admin réelle et Checkout Stripe réel de test**. Les RPC SQL, droits, contraintes et fonctions sont exécutés localement ; le SDK et les webhooks sont testés par interception et signature locale. L’outil Supabase Advisors n’a pas été exécuté contre un projet distant.

Les transports Meta/Resend sont préparés et testés avec `fetch` intercepté. Aucun message ne sort. Il faut vérifier le template, la version Graph API et les destinataires réels. Les reçus de livraison Meta ne sont pas synchronisés ; `sent` indique une acceptation par le fournisseur. Les résultats réseau ambigus demandent une reprise humaine pour éviter les doublons.

Les horaires hebdomadaires et les couleurs se gèrent par champs JSON validés dans l’admin. Les fichiers image doivent être ajoutés dans `public/assets/` puis sélectionnés par chemin local ; aucun upload de binaire ni édition d’asset n’est intégré au back-office. Les pages juridiques, cartes cadeaux et prestations à l’étude restent volontairement conditionnées aux vraies données et validations métier.

Le SEO de démonstration reste fermé (`noindex`, robots interdit, sitemap vide) ; le propriétaire doit le configurer pour un domaine et un établissement réels avant publication. La politique comptable, la suppression des messages de contact et la purge des sauvegardes/logs restent à valider et à organiser.

## Rejouer

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run build
npm.cmd audit
```

Les anciennes bases de test sont ignorées par Git dans `.local/`. Les nouvelles exécutions créent une base éphémère, vérifient que le chemin est sous `.local/`, puis arrêtent et nettoient leur serveur. Les tests navigateur réservent le port 3210. Aucun serveur d’un autre projet n’est arrêté.
