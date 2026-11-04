# MONÉA — application locale

Site vitrine, catalogue, réservation sans compte cliente et back-office pour une administratrice / une ressource. L’identité MONÉA est temporaire. Aucun avis, horaire, compte social, adresse ou diplôme n’est inventé.

La [refonte photographique](docs/VISUAL_REDESIGN_REPORT.md) comprend un hero immersif, des collages et une version mobile recomposée. Le [hero mosaïque et les neuf visuels fournis](docs/PROVIDED_PACK_INTEGRATION.md) sont intégrés depuis le pack utilisateur. [Historique des assets et prompts](design/ASSETS.md).

La [finition visuelle actuelle](docs/VISUAL_FINISHING_REPORT.md) conserve les cartes Polaroid et donne la priorité à un portrait dominant, quatre vignettes distinctes et un bouton de réservation renforcé.

## Démarrer sans intégration

Node **22.13 ou supérieur** (versions LTS récentes recommandées). Sous PowerShell, utiliser `npm.cmd` si les scripts `.ps1` sont interdits.

```powershell
npm.cmd ci
npm.cmd run local:setup
npm.cmd run dev -- --port 3210
```

Ouvrir **http://localhost:3210/admin/connexion**. Les identifiants uniques sont générés dans `.env.local` (`LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD`) et ne sont jamais affichés par le script. Le mode `DATA_PROVIDER=local`, `PAYMENT_PROVIDER=mock` fonctionne sans compte externe. `local:setup` conserve les valeurs déjà définies : sur une ancienne configuration, régler explicitement ces deux variables. Le stockage SQLite persiste dans `.local/data/monea-development.sqlite`. Configurer les horaires dans l’administration ou charger explicitement le jeu fictif depuis le tableau de bord. [Guide complet et migration](docs/LOCAL_MANAGEMENT.md).

L’origine `NEXT_PUBLIC_APP_URL` doit correspondre exactement à l’URL du navigateur. L’authentification locale et les simulations de paiement sont refusées hors développement. Le serveur de production utilise `DATA_PROVIDER=supabase`, `PAYMENT_PROVIDER=stripe` avec ses propres secrets.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run test:e2e:local
npm.cmd run build
```

Playwright construit et lance son propre aperçu de production sur **127.0.0.1:3211**, dans `.next-qa`, refuse de réutiliser un serveur préexistant et l’arrête après les tests. Le serveur de développement sur 3210 reste indépendant. Les intégrations réelles sont explicitement désactivées dans cet aperçu. Les captures de refonte sont dans `docs/screenshots/refonte/`, en desktop 1440 px, tablette et smartphone 390 px. Aucun appel Stripe ou Meta réel n’est nécessaire pour les tests : les signatures sont générées localement et les transports sont interceptés.

## Supabase local

Docker Desktop est nécessaire à la pile Supabase complète ; il n’était pas installé sur le poste de réalisation. Une base Postgres embarquée et PGlite permettent néanmoins d’exécuter réellement les migrations et les contraintes pendant les tests.

Après installation de Docker par le propriétaire :

```powershell
npx.cmd supabase start
npx.cmd supabase db reset --local
npx.cmd supabase status
```

`db reset --local` détruit et recrée **uniquement la base de développement locale**. La migration s’applique une seule fois par historique ; un reset permet de la rejouer à neuf. Le seed est idempotent et ne contient que le catalogue, sans comptes ni horaires. Ne jamais lancer ce reset contre une base utile.

Reporter l’URL API locale, la clé publique et la clé `service_role` locale dans `.env.local`. Les secrets restent exclusivement côté serveur. Ajouter un sel aléatoire long dans `RATE_LIMIT_SALT` et un secret distinct dans `CRON_SECRET`.

### Créer le seul compte administratrice

Les inscriptions publiques sont désactivées dans `supabase/config.toml` ; conserver également ce réglage dans tout futur projet hébergé. Créer **un seul utilisateur** via Studio → Authentication → Users (création administrative, mot de passe robuste). Copier son UUID, puis exécuter dans l’éditeur SQL de cette base :

```sql
insert into public.admin_users(user_id) values ('UUID_REEL_CREE_DANS_AUTH');
```

La contrainte singleton refuse un second admin. L’UUID référence `auth.users`. Un email connu, `user_metadata` ou une session d’un autre utilisateur ne suffisent pas. Les pages privées et les routes vérifient `getUser()` et l’autorisation en base ; le proxy renouvelle les cookies. Les RPC métier sont réservées au `service_role`, utilisé après vérification admin ou validation du parcours public. Les tables privées ont la RLS activée ; `authenticated` n’a que la lecture autorisée à l’admin, aucun droit d’écriture direct.

Se connecter à `/admin/connexion`. Renseigner les vraies plages hebdomadaires dans Horaires ; plusieurs intervalles par jour représentent les pauses. Aucun horaire n’est initialisé. Les jours spéciaux remplacent les horaires habituels. Les blocages utilisent la même allocation temporelle que les rendez-vous et refusent tout chevauchement actif.

## Stripe test

Renseigner **uniquement des clés de test** : `STRIPE_SECRET_KEY=sk_test_…` et le secret retourné par Stripe CLI dans `STRIPE_WEBHOOK_SECRET`. Aucune clé publique Stripe n’est nécessaire : Checkout est hébergé.

```powershell
stripe listen --forward-to localhost:3210/api/webhooks/stripe
```

Créer une réservation depuis l’interface après configuration des horaires et validation des réglages. Utiliser la carte de test officielle `4242 4242 4242 4242`, une échéance future et un CVC de test. Une clé `sk_live_` est rejetée par défaut. L’autorisation de paiements live exige **à la fois** `NODE_ENV=production` et `ALLOW_LIVE_PAYMENTS=true`, à régler uniquement par le propriétaire après recette et validation du lancement. Rien de cela n’a été activé pendant la réalisation.

Événements attendus : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`. Corps brut et signature vérifiés. Seul `payment_status=paid` confirme. Une session créée mais non encore attachée est récupérable grâce aux métadonnées signées de Stripe : UUID du booking **et** clé de requête identique à celle persistée en base. Tout autre événement inconnu de la base provoque un HTTP 500 pour bénéficier du retry Stripe. Les événements traités sont dédupliqués transactionnellement.

Les montants et durées sont calculés et figés en base, jamais acceptés depuis le navigateur. Checkout propose uniquement la carte ; les événements asynchrones sont pris en charge par sécurité. Rétention par défaut **35 min**, expiration Checkout **30 min**, réglables dans Paramètres avec marge minimale de 5 min. Une erreur réseau ambiguë laisse expirer le hold ; elle n’annonce aucun paiement réussi. La reprise d’une session non attachée est testée. Les sessions qui ne peuvent être rattachées de manière sûre restent en échec et nécessitent une réconciliation administrative.

Un paiement tardif tente de réactiver son allocation. Si elle entre en conflit ou si le rendez-vous est annulé, le paiement passe en réconciliation et une alerte d’audit est créée. Il faut traiter son remboursement explicitement, sans écraser la réservation suivante. Annuler un rendez-vous **ne rembourse pas** ; le bouton distinct demande confirmation, trace l’action et utilise une clé de remboursement idempotente. La confirmation définitive du remboursement vient du webhook.

## WhatsApp et email

**Aucun envoi externe n’est activé par défaut.** Laisser `ENABLE_EXTERNAL_NOTIFICATIONS` vide ou `false` pendant toute la recette locale sans envoi. Les jobs restent marqués `unconfigured` et consultables en administration.

Le bouton public utilise le numéro professionnel réel renseigné dans Paramètres, normalisé E.164, puis construit un lien `wa.me` avec la prestation. Aucun numéro temporaire n’est fourni.

Pour le transport Meta, fournir les variables `WHATSAPP_*` de `.env.example`, un template **utility approuvé**, sa langue et une version de Graph API vérifiée dans le compte Meta. Le corps du modèle doit accepter **4 paramètres texte**, dans cet ordre : référence, prestation, date/heure Europe/Paris, prénom. Aucun détail sensible. `META_GRAPH_API_VERSION` reste volontairement vide : l’accès à la documentation Meta était limité pendant la réalisation ; aucune version n’a été inventée comme valeur de production. Valider une version supportée via le [changelog officiel Meta](https://developers.facebook.com/docs/graph-api/changelog/) et le test du modèle avant activation.

Pour Resend : renseigner `RESEND_API_KEY`, `EMAIL_FROM` (domaine vérifié) et `ADMIN_EMAIL`. Les confirmations vont à la cliente et les notifications de contact à l’admin, via des emails texte/HTML échappés. Aucun marketing.

L’outbox est réclamée avec `FOR UPDATE SKIP LOCKED`. Backoff exponentiel, 5 tentatives maximum, relance contrôlée dans l’admin. Un timeout ambigu passe en `uncertain` et ne se renvoie pas automatiquement : Meta ne fournit pas d’idempotence équivalente à celle de Stripe ; vérifier le fournisseur avant correction manuelle. Un HTTP accepté signifie accepté par le fournisseur, pas preuve de lecture ni de livraison au destinataire. Les reçus de livraison Meta ne sont pas synchronisés dans cette version.

### Maintenance

Appeler `POST /api/cron` chaque minute avec `Authorization: Bearer <CRON_SECRET>` pour expirer les holds et traiter l’outbox. Aucun ordonnanceur extérieur n’a été créé. L’administratrice peut aussi traiter la file depuis Notifications. Le nettoyage des holds se fait également lors de la consultation des disponibilités ou d’une création.

Le quota persistant est de 5 demandes de réservation/contact par fenêtre de 15 minutes, 8 connexions, 120 mutations admin. L’IP est hachée avec un sel serveur. En production, configurer le reverse proxy pour écraser `x-real-ip`, empêcher l’accès direct à l’origine et fixer une limite de taille des corps HTTP (32 Ko pour les formulaires, 1 Mo pour Stripe). Sans IP transmise, le quota est partagé et restrictif. Prévoir une purge périodique des anciens buckets et une supervision des échecs de webhook/outbox.

## Personnalisation et données

- Marque initiale, tokens et images : `src/config/brand.ts`. Le nom, logo, slogan, palette, coordonnées et canaux peuvent ensuite être remplacés dans Paramètres.
- Placer les images réelles et autorisées dans `public/assets/` puis renseigner leur chemin local. Les URL distantes arbitraires sont refusées pour éviter le SSRF. Les images de service sont facultatives ; le fichier doit être ajouté localement par le propriétaire (pas d’upload de fichier depuis le back-office).
- Le flyer fourni est archivé dans `design/reference-flyer.png` et sert uniquement de référence artistique. Aucun recadrage du flyer n’est publié. Les neuf photographies actives du pack utilisateur se trouvent dans `public/images/beauty/` ; les précédentes restent archivées dans `public/assets/beauty/`. L’intérieur imaginé est explicitement identifié. L’historique des fichiers, prompts et licences des fontes locales est documenté dans `design/ASSETS.md`.
- Catégorie A : 5 services préparés au lancement, réservation effective dépendante des réglages. B : qualification non vérifiée, réservation serveur bloquée ; une attestation explicite avec référence de preuve est auditée. Spray tan : qualification **et** procédé. UV/luminothérapie : verrou distinct, sans tarif ni paiement ; une revue réglementaire et technique dédiée est nécessaire pour changer ce périmètre.
- Les montants de 20 € et durées de 60 min sont des données de cadrage, clairement identifiées comme démonstration. Valider les prix avant lancement.
- L’export CSV privé neutralise les formules Excel et trace l’export. Il contient des données personnelles : le conserver uniquement sur un support autorisé.
- Une anonymisation admin est disponible sur les fiches clientes après la durée opérationnelle et sans rendez-vous futur/en attente. Elle efface coordonnées et notes, conserve les écritures financières. La politique comptable, le traitement des messages de contact et les sauvegardes doivent être validés séparément ; aucun effacement comptable automatique.
- `robots` et les métadonnées interdisent l’indexation, le sitemap reste vide dans cette livraison de démonstration. Avant ouverture publique : activer délibérément le SEO avec domaine et informations réels, sans générer de données structurées fictives.

## Architecture et vérifications

`src/app` : pages et routes API ; `src/components` : interfaces ; `src/config` : identité et règles ; `src/lib/booking`, `payments`, `notifications`, `db` : intégrations ; `supabase/migrations` et `seed.sql` : stockage ; `tests` et `e2e` : recette.

Voir [le rapport de vérification](docs/VERIFICATION_REPORT.md), [la checklist de lancement](docs/GO_LIVE_CHECKLIST.md) et [le plan de réalisation](docs/IMPLEMENTATION_PLAN.md). Le parcours Auth + Checkout réel de bout en bout n’a pas été exécuté sans la pile Supabase et les clés de test. Les contraintes SQL, signatures, transports interceptés et parcours publics fermés sont testés localement.

Références consultées : [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create). Le SDK Stripe installé utilise `allowed_payment_method_types` dans sa version courante. Le changelog Supabase a été vérifié ; l’implémentation n’utilise ni opérateur custom ni extension impactés par les changements Postgres signalés en septembre 2026.
