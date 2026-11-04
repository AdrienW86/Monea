# MONÉA — Connexion Supabase et validation avant initialisation

Mise à jour après renseignement des variables : la connexion est maintenant validée et des écarts de schéma ont été observés. Le [rapport d’audit distant actuel](SUPABASE_REMOTE_READONLY_REPORT.md) remplace le constat d’accès bloqué ci-dessous ; le plan d’autorisation reste applicable.

Situation constatée le 30 octobre 2026. Projet demandé : `qnmpfswaeexpchietwzf`.

## Ce qui est effectivement vérifié

- Les trois variables attendues par Next.js sont actuellement absentes : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Aucun alias Supabase exploitable ni `SUPABASE_ACCESS_TOKEN` n’a été trouvé dans l’environnement chargé. Aucune valeur sensible n’a été affichée.
- Le connecteur Supabase refuse l’accès au projet : `You do not have permission to perform this action` pour projet, tables et migrations. La CLI ne dispose pas non plus d’une authentification permettant la lecture de l’historique. Ce refus provient du service, pas d’un rejet de l’approbation automatique des commandes locales.
- Le site continue d’utiliser SQLite/mock. `.env.local`, les composants du site, le back-office, le schéma et les paramètres distants n’ont pas été modifiés.
- Le repository Supabase est déjà raccordé au contrat commun : `repository()` choisit `SupabaseRepository` lorsque `DATA_PROVIDER=supabase`. Les méthodes `snapshot()` et `mutate()` existent ; aucune réécriture ni seconde administration n’est nécessaire pour activer ce raccordement.
- Une nouvelle sauvegarde WAL/restauration de SQLite a été produite dans `.local/migration/supabase-connection-20261030/`. Elle contient 7 catégories, 16 prestations, aucun rendez-vous, cliente, paiement, horaire ou exception. Aucun média uploadé n’est à transférer.

Les **21 tables distantes et leur conformité restent une information fournie par le propriétaire**, pas un constat indépendant. Le nombre de tables ne suffit pas à confirmer les signatures des RPC, leurs corps, RLS, permissions ou l’historique des migrations.

## Débloquer la lecture, sans importer

Renseigner directement dans `.env.local`, sans transmettre de clé dans la conversation :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://qnmpfswaeexpchietwzf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

La clé serveur ne doit jamais être préfixée `NEXT_PUBLIC_`. Le nom historique `SUPABASE_SERVICE_ROLE_KEY` peut contenir la clé serveur prise en charge par le client installé ; le diagnostic distingue les formats publics/serveur sans les afficher. Conserver `DATA_PROVIDER=local` et `PAYMENT_PROVIDER=mock` tant que le catalogue distant et l’ouverture ne sont pas validés.

```powershell
# Présence/type/cible uniquement ; aucune connexion :
node scripts/supabase-check.mjs
# Après configuration : SELECT/HEAD uniquement, sans RPC à effets de bord :
node scripts/supabase-check.mjs --read-remote
# Lecture de l’historique si la CLI est authentifiée :
node scripts/supabase-history-check.mjs
```

Les trois variables permettent les contrôles de l’API de données, mais ne donnent pas automatiquement accès à l’historique CLI et aux métadonnées PostgreSQL. Pour ces dernières, autoriser le connecteur Supabase sur le projet, ou fournir un accès CLI approprié, ou faire exécuter les requêtes de `docs/SUPABASE_REMOTE_READONLY_AUDIT.sql` par l’opérateur. Ce fichier ne contient que des lectures dans une transaction READ ONLY.

Le diagnostic distant prévu lit les nombres de lignes, le catalogue et quelques booléens de configuration, sans extraire les données personnelles des clientes. Il n’appelle pas `snapshot()`, `availability()`, `expire_holds()`, une connexion Auth ou une mutation : certaines lectures métier expirent des holds et ne sont donc pas strictement sans écriture.

## Réconciliation des trois migrations : plan sans réapplication

Versions locales à rapprocher :

1. `20261028142329_initial_schema.sql`
2. `20261028164846_local_management_preparation.sql`
3. `20261030114906_management_repository_parity.sql`

Les empreintes locales figurent dans [la revue du catalogue](SUPABASE_CATALOGUE_REVIEW.md). Elles constituent une référence locale, pas une preuve de ce qui a été appliqué à distance.

Après accès en lecture : relever les versions de `supabase_migrations.schema_migrations`, comparer les tables, colonnes, contraintes, triggers, RPC et privilèges avec les fichiers locaux. Vérifier notamment les RPC de gestion, l’exclusion GiST, l’unicité des demandes/événements, le fournisseur fictif et l’anonymisation ajoutée dans la troisième migration.

- Si les trois versions sont déjà enregistrées et le schéma conforme : aucune écriture de réparation.
- Si les SQL ont été appliqués manuellement, le schéma est conforme et les versions manquent : proposer l’enregistrement de ces seules versions comme `applied`, puis demander validation avant modification de l’historique distant.
- Si les identifiants distants diffèrent ou le schéma diverge : présenter la correspondance et les écarts ; aucune suppression d’historique, aucun renommage de migration ou marquage aveugle.

La CLI confirme que `migration repair --status applied` inscrit un historique sans rejouer les SQL. Cette opération modifie néanmoins la table d’historique distante et reste soumise à validation. [Référence Supabase](https://supabase.com/docs/reference/cli/supabase-migration-repair).

**Pas de `db push`, `migration up`, `db reset`, `--include-seed` ou `db pull` automatique.** Les trois migrations ne sont pas réappliquées. Le `project_id=monica-beauty` du fichier local `config.toml` identifie la pile locale ; il ne prouve aucun lien avec le projet distant.

## Données proposées pour validation

La liste détaillée, avec catégories, prix, durées, qualifications et états exacts, est dans [SUPABASE_CATALOGUE_REVIEW.md](SUPABASE_CATALOGUE_REVIEW.md).

- **7 catégories et 16 prestations**, UUID, descriptions, visuels, ordre et visibilité conservés.
- **5 prestations sans restriction professionnelle actuellement réservables** : extensions de cils, rehaussement, browlift, teinture, prothésie ongulaire. Toutes sont enregistrées à 20 € / 60 min dans la source ; ce sont les valeurs enregistrées, pas une nouvelle validation tarifaire.
- **11 restent bloquées** : 8 nécessitent une qualification professionnelle ; le spray tan nécessite aussi une validation de procédé ; UV et luminothérapie restent à l’étude avec matériel spécifique et sans tarif. Aucune attestation n’est ajoutée.
- Aucun rendez-vous, cliente, paiement, notification, secret, session ou compte local n’est importé.
- Aucun paramètre distant, horaire ou état global d’ouverture n’est modifié par ce lot.

L’export contrôlé a pour SHA-256 `2bea04d95baa92d63907cd850d45a80ed4d3e7c5fffc42bd2a0a2b9678aa0c9c`. La sauvegarde et sa copie restaurée ont la même empreinte `db66504f7c0d4328359496a6ae8504529e71abcb9886eb9712c2a291e31211cb`.

Transaction préparée : `.local/migration/supabase-connection-20261030/catalogue-review.sql`. Ce n’est pas une migration de schéma. Elle utilise uniquement INSERT, ignore les UUID strictement identiques et refuse les différences ; une collision de nom/slug avec un autre UUID provoque aussi un rollback. Les paramètres existants restent intacts. Elle termine par **ROLLBACK**, pour examen, et n’a pas été exécutée sur le projet distant.

La promotion intégrale `management_import_archive` n’est pas utilisée pour ce lot catalogue : elle fusionnerait aussi les paramètres source. Aucun remplacement de paramètres distants ne doit être introduit implicitement par l’import.

L’import réel sera soumis à validation **après** le relevé distant et la présentation des éventuels conflits. Aucun conflit ne sera résolu par écrasement automatique.

## Auth unique et horaires : réglages séparés à valider

Auth : lire le nombre d’administratrices et l’état des inscriptions ; réutiliser le compte autorisé s’il existe. Sinon, faire désigner l’adresse de la gérante avant création explicite du compte Auth et ajout de son UUID dans `admin_users`. La contrainte singleton et le contrôle serveur `getUser()` + table d’autorisation existent déjà. Ne pas transférer le mot de passe local ni supprimer d’autres comptes Auth. La désactivation des inscriptions et tout réglage Auth distant nécessitent validation ; aucune invitation/email n’est envoyé ici.

Horaires : la source ne contient aucune plage ni exception. L’interface avancée permet déjà leur configuration. Faire approuver jours, heures, pauses et exceptions réels ; pour la recette, choisir une plage future explicitement destinée au test en Europe/Paris. Ne pas ouvrir par défaut toute la semaine et ne pas remplacer une exception distante existante.

Les validations tarifs/légal/confidentialité/ouverture sont des paramètres distants distincts. Ne pas les passer automatiquement à `true` pour forcer un paiement. Confirmer aussi que le projet peut recevoir des données de recette avant toute ouverture temporaire et tout rendez-vous de test.

## Plan du premier Checkout, après autorisations

1. Confirmer connexion, schéma, import, compte administratrice, plage de test et réglages d’ouverture approuvés. Conserver les notifications externes désactivées et les paiements live interdits.
2. Démarrer une instance Next de recette sur un port distinct, avec `DATA_PROVIDER=supabase`, `PAYMENT_PROVIDER=stripe` dans l’environnement de ce processus. Préserver le serveur SQLite et ses réglages. Le listener CLI doit recevoir exactement la même origine locale.
3. Relancer les diagnostics masqués Stripe et la comparaison du secret CLI, puis lancer le listener fourni. Ne jamais utiliser `--live`.
4. Créer une réservation depuis l’application avec une prestation autorisée, une identité explicitement **TEST STRIPE MONÉA** et une adresse de test sans destinataire réel. Avant le premier test distant, définir le mécanisme de marquage des données de recette : les colonnes `demo` existent mais le flux public ne les renseigne pas automatiquement et les encaissements ne distinguent pas encore `Stripe test` de `Stripe live` en base. Ne pas mêler ces essais à des données d’exploitation sans traitement explicite approuvé.
5. Vérifier le tarif réel en base, le hold, les métadonnées et la session Checkout test. Le propriétaire saisit uniquement une carte de test dans Checkout ; aucune vraie carte n’est utilisée.
6. Vérifier le webhook signé réellement livré, le passage pending → confirmed, le paiement payé une fois, l’allocation PostgreSQL active et l’affichage dans le back-office connecté.
7. Rejouer le même événement puis un second événement du même paiement : une seule confirmation, pas de doublon d’outbox. Tester concurrence de créneau et double soumission.
8. Réserver des créneaux de recette séparés pour refus carte et expiration ; contrôler les états et la libération. Un refus carte peut laisser Checkout ouvert pour retenter : ne pas le confondre avec `async_payment_failed`.
9. Tester interruption avant/après création de session, reprise de session attachée, et session non attachée dont le webhook retrouve la réservation grâce aux métadonnées signées. Vérifier une erreur de base puis la reprise transactionnelle de l’événement.
10. Traiter avant certification le cas de reprise tardive sans session connue : l’échéance persistée proche de 30 minutes peut devenir incompatible avec le minimum Stripe à la création. Ce point est documenté dans [le rapport Stripe](STRIPE_TEST_CHECKOUT_REPORT.md), pas déclaré validé par les simulations.

Ne pas supprimer automatiquement les traces de recette : conserver leur identification et demander validation de toute purge ou correction ultérieure.

## Résultats des vérifications de cette étape

| Périmètre | Réellement exécuté | Résultat |
| --- | --- | --- |
| SQLite de travail | Sauvegarde cohérente, restauration, export et préparation du lot catalogue | Réussi ; source conservée |
| Bases isolées | `npm test` | 118 réussis / 15 fichiers |
| Import proposé, PostgreSQL PGlite | ROLLBACK par défaut, commit en mémoire, rejeu, absence d’écrasement, restrictions et paramètres préservés | Réussi |
| Back-office, PostgreSQL local isolé | `npm run test:e2e:supabase`, ordinateur/mobile, 11 rubriques, Auth/PostgREST substitués | 2 réussis |
| Contrôles statiques | TypeScript et lint | Réussis |
| Projet Supabase demandé | Tentatives de lecture via connecteur et CLI ; diagnostic des variables locales | Accès refusé / variables manquantes ; contenu et historique non vérifiés |
| Stripe Checkout externe | Aucun scénario effectué pendant cette étape | En attente d’accès et d’autorisations ; aucun paiement créé |

Les tests Stripe intégrés de la suite utilisent des signatures réelles calculées par le SDK, une base isolée et un Checkout simulé. Ils ne constituent pas un paiement Stripe externe ni une validation du Supabase hébergé. Les vérifications Stripe en lecture seule réalisées à l’étape précédente restent décrites dans le rapport Stripe ; elles ne sont pas présentées ici comme un nouveau paiement.

Fichiers ajoutés : `scripts/supabase-check.mjs`, `scripts/supabase-history-check.mjs`, `scripts/prepare-supabase-catalogue.mjs`, `tests/supabase-catalogue-review.test.ts`, les deux rapports de revue/validation et `docs/SUPABASE_REMOTE_READONLY_AUDIT.sql`. Aucun fichier applicatif, logo, style ou migration existante n’est modifié.

**Prochaine action requise : fournir les variables localement et/ou autoriser le connecteur pour l’audit, puis valider les opérations distantes concrètes après cet audit. Aucune initialisation distante ni paiement ne sont engagés avant cette validation.**
