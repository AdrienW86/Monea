# MONÉA — Mission 1 : architecture Supabase

Livraison locale du 30 octobre 2026. Le raccordement du back-office est implémenté et testé hors ligne. Le basculement vers un projet Supabase hébergé reste soumis à une recette et à votre validation. Aucun projet distant n’a été contacté, aucune migration distante appliquée, aucun paiement ou message externe créé. `.env.local` n’a pas été modifié.

## 1. Modifications réalisées

- Une seule interface `ManagementApp` pour SQLite et Supabase : tableau de bord, planning jour/semaine/mois, rendez-vous, clientes, catégories, prestations, produits, indisponibilités, horaires, notifications, contacts et paramètres. Les anciens chemins agenda/blocages/prestations/audit restent des alias.
- `SupabaseRepository.snapshot()` charge les données par rubrique. Les listes privées sont paginées par 50 ; recherche, statut et date des rendez-vous sont filtrés en base. Le planning charge sa période, limitée à 94 jours. L’historique d’une cliente est paginé ; celui d’un rendez-vous est consultable séparément. L’export complet reste une opération administrateur explicite.
- `SupabaseRepository.mutate()` applique le contrat Zod partagé et délègue les commandes à une transaction PostgreSQL. Catégories, prestations, prix, durées, produits, clientes, rendez-vous manuels, déplacements, annulations, blocages récurrents, horaires, exceptions, génération des créneaux, contacts, notifications et paramètres sont pris en charge.
- Les commandes historiques de remboursement intégral, anonymisation, reprise et traitement de l’outbox, ainsi que les validations légales et d’ouverture, restent accessibles dans l’administration commune. Elles utilisent les routes protégées existantes ; elles n’ont déclenché aucun appel externe pendant cette mission.
- L’anonymisation historique a été corrigée : suppression d’une ambiguïté SQL et effacement des notes clientes ajoutées depuis la première version, en conservant les restrictions de conservation et de rendez-vous actifs.
- Les médias locaux conservent leurs URL. En mode Supabase, l’import écrit dans le bucket privé `monea-media` et une route serveur sert les fichiers WebP autorisés. Les médias statiques du dépôt ne changent pas.
- Les composants, images, logo, styles, sections et animations du site public restent ceux de l’existant. Seule la logique de reprise du formulaire de réservation a été complétée.

## 2. Dépôt et réservations

| Méthode | Implémentation Supabase |
| --- | --- |
| `settings()`, `services()`, `categories()` | RPC serveur `repository_catalogue`, normalisation des paramètres et catégories |
| `snapshot(query, actor)` | RPC `management_snapshot`, contrôle administrateur, périmètre et pagination |
| `mutate(command, actor)` | Validation partagée puis RPC transactionnelle `management_mutate` |
| `availability(serviceId, date)` | Horaires, exceptions, pas configurable, préavis, horizon, qualifications, catégorie active et occupations |
| `createBooking(input, actor?)` | RPC `management_save_booking`, une à huit prestations consécutives et montants calculés en base |
| `publicBooking(token)` | RPC minimale sans cliente, coordonnées, notes ou identifiant Stripe |
| `storeContact()`, `rateLimit()` | RPC existantes conservées |

Les lignes du rendez-vous figent intitulés, prix et durées. Un déplacement conserve ces lignes. Une modification volontaire de la sélection recalcule les lignes ; une sélection déjà payée est figée. Les nouvelles réservations restent soumises aux catégories actives et qualifications. Les rendez-vous historiques restent consultables même si une prestation est ensuite archivée.

PostgreSQL combine un verrou transactionnel commun à la ressource et la contrainte d’exclusion GiST existante sur les allocations actives. Les limites sont semi-ouvertes. Une opération en conflit est entièrement annulée. La récurrence des blocages suit l’heure locale Europe/Paris, y compris lors du changement d’heure.

Une demande identique réutilise le même rendez-vous ; réutiliser son UUID avec un autre contenu est refusé. L’échéance Checkout est persistée. Si une session existe, la route reprend cette session ; si le rendez-vous a déjà quitté l’état pending, elle renvoie son statut. Le navigateur conserve l’UUID pendant la reprise de la même soumission.

Limite explicite : une soumission conservée uniquement en mémoire ne survit pas à une fermeture complète du navigateur. Un lien de retour reste exploitable si son jeton a été conservé. Les erreurs réseau réelles Stripe et la fenêtre minimale d’expiration Checkout devront être éprouvées en recette Stripe test, notamment lorsqu’une première requête n’a jamais atteint Stripe. Aucun paiement n’est confirmé sur la seule base d’un retour navigateur.

## 3. Migration SQL créée

`supabase/migrations/20261030114906_management_repository_parity.sql`, créée avec la CLI locale, est additive. Elle suit les deux migrations déjà présentes.

Elle ajoute les champs de parité, le fournisseur de paiement explicite, l’échéance Checkout, les notifications internes, les jours générés et le suivi des imports. Elle complète les RPC, permissions et index ; elle prépare le bucket privé lorsque le schéma Storage est présent. Elle ne réinitialise aucune table.

Les paiements importés de SQLite gardent `provider=mock` et leur état fictif. Une contrainte interdit de les présenter comme des paiements Stripe ou de leur associer des identifiants Stripe. Ils sont exclus des encaissements Stripe affichés. Les colonnes financières préexistantes ne constituent pas une nouvelle intégration d’acomptes ou de comptabilité.

## 4. Sécurité

- Auth SSR vérifiée côté serveur par `getUser()` puis présence dans `admin_users`. La contrainte singleton existante limite cette table à une administratrice.
- Auth locale conservée uniquement en développement ; aucune conversion des sessions locales en sessions Supabase.
- RLS activée sur les nouvelles tables ; lecture réservée à l’administratrice. Les RPC privées sont révoquées à `PUBLIC`, `anon` et `authenticated` ; elles sont appelées par le serveur avec `service_role` et vérifient l’acteur pour les opérations administrateur.
- La clé `service_role` demeure dans les modules serveur. La clé publique ne donne aucun accès aux données clientes. Les données de catalogue et les statuts publics passent par des projections distinctes.
- Contrôle d’origine sur les mutations, validation des entrées, réponses privées sans cache, quotas sur la consultation et les mutations administrateur, médias et disponibilités publiques.
- En production, un en-tête IP fourni par le navigateur n’est plus cru par défaut. `TRUST_PROXY_IP_HEADERS=true` exige un proxy qui remplace réellement `x-real-ip` et interdit l’accès direct à l’origine. Sans cela, le quota partagé est conservateur et doit être dimensionné en recette.
- Le bucket de médias n’a pas de politique d’écriture publique. La route de lecture n’accepte que les noms UUID WebP, sans listing ni chemin arbitraire. Il est destiné aux visuels commerciaux, pas aux documents privés des clientes.

La session Auth hébergée, le renouvellement de session, les véritables permissions PostgREST/Storage et la configuration du proxy cible ne sont pas certifiés par les substituts locaux.

## 5. Sauvegarde et transfert

Outils disponibles :

| Fichier | Fonction |
| --- | --- |
| `scripts/local-transfer.mjs` / `npm run local:backup` | Ouverture SQLite en lecture seule, `VACUUM INTO` incluant le WAL validé, restauration dans une copie, contrôles intégrité et clés étrangères, export v2, médias et empreintes SHA-256 |
| `scripts/prepare-local-import.mjs` | Validation des références et préparation d’un SQL d’archive privé ; aucune connexion |
| `scripts/import-local-postgres.mjs` | Répétition sur PostgreSQL **loopback uniquement**, transaction avec rollback par défaut ; commit uniquement avec `--apply-local` |
| `scripts/verify-local-import.mjs` | Comparaison des UUID, champs métier, historiques, lignes, paiements fictifs et paramètres ; aucun contenu personnel imprimé |
| RPC `management_import_archive` | Promotion atomique et réexécutable par SHA-256, refus des collisions, conservation de l’archive et désactivation des réservations publiques après import |

Sauvegarde réellement créée : `.local/migration/mission-1-20261030/`.

- `snapshot.sqlite` : copie cohérente ; `restoration-test.sqlite` : copie restaurée contrôlée.
- `export.json`, `manifest.json` : 7 catégories, 16 prestations ; zéro produit, cliente, réservation, allocation, horaire, exception, notification, contact ou événement d’audit dans la source à cet instant. Aucun upload à copier.
- SHA-256 sauvegarde et restauration : `db66504f7c0d4328359496a6ae8504529e71abcb9886eb9712c2a291e31211cb`.
- SHA-256 export : `ea6580dbc7e7fb990a351de512d9f0de6b06b48e1c60f20e4e4f9c36318bf716`.

Ces fichiers restent privés et exclus de Git. La sauvegarde brute contient aussi les tables locales techniques ; elle doit être protégée comme un secret. Les sessions et secrets ne sont pas promus par l’export métier. Les droits Windows et le stockage chiffré de la sauvegarde restent à régler sur l’environnement d’exploitation.

Le test de transfert utilise une autre base contenant des rendez-vous et un paiement mock, avec WAL ouvert : vérification du WAL source inchangé, restauration, import des deux lignes, comparaison des données, réexécution sans doublon et rollback sur collision. Les données de test n’ont pas été ajoutées à la base de travail.

### Répétition locale

```powershell
npm run local:backup -- .local/data/monea-development.sqlite .local/migration/un-nouveau-dossier
npm run local:prepare-import -- .local/migration/un-nouveau-dossier/export.json
# Uniquement avec une base PostgreSQL isolée préalablement préparée :
# PG_MIGRATION_URL = URL loopback ; PG_MIGRATION_ACTOR = UUID de son administratrice.
node scripts/import-local-postgres.mjs .local/migration/un-nouveau-dossier/export.json
# Cette dernière commande contrôle l’import puis ROLLBACK par défaut.
```

Ne pas utiliser `db reset` sur la source. Préparer une destination dédiée avec les migrations et son administratrice, **sans seed catalogue lorsque l’on importe le catalogue local** : les mêmes UUID ou noms doivent provoquer un refus, pas un écrasement silencieux. Une promotion est identique uniquement pour le même fichier et la même empreinte ; un nouvel export n’est pas un mécanisme de synchronisation continue.

Les identifiants des acteurs locaux ne sont pas des UUID Auth Supabase : les anciens événements conservent cet acteur dans `detail.legacy_actor_id`, avec `actor_id` distant nul. Les dates source présentes, identifiants de lignes et montants historiques sont repris. Les notifications importées restent internes et ne remplissent pas l’outbox externe.

### Bascule et retour arrière, après validation séparée

1. Valider cette livraison puis autoriser une recette Supabase dédiée. Vérifier la version PostgreSQL cible, les sauvegardes, Auth, RLS, RPC et Storage sur la vraie pile.
2. Arrêter temporairement les écritures locales ; produire une nouvelle sauvegarde et son manifeste, contrôler les médias. Choisir explicitement les données de démonstration à conserver ; aucune suppression automatique n’est prévue.
3. Appliquer les migrations autorisées sur la destination, sans seed concurrent de l’import. Créer l’unique administratrice et archiver/promouvoir l’export dans une transaction opérée explicitement. Comparer les données avant commit. Copier les médias et vérifier chaque empreinte avant ouverture.
4. Tester le back-office connecté et le site public, en laissant réservations, paiements live et notifications externes fermés. Valider tarifs, qualifications, horaires, règles et mentions légales.
5. Autoriser seulement ensuite le changement de configuration et la recette des intégrations externes. Prévoir une fenêtre de bascule et une seule base d’écriture.
6. Avant la première écriture distante, revenir au mode local avec sa base intacte reste possible. Après des écritures distantes, fermer les réservations, sauvegarder les deux bases et rapprocher toutes les nouvelles opérations avant retour : ne jamais restaurer aveuglément un ancien SQLite, ce qui perdrait ces opérations.

Aucun script de suppression des données ni de migration descendante destructive n’est fourni.

## 6. Tests exécutés

| Vérification | Résultat |
| --- | --- |
| `npm test` | 102 réussis, 13 fichiers, comparaison avant/après import comprise |
| `npm run typecheck` | Réussi sur la version finale |
| `npm run lint` | Réussi sur la version finale |
| `npm run build` | Réussi, build production isolé `.next-qa`, connexions externes désactivées |
| `npm run test:e2e` | 27 réussis, ordinateur/tablette/mobile ; navigation, catalogue, pages, accessibilité, responsive et garde-fous sans intégrations |
| `npm run test:e2e:local` | 10 réussis ; planning local, gestion, persistance et paiement mock |
| `npm run test:e2e:supabase` | 2 réussis, ordinateur/mobile ; 11 rubriques, connexion et cookie SSR, API privée, rendez-vous, conflit 409, fiche, catalogue, origine étrangère, annulation et réglages d’ouverture |
| Sauvegarde de la base de travail | Réussie, restauration et empreintes concordantes |

Les tests unitaires/intégration couvrent notamment CRUD et prix, plusieurs prestations, lignes historiques, catégories désactivées, qualifications, pagination et notes privées, déplacement/annulation, blocages récurrents Paris, horaires/fermetures, idempotence, reprise Checkout simulée et anonymisation. Deux connexions PostgreSQL concurrentes se disputent effectivement le même créneau ; une seule gagne. Un arrêt puis redémarrage du PostgreSQL isolé conserve réservations, lignes et allocations.

Les deux tests navigateur Supabase utilisent un véritable PostgreSQL local et des substituts HTTP locaux pour Auth/PostgREST. Ils ne sont pas des tests du service Supabase hébergé. Storage n’est pas implémenté dans ces substituts. Le PostgreSQL embarqué est en version 18 ; la configuration Supabase vise la version 17 : refaire la recette sur la version cible.

Les captures publiques et administrateur ont été produites et inspectées. Les contrôles responsive et d’accessibilité passent ; cela ne constitue pas une comparaison automatique pixel par pixel de toutes les pages. Aucun fichier de style public ni asset de marque n’a été changé pour cette mission. Avertissements non bloquants : API SQLite expérimentale dans Node et recommandation LCP en développement.

## 7. Configuration future requise

À renseigner uniquement après autorisation, sans exposer les secrets :

- `DATA_PROVIDER=supabase`, `PAYMENT_PROVIDER=stripe`, `NEXT_PUBLIC_APP_URL` avec l’origine exacte.
- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : seules les valeurs publiques prévues.
- `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_SALT` : côté serveur exclusivement ; `CRON_SECRET` pour les traitements planifiés, lorsqu’ils seront autorisés.
- Auth : inscriptions publiques désactivées, administratrice créée explicitement puis son UUID inscrit dans `admin_users`, mot de passe fort. `supabase/config.toml` prévoit 12 caractères minimum mais ne règle pas à distance le projet hébergé. Recette connexion/renouvellement/déconnexion/révocation indispensable ; politique MFA à valider.
- Bucket privé `monea-media`, permissions serveur et copie vérifiée des uploads. Conserver les URL `/assets/uploads/<UUID>.webp`.
- `TRUST_PROXY_IP_HEADERS=false` tant que le proxy cible n’a pas été vérifié. HTTPS et cookies sécurisés en production.
- Maintenir `ALLOW_LIVE_PAYMENTS=false` et `ENABLE_EXTERNAL_NOTIFICATIONS=false` pendant la recette. Les identifiants locaux restent propres au développement.

La base de travail n’a actuellement aucun horaire et conserve les validations d’ouverture désactivées. Le catalogue visible n’implique donc pas que les 16 prestations soient réservables. Les restrictions professionnelles, de procédé et d’équipement restent applicables ; aucun prix ou justificatif n’a été inventé.

## 8. Écarts assumés et suite hors mission

- SQLite conserve son stockage JSON, ses transactions et son mode mock. Supabase utilise les tables normalisées et la pagination serveur. Le jeu de démonstration reste réservé au développement SQLite.
- Auth est locale en développement et Supabase en mode distant. Les sessions locales ne migrent pas. Les paiements mock sont des archives explicitement fictives, sans création de fonds ni remboursement Stripe.
- Le formulaire public reste une sélection de prestation à la fois, comme auparavant ; le dépôt et les rendez-vous manuels supportent les sélections consécutives multiples.
- Pas de synchronisation automatique entre bases et pas de mise à jour temps réel entre plusieurs navigateurs ; l’actualisation et les mutations rechargent les données, et le serveur refuse les conflits.
- Le fonctionnement du service hébergé, le transfert réel des médias, les emails Auth, la délivrabilité, les sauvegardes de production et les limites de charge restent à vérifier dans un environnement explicitement autorisé.
- Stripe : conserver le paiement intégral ; effectuer ultérieurement une recette Checkout test et webhooks signés, succès/refus/expiration/reprises, événements tardifs et remboursement intégral. Les acomptes, soldes, rapprochements, virements et remboursements partiels multiples ne sont pas développés ici.
- WhatsApp/email : configurer plus tard les destinataires, modèles approuvés et prestataires, puis tester l’outbox et ses reprises avec autorisation d’envoi. Les commandes conservées ne contournent pas le commutateur des notifications externes.

## 9. Fichiers concernés

- Données : `src/lib/data/{supabase,types,snapshot-query}.ts`, `src/lib/db/queries.ts`, `src/lib/auth/management.ts`.
- Administration commune : `src/app/admin/[[...section]]/page.tsx`, `src/components/management/{app,planning}.tsx`, `src/app/api/admin/{manage,media}/route.ts`.
- Réservation et protections : `src/app/api/{availability,bookings}/route.ts`, `src/components/booking-form.tsx`, `src/lib/security.ts`, `src/app/assets/uploads/[file]/route.ts`.
- SQL/configuration : nouvelle migration précitée, `supabase/config.toml`, `.env.example` ; aucune modification de `.env.local`.
- Transfert/recette : `scripts/{local-transfer,prepare-local-import,import-local-postgres,verify-local-import,supabase-qa-server}.mjs`.
- Tests : `tests/{supabase-repository,local-transfer,concurrency,checkout}.test.ts`, `e2e-supabase/management.spec.ts`, `playwright.supabase.config.ts`.
- Outillage : `package.json`, `package-lock.json`, `.gitignore`, `eslint.config.mjs` ; `pg` déclaré explicitement à la version déjà installée, aucun téléchargement requis.
- Documentation : ce rapport et actualisation du guide local ; captures dans `docs/screenshots/`, sauvegarde privée dans `.local/migration/`.

**Arrêt à la mission 1 : aucune activation Stripe/WhatsApp, migration distante, publication ou déploiement n’est engagé.**
