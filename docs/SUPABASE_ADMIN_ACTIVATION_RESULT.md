# MONÉA — Activation administratrice, résultats du 1er novembre 2026

**Activation du compte et recette terminées.** Connexion réelle de la gérante confirmée dans Next.js, snapshot authentifié HTTP 200 avec provider Supabase, inscriptions fermées. L'instance principale reste SQLite/mock ; le backend Supabase n'est pas basculé pour le site principal.

## Opérations réalisées

Projet : `qnmpfswaeexpchietwzf`.

- Compte créé par l'utilisateur dans le Dashboard : `contact@institut-monea.fr`.
- UUID Auth vérifié : `3be2b6bf-443d-4b32-ab11-31bf5e995e21`.
- Vérifications SQL sans lecture du mot de passe : adresse correspondante, email confirmé, compte non anonyme et non banni, mot de passe configuré. Un seul compte Auth observé.
- Rattachement autorisé effectué et validé par COMMIT dans `public.admin_users`, après contrôles de l'identité, des réservations fermées et de l'absence d'une autre administratrice, sous verrou de table. Aucune identité remplacée. Une seule appartenance, `singleton=true`.
- Les réservations distantes restent désactivées. Catalogue, rendez-vous, paiements et allocations restent vides. Aucun import ou paiement effectué.
- `.env.local` inchangé : `DATA_PROVIDER=local`, `PAYMENT_PROVIDER=mock`.

## management_snapshot réellement déployé

Appel avec l'UUID administratrice vérifié sous `SET LOCAL ROLE service_role`, dans une transaction terminée par ROLLBACK. Résultat observé :

- `provider=supabase`, résultat JSON objet.
- Clés : allocations, audit, bookings, categories, clients, hours, messages, notifications, pagination, products, provider, services, settings, special, summary.
- Catégories, prestations, clientes, rendez-vous et horaires : tableaux vides, cohérents avec l'absence d'initialisation.
- Pagination : page 0, taille 50, total 0.
- Résumé : clientes 0, en attente 0, à venir 0, encaissements 0.
- Lecture après rollback : une administratrice conservée ; zéro rendez-vous, paiement et allocation ; réservations toujours fermées.

Ce premier test valide l'autorisation SQL et le contenu réel du snapshot. La vérification de session navigateur a ensuite réussi, comme indiqué ci-dessous.

## Accès refusés

Sur le véritable PostgreSQL, rôle authenticated avec un sujet sans appartenance administrateur, en transaction READ ONLY puis ROLLBACK :

- Aucune appartenance visible, aucune cliente visible.
- EXECUTE refusé sur `management_snapshot` et `repository_booking_status`.
- INSERT sur `admin_users` non autorisé.

Il s'agit d'un test du rôle SQL/RLS, sans création d'un second compte Auth. Les tests Next.js isolés antérieurs couvrent également le refus d'un compte Auth ordinaire ; aucune connexion distante d'un compte ordinaire n'est prétendue ici.

Dans la nouvelle recette locale connectée au vrai Supabase :

- `/admin/connexion` : HTTP 200.
- `/api/admin/manage` sans session : HTTP 401, garde réelle Next.js.
- `/api/admin/export` : HTTP 403 par le proxy de recette, cette route d'export écrivant un audit est exclue des essais.

## Session navigateur — réussite confirmée

L'utilisateur confirme que le tableau de bord s'affiche. Les traces techniques du serveur de recette confirment :

```text
nextjs_login : HTTP 200
authenticated_nextjs_snapshot : HTTP 200
provider : supabase
categories : 0 ; services : 0 ; bookings : 0
```

La dernière vérification SQL confirme `last_sign_in_at` renseigné pour l'UUID attendu et exactement une appartenance administratrice. Il s'agit bien d'une connexion réelle via le formulaire Next.js, Supabase Auth, contrôle d'appartenance puis RPC backend ; aucun mot de passe n'a été communiqué à l'agent.

Instance de recette distincte démarrée via `scripts/supabase-admin-session-check.mjs` :

- Adresse à utiliser : `http://127.0.0.1:3217/admin/connexion`.
- Next.js auxiliaire lié à loopback, variables du processus seulement : Supabase/mock, clés Stripe neutralisées, notifications externes désactivées.
- L'instance et la configuration SQLite principales restent inchangées.
- Le proxy de recette autorise connexion/déconnexion et consultation ; il refuse les autres POST et les exports. Il ne constitue pas une modification de l'autorisation de production.
- L'utilisateur saisit lui-même le mot de passe dans le formulaire. Les mots de passe, cookies et clés ne sont ni journalisés par le script ni copiés dans le rapport.
- Après login HTTP 200, le script vérifie automatiquement `/api/admin/manage?section=lookup` avec les cookies gardés en mémoire, et journalise uniquement statut/provider/comptes.
- Une connexion réelle crée les sessions/traces Auth et compteurs anti-abus usuels ; aucun scénario de mutation métier n'est lancé.

Script contrôlé par `node --check` et ESLint : réussis. Aucun code applicatif ou composant visuel modifié.

## Fermeture des inscriptions — vérifiée

Après intervention utilisateur, lecture effective du 1er novembre 2026 : `disable_signup=true`, fournisseur email actif. Les inscriptions publiques sont désormais fermées ; la connexion email/mot de passe reste activée.

L'utilisateur a effectué cette opération dans le Dashboard. La valeur a été vérifiée par `/auth/v1/settings`. Aucune tentative d'inscription distante n'a été utilisée comme test.

## Diagnostic du premier refus signalé

L'utilisateur a signalé « Connexion refusée. Vérifiez votre accès administratrice ». Les contrôles suivants ont été réalisés sans modifier le compte :

- UUID toujours seul membre de `admin_users`, email toujours confirmé.
- Aucun `last_sign_in_at`, aucune session Auth au moment du contrôle.
- Aucune tentative utilisateur observée dans le journal du proxy de recette ; son instrumentation fonctionne, vérifiée par un POST au corps vide rejeté avant toute authentification (HTTP 400).
- `http://127.0.0.1:3000/admin/connexion` affiche le mode local SQLite.
- `http://127.0.0.1:3217/admin/connexion` affiche la connexion de recette Supabase, HTTP 200.

Une connexion à l'instance SQLite avec les identifiants Supabase expliquerait le refus, mais l'URL du premier essai n'est pas connue. L'utilisateur a été invité à réessayer précisément le port 3217. Aucun diagnostic de mot de passe incorrect n'est établi, aucune réinitialisation n'est effectuée.

### Défaut de recette reproduit et corrigé

L'utilisateur a ensuite signalé que le clic ne produisait rien. Le test navigateur a reproduit un formulaire non hydraté : aucun handler React, aucun POST de connexion. Le proxy de recette refusait le WebSocket HMR attendu par Next.js en développement. Il refusait aussi l'image du logo située sous `/branding/`.

Correction limitée à `scripts/supabase-admin-session-check.mjs` : transmission du seul WebSocket `/_next/hmr`, avec contrôle d'Origin exact, et autorisation des assets `/branding/`. Les mutations métier restent bloquées ; aucun fichier applicatif, compte ou réglage distant modifié.

Vérification Playwright après redémarrage : formulaire hydraté, clic transmis au handler, réponse de refus affichée pour une réponse HTTP entièrement substituée, aucune erreur JavaScript, aucun paramètre de formulaire dans l'URL. Les identifiants de ce test sont synthétiques et le POST est intercepté avant réseau : aucun appel réel à Supabase Auth. ESLint réussi.

Le test avant correction a montré qu'un formulaire sans handler pouvait soumettre ses champs dans l'URL par le comportement HTML par défaut. Aucune valeur issue de la tentative utilisateur n'a été lue ni copiée dans ce rapport. L'utilisateur a été invité à utiliser une URL propre et à ne jamais communiquer une URL contenant `password=`.

Après correction, la nouvelle connexion utilisateur a réussi ; les preuves de session et de snapshot sont consignées ci-dessus.

## Contrôles de clôture

- Une seule administratrice, UUID attendu, connexion Auth effective.
- `disable_signup=true` et fournisseur email toujours actif, relus après la connexion réussie.
- Réservations publiques toujours désactivées.
- Zéro catégorie, prestation, rendez-vous, paiement et allocation : aucune initialisation métier réalisée.
- Configuration principale toujours `DATA_PROVIDER=local`, `PAYMENT_PROVIDER=mock`.
- Serveurs temporaires de recette arrêtés après vérification.
- Aucun mot de passe, cookie de session ou clé dans ce rapport.

Les écritures durables de cette activation se limitent au rattachement autorisé, au réglage Auth effectué par l'utilisateur, aux sessions/traces Auth et aux compteurs anti-abus normaux de la connexion. Le test SQL du snapshot a été annulé ; la consultation Next.js authentifiée a ensuite été effectuée sur le projet vide.

Aucune migration, activation des réservations, opération Stripe, import, modification visuelle ou déploiement.
