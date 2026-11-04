# MONÉA — Migration additive des contrats RPC

Préparée localement le 30 octobre 2026. **Non appliquée à Supabase ; aucune connexion au projet distant effectuée pendant cette préparation.** Les données locales, `.env.local`, SQLite/mock et l’application existante restent inchangés.

## Fichiers livrés

- SQL complet : [`20261031085519_backend_rpc_contract_alignment.sql`](../supabase/migrations/20261031085519_backend_rpc_contract_alignment.sql). Déjà appliqué à distance selon confirmation du 31 octobre 2026 ; ne pas réappliquer. Horodatage local rapproché sans changement du SQL.
- Contrats TypeScript complets : [`supabase-rpc-contracts.ts`](../src/lib/data/supabase-rpc-contracts.ts).
- Tests isolés : [`backend-rpc-migration.test.ts`](../tests/backend-rpc-migration.test.ts).

SHA-256 du SQL livré : `63e033127b0e21e695faa739dc3828390e66ca13b684963f7b70941b8847478f`.

Les migrations distantes déjà enregistrées sont conservées telles qu’indiquées par le propriétaire :

| Version distante | Nom |
| --- | --- |
| `20261030115435` | initial_schema |
| `20261030115449` | local_management_preparation |
| `20261030115458` | management_repository_parity |

Ne pas réappliquer les trois anciens fichiers locaux. Leurs timestamps diffèrent de ces versions distantes : un `db push` automatique sans rapprochement préalable n’est pas approprié. Ce livrable est une **quatrième migration autonome**, pas une réparation de l’historique.

## Portée SQL précise

Le fichier contient une transaction complète BEGIN/COMMIT qui :

1. Ajoute `public.payments.checkout_expires_at timestamptz NULL`, sans valeur par défaut, sans backfill ni modification des paiements existants.
2. Définit/remplace uniquement les trois RPC demandées, avec leurs noms d’arguments exacts et un résultat scalaire `jsonb`, jamais `SETOF`.
3. Révoque leur exécution à `PUBLIC`, `anon` et `authenticated`, puis l’accorde uniquement au rôle applicatif privilégié `service_role`. Le propriétaire PostgreSQL conserve naturellement ses droits de maintenance.
4. Utilise explicitement `SECURITY INVOKER` et `search_path=''`, sans fonction SECURITY DEFINER ni ouverture de politique RLS.
5. Envoie `NOTIFY pgrst, 'reload schema'` à la validation de la transaction pour actualiser le cache de schéma de la Data API.

Le rejeu est possible sur des objets compatibles. Une colonne préexistante de mauvais type/non nullable, une surcharge inattendue ou un retour non JSONB provoquent un refus ; aucun DROP/CASCADE ou changement forcé de type n’est effectué. Une incompatibilité de noms d’arguments existants est également refusée par CREATE OR REPLACE. [Règles PostgreSQL de remplacement des fonctions](https://www.postgresql.org/docs/current/sql-createfunction.html).

Aucune insertion de catalogue, ouverture d’horaires, validation légale, création Auth, réservation, modification tarifaire ou opération Stripe. Les routines existantes de création de réservation et de mutation ne sont pas remplacées.

## Contrats SQL et TypeScript

| RPC SQL | Arguments TypeScript | Résultat TypeScript |
| --- | --- | --- |
| `management_snapshot(p_actor uuid, p_query jsonb DEFAULT '{}'::jsonb) RETURNS jsonb` | `ManagementSnapshotRpcArgs` | `ManagementSnapshotRpcResult` |
| `repository_catalogue() RETURNS jsonb` | `RepositoryCatalogueRpcArgs` : objet vide / aucun argument | `RepositoryCatalogueRpcResult` |
| `repository_booking_status(p_token uuid) RETURNS jsonb` | `RepositoryBookingStatusRpcArgs` | `RepositoryBookingStatusRpcResult` |

La table `BackendRpcContracts` expose les trois couples `Args`/`Returns`. UUID, dates et timestamps sont transmis comme chaînes JSON ; montants en centimes entiers.

### management_snapshot

```ts
type ManagementSnapshotRpcArgs = {
  p_actor: string;
  p_query?: ManagementSnapshotQuery;
};
```

Le serveur Next.js vérifie la session avec `requireAdmin()` et transmet l’UUID de cette administratrice. SQL appelle `assert_admin(p_actor)` **avant toute lecture privée ou expiration de hold**. Une session Supabase Auth, même administratrice, ne peut pas appeler directement cette RPC avec la clé publique : elle passe par le backend privilégié.

`p_query` suit `snapshotQuerySchema`, déjà appliqué par le repository :

- `section` : `all`, chaîne vide (tableau de bord), `planning`, `rendez-vous`, `clientes`, `catalogue`, `categories`, `indisponibilites`, `horaires`, `notifications`, `messages`, `parametres`, `lookup`.
- `page`, `search` ; dates `from`, `to`, `date` ; UUID `clientId`, `bookingId` ; filtre `status`.
- Défauts Next.js : page 0 et recherche vide. SQL sans rubrique utilise `all` ; la rubrique chaîne vide est distincte.
- Pages de 50 éléments, planning par période jusqu’à 94 jours, export `all` non paginé sur les collections prévues par le contrat. L’historique d’une cliente utilise sa pagination propre.

Réponse complète : `provider`, `settings`, `categories`, `services`, `products`, `clients`, `bookings`, `allocations`, `hours`, `special`, `notifications`, `messages`, `audit`, `pagination`, `summary`.

Les filtres, tris, décomptes, calculs de synthèse et règles de masquage reproduisent la version locale actuelle. Les notes clientes sont vidées dans les listes de recherche et dans les objets cliente liés aux rendez-vous hors export global, selon ce contrat. Les rubriques catalogue/catégories ne reçoivent pas les collections privées. Les restrictions de réservation et qualifications enregistrées ne sont pas modifiées.

La construction des rendez-vous JSON est intégrée dans la nouvelle RPC : elle n’utilise pas un éventuel ancien `management_booking_json` distant. La comparaison automatisée avec les JSON de référence couvre toutes les rubriques, recherche, statut/date et pagination.

### repository_catalogue

```ts
type RepositoryCatalogueRpcArgs = Record<string, never>;
type RepositoryCatalogueRpcResult = {
  settings: Partial<Settings> | null;
  services: RpcService[];
  categories: Category[];
};
```

Lecture STABLE, sans expiration de hold ni écriture. Les prestations sont jointes aux catégories et ajoutent `category` / `category_active`. L’ordre est catégorie/ordre de prestation/UUID. Aucune prestation n’est activée ou filtrée implicitement par SQL : Next.js applique les filtres publics existants après lecture serveur.

Aucun paramètre administratrice n’est ajouté : cette RPC sert aussi les pages publiques à travers le serveur. Sa protection est l’ACL `service_role`, pas une permission anonyme ni une assertion administratrice qui casserait ce parcours.

### repository_booking_status

```ts
type RepositoryBookingStatusRpcArgs = { p_token: string };
type RepositoryBookingStatusRpcResult = Pick<
  PublicBooking,
  | "id" | "public_token" | "service_name" | "price_cents" | "status"
  | "start_at" | "end_at" | "payment_status" | "payment_provider"
> | null;
```

Jeton UUID inconnu : `null`. Jeton connu : exactement ces neuf champs. Aucun nom, email, téléphone, note, motif interne, hash de demande, identifiant Stripe ou échéance Checkout n’est retourné. Les états de paiement/fournisseur sont nullables pour les rendez-vous sans paiement.

La projection est construite directement depuis les tables : elle n’utilise pas un éventuel ancien `management_public_booking`. La routine ne reçoit pas d’UUID administratrice car le statut public utilise son jeton opaque ; l’accès SQL reste néanmoins réservé au serveur privilégié.

### Résultat SQL brut et normalisation Next.js

Les contrats décrivent le JSONB **avant** sa normalisation par `SupabaseRepository`. Celui-ci complète les paramètres par les valeurs de marque et raccourcit `hours.opens/closes` de `HH:mm:ss` à `HH:mm`. Aucun de ces défauts n’est écrit dans `site_settings` par cette migration.

Le fichier TypeScript distingue les nullabilités réelles du stockage (`actor_id`, motifs, téléphone facultatif, identifiants Stripe…) des types simplifiés de l’interface. La ligne `site_settings.id=1` est prévue par la migration initiale ; si elle n’existe plus, la propriété SQL `settings` est nulle, sans création silencieuse de cette ligne.

`management_snapshot` et `repository_booking_status` sont VOLATILE : comme le contrat local existant, elles appellent `expire_holds()` lors de leur utilisation. Leur exécution ultérieure peut donc expirer des holds/paiements provisoires. **Appliquer la migration ne les appelle pas et n’expire aucun rendez-vous.**

## Prérequis et vérifications après application par l’opérateur

Les 21 tables de la préparation précédente et les fonctions existantes `assert_admin(uuid)` / `expire_holds()` doivent être présentes, avec leurs permissions backend. Les routines de génération JSON historiques ne sont pas nécessaires à ces trois réponses.

Après contrôle et application de ce seul nouveau fichier, vérifier les signatures et ACL, le chargement OpenAPI des trois RPC, puis le contrat du back-office avec une administratrice réellement autorisée. Les vérifications anonymes doivent rester refusées. Ne pas considérer cet ajout comme une validation du parcours Stripe complet : il n’altère pas la logique existante de création/attachement d’une session ni ne reconstruit les échéances historiques.

Les fonctions auxiliaires `management_import_archive` et `admin_mutate_legacy` précédemment signalées ne sont pas ajoutées par ce lot de quatre objets.

## Vérifications locales exécutées

- Six tests ciblés : simulation des trois RPC/colonne manquantes, préservation des trois versions distantes fournies, rejeu, égalité des réponses avec la référence locale, signatures/defaults/retours exacts, permissions, projection publique minimale, expiration et refus d’une surcharge incompatible.
- La simulation utilise des données existantes dans un PostgreSQL PGlite éphémère : rendez-vous manuels/en ligne, paiements, notes privées, 52 clientes de pagination, messages et outbox. Aucun de ces enregistrements n’est ajouté au projet Supabase ou à SQLite de travail.
- Suite complète : **124 tests réussis, 16 fichiers**, dont les six tests ciblés ci-dessus. Les tests PostgreSQL embarqués existants chargent également la nouvelle migration.
- `npm run typecheck` et `npm run lint` : **réussis**. Aucun test connecté à Supabase n’est exécuté pour cette livraison non appliquée.
- Les empreintes des trois anciens fichiers SQL locaux sont identiques à celles du rapport de catalogue : ils n’ont pas été modifiés.

**Livraison pour revue et application ultérieure par le propriétaire depuis ChatGPT. Aucun outil d’application de migration distante, aucun SQL distant et aucun changement de configuration n’ont été lancés.**
