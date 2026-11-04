# MONÉA — Vérification des RPC déployées, 31 octobre 2026

Projet : `qnmpfswaeexpchietwzf`. Tous les appels distants de cette vérification utilisent GET/HEAD. Aucune migration, réparation d'historique distant, importation, création Auth, modification de paramètres, réservation ou opération Stripe n'a été exécutée.

`DATA_PROVIDER=local` et `PAYMENT_PROVIDER=mock` restent inchangés. Aucun secret n'a été affiché. Aucun code applicatif, design ou comportement administrateur n'a été modifié.

## Rapprochement des versions

Les quatre fichiers locaux ont été renommés selon les versions distantes **confirmées par l'utilisateur**, avant toute éventuelle commande de migration. Aucune commande de migration n'a été lancée pendant cette intervention. Les octets SQL et leurs SHA-256 sont inchangés :

| Ancien préfixe local | Préfixe local actuel / distant confirmé | Nom | SHA-256 conservé |
| --- | --- | --- | --- |
| `20261028142329` | `20261030115435` | initial_schema | `87f951e2d9986f8e313af3dd7f511b803c8d3fc9ebb928ae1b3f910ddea1b1f9` |
| `20261028164846` | `20261030115449` | local_management_preparation | `735213817be0b1a009aec11dcac5421434a6a564676f97c26a17eadac06c549b` |
| `20261030114906` | `20261030115458` | management_repository_parity | `b46154bf29a28347003e979eefc5ac9b1c0fd9d14bd14c2abd38b78e41ff7a88` |
| `20261030143405` | `20261031085519` | backend_rpc_contract_alignment | `63e033127b0e21e695faa739dc3828390e66ca13b684963f7b70941b8847478f` |

Cela rapproche les identifiants et l'ordre des migrations, sans certifier l'identité des anciens corps SQL distants. L'historique SQL distant reste inaccessible par la Data API (`406 / PGRST106` : schéma non exposé). Aucun accès supplémentaire n'a été ouvert. Ne pas lancer `db push`, `db pull` ou `migration repair` pour « vérifier » : une future opération nécessitera d'abord une lecture de l'historique par un accès SQL/CLI habilité. Les historiques d'une éventuelle base Supabase locale persistante ne sont pas réparés ici ; les tests reconstruisent des bases isolées.

## Connexion et schéma réellement observés

- Variables nécessaires présentes, URL du bon projet, clé publique publishable et clé serveur service_role reconnues.
- 21 tables accessibles au backend ; les **21 ensembles de noms de colonnes** correspondent à la référence locale reconstruite en PGlite. Ce contrôle ne certifie pas tous les types, contraintes et politiques.
- `payments.checkout_expires_at` est sélectionnable (`200`), sans lire de paiement.
- **16/16 signatures RPC** du parcours commun exposées, avec les noms de paramètres attendus.
- Les 20 tables autres que `site_settings` restent vides ; `site_settings` contient une ligne. Aucun catalogue ni horaire importé.
- Aucun utilisateur Auth et aucun `admin_users`. Les neuf paramètres de réservation contrôlés restent absents. Les inscriptions Auth sont encore autorisées (`disable_signup=false`) ; aucun réglage modifié.
- `management_import_archive` et `admin_mutate_legacy` restent absentes de l'OpenAPI backend : leur disponibilité n'est pas établie. Cela ne bloque pas la consultation du catalogue, mais interdit de supposer que l'import historique est utilisable.

## Contrats des trois RPC : résultats effectifs

Référence applicative : [adaptateur Next.js](../src/lib/data/supabase.ts), [contrats TypeScript](../src/lib/data/supabase-rpc-contracts.ts). Diagnostic reproductible : `node scripts/supabase-rpc-readonly-check.mjs`.

| RPC | Paramètres réellement exposés | Appel backend distant en GET | Conclusion |
| --- | --- | --- | --- |
| `repository_catalogue` | Aucun | `200`, objet avec exactement `settings`, `services`, `categories` ; deux tableaux vides, settings objet ou null selon le contrat | Forme du résultat actuellement renvoyé compatible ; les éléments de catalogue ne peuvent pas être contrôlés à distance tant qu'ils sont absents |
| `management_snapshot` | `p_actor: uuid` obligatoire ; `p_query: jsonb` facultatif | Acteur non habilité : `400 / P0001`, message vérifié `UNAUTHORIZED` | Signature et garde administrateur validées ; résultat d'un appel autorisé non testé à distance |
| `repository_booking_status` | `p_token: uuid` obligatoire | Token fictif absent : `405 / 25006` | Résolution de signature et exécution atteintes, mais écriture d'expiration bloquée par READ ONLY ; aucun résultat métier distant obtenu |

Le type de retour JSONB des trois fonctions a été confirmé par l'audit distant communiqué par l'utilisateur. L'OpenAPI observée ne fournit pas ici de schéma de réponse suffisant pour revérifier ce type PostgreSQL ; le diagnostic ne prétend pas le déduire des seuls noms des fonctions.

Le GET de `management_snapshot` encode `p_query` en texte JSON dans l'URL. Le SDK convertit autrement un objet imbriqué en chaîne non JSON : un premier essai a renvoyé `22P02` et a été corrigé dans le diagnostic. L'adaptateur Next.js utilise POST avec un objet JSON, ce problème de transport du test GET ne nécessite aucun changement applicatif.

Le refus `25006` de `repository_booking_status` est attendu : `expire_holds()` exécute des UPDATE, même si les tables sont vides. Tous les GET/HEAD PostgREST s'exécutent en transaction READ ONLY, y compris pour une fonction VOLATILE. Aucun POST n'a été tenté pour contourner cette limite. [Transactions PostgREST](https://docs.postgrest.org/en/stable/references/transactions.html).

## Droits

- Les trois appels RPC anonymes échouent avec `401 / 42501`.
- Les sondes anonymes sans ligne sur `clients`, `bookings`, `payments`, `admin_users` échouent également avec `401`.
- L'exclusivité service_role et l'absence d'alerte de sécurité sont confirmées par l'audit communiqué par l'utilisateur. Les catalogues PostgreSQL des ACL n'ont pas été lus à nouveau par cet accès HTTP. Aucun compte authenticated n'a été créé pour tester ses droits ; les refus anon/authenticated sont également couverts dans la base isolée.

## Vérifications locales

- `npm run typecheck` : réussi.
- `npm run lint` : réussi ; diagnostic final contrôlé à nouveau après finalisation.
- `npm test` : **124 tests réussis, 16 fichiers**. Parmi eux : comparaison des résultats complets des trois RPC, filtres/pagination, accès anon/authenticated/service_role, expiration, acteur invalide, idempotence des événements et concurrence PostgreSQL, sur bases isolées.
- Le test ciblé de la migration utilise désormais son nom `20261031085519_backend_rpc_contract_alignment.sql`.
- Le build et les tests navigateur n'ont pas été relancés : aucun composant, route ou code d'exécution Next.js n'a changé. Ces tests locaux ne constituent pas un parcours de réservation exécuté sur Supabase.

## Ce qui reste à valider avant un basculement

1. Plan d'initialisation soumis à validation : les **7 catégories et 16 prestations** détaillées dans la [revue du catalogue](SUPABASE_CATALOGUE_REVIEW.md), sans changement des prix, durées ou restrictions réglementaires. Aucun import réalisé.
2. Création contrôlée de l'unique administratrice et validation des paramètres Auth, horaires et conditions de réservation.
3. Recette distante autorisée : snapshot avec administratrice réelle, lecture du statut après expiration transactionnelle, catalogue peuplé, puis réservation et Stripe de test dans un cadre explicitement validé. Les résultats complets des deux RPC à effets de bord restent à vérifier à ce moment.

Modifications locales limitées : renommage des quatre SQL, mise à jour de leur référence dans le test et la revue de migration, ajout du diagnostic GET et du présent rapport, lien de mise à jour en tête du rapport historique. Aucun déploiement ni push.
