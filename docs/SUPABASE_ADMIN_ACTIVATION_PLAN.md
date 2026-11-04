# MONÉA — Plan d'activation de l'administratrice Supabase

> Procédure actuelle : [opérations Dashboard, association UUID et fermeture des inscriptions après vérification du compte](SUPABASE_ADMIN_ACTIVATION_CHECKLIST.md). Ce document conserve l'analyse précédente ; l'ordre actuel demandé prévaut sur son ancienne proposition de fermeture avant création.

> Mise à jour : l'incohérence `PAYMENT_PROVIDER=mock` décrite dans ce plan historique est corrigée localement. Voir le [rapport de sécurisation des paiements](PAYMENT_PROVIDER_SECURITY_REPORT.md). Aucune activation Supabase ou Auth n'a été effectuée ; les validations prévues restent nécessaires.

Préparation du 31 octobre 2026. **Aucune activation exécutée.** Aucun compte créé, aucune inscription de test distante, aucun réglage Auth modifié, aucun import, paiement, migration ou appel distant effectué pendant cette intervention. Seul ce document est ajouté.

`DATA_PROVIDER=local` et `PAYMENT_PROVIDER=mock` sont conservés. Aucun changement du code applicatif, des données SQLite ou du design. Les constats distants cités proviennent de la [dernière vérification](SUPABASE_DEPLOYED_RPC_VERIFICATION.md), et devront être relus avant toute activation.

## 1. Authentification réellement utilisée

Avec la configuration actuelle, `isLocalProvider()` choisit l'authentification locale : identifiants `LOCAL_ADMIN_*`, cookie `monea_local_session`, jeton aléatoire dont le HMAC est stocké dans `local_sessions`, validité 12 heures et contrôle lié aux identifiants configurés. Ce mécanisme est réservé au développement. Les variables Supabase présentes ne basculent pas automatiquement la connexion.

En mode Supabase, le chemin existant est :

1. `POST /api/admin/login` : contrôle Origin, limitation des tentatives, validation email/mot de passe, `signInWithPassword` via le client SSR.
2. Vérification d'une ligne `admin_users.user_id = data.user.id` avec le client de session. Un compte Auth sans cette ligne est déconnecté et reçoit un refus.
3. Cookie SSR HttpOnly, SameSite=Lax, Secure en production ; `src/proxy.ts` rafraîchit/vérifie l'utilisateur et impose `private, no-store`. Le proxy n'est pas le contrôle d'autorisation final.
4. À chaque accès protégé, `requireAdmin()` appelle **`auth.getUser()`**, puis relit l'appartenance à `admin_users`. Il ne se fie ni au simple contenu d'un cookie, ni à `user_metadata`, ni à un email fourni dans la requête.
5. `requireManagementAdmin()` choisit le mécanisme local ou Supabase. L'identifiant vérifié est transmis aux RPC backend ; `assert_admin(p_actor)` constitue le contrôle SQL complémentaire.

Sources : `src/lib/auth/{local,management}.ts`, `src/lib/db/server.ts`, `src/proxy.ts`, `src/lib/data/provider.ts`.

`db()` utilise service_role dans un module `server-only`, sans session persistante. Ce client contourne RLS : les contrôles Next.js restent indispensables. `p_actor` n'est pas une preuve de session à lui seul. Les méthodes internes `snapshot(query, actor)` et `mutate(command, actor)` font confiance à l'appelant serveur lorsqu'un acteur est passé ; les points d'entrée examinés fournissent bien l'identité vérifiée, jamais celle d'un formulaire.

## 2. Inventaire des actions privilégiées

| Point d'entrée | Contrôle serveur constaté | Effets à prendre en compte pendant les tests |
| --- | --- | --- |
| `/admin/[[...section]]` | `requireManagementAdmin`, redirection vers connexion en cas de refus | Snapshot via backend ; peut expirer des réservations |
| `GET /api/admin/manage`, export JSON compris | `requireManagementAdmin`, acteur issu de la session | Rate limit écrit en base ; snapshot expire les réservations |
| `POST /api/admin/manage` | Origin + `requireManagementAdmin`, schéma de commande et acteur serveur | Mutations métier, aucune à lancer pendant la recette sans écriture |
| `POST /api/admin/media` | Origin + `requireManagementAdmin`, limites taille/type/fréquence | Écrit disque local ou bucket Supabase ; exclu des essais distants |
| `POST /api/admin/mutate` | Origin + `requireAdmin`, acteur `user.id`, validation d'entrée | Ancienne API encore active : mutations, remboursement Stripe et traitement d'outbox ; exclue des essais distants |
| `GET /api/admin/export` | `requireAdmin` avant lecture service_role | Écrit une entrée d'audit, même si c'est un GET |
| `POST /api/admin/logout` | Origin + `requireLocalAdmin` ou `requireAdmin` | Révocation de session ; voir limite ci-dessous |
| `POST /api/admin/login` | Identifiants Auth puis membership SQL, Origin et rate limit | Pas de session préalable par définition ; crée une session et des traces Auth |

Toutes les actions d'administration recensées ont une garde serveur. Les API publiques de contact/réservation/disponibilités et les traitements automatiques ne relèvent pas d'une session administratrice : elles ont leurs propres validations, la signature Stripe pour le webhook et le secret Bearer pour le cron. Ne pas les confondre avec des accès au back-office.

La politique locale `admin_self` autorise un utilisateur authenticated à lire sa propre appartenance. Les autres lectures privées exigent l'appartenance ; les clients ordinaires ne peuvent pas s'auto-promouvoir. Les trois nouvelles RPC restent réservées à service_role, y compris lorsqu'une administratrice se connecte : Next.js vérifie sa session avant l'appel privilégié.

## 3. Rattachement d'une seule administratrice — après validation

### Étape A : valider l'identité et les préconditions

- Confirmer l'adresse réelle de la gérante et la méthode de remise du mot de passe hors du chat, des journaux et du dépôt. Aucun mot de passe en ligne de commande.
- Relire les utilisateurs Auth et les appartenances en lecture seule. Dernier constat : zéro utilisateur et zéro appartenance. Si un compte existe déjà, vérifier son identité et le réutiliser plutôt que le remplacer.
- Contrôler à distance la clé étrangère `admin_users.user_id → auth.users.id` et `singleton boolean NOT NULL DEFAULT true UNIQUE CHECK(singleton)` : présentes dans le SQL local, ces contraintes imposent **au maximum une ligne**, pas l'existence obligatoire d'une administratrice. Aucun nouveau rôle ou migration n'est nécessaire si elles sont bien déployées.
- Arrêter si une autre appartenance existe. Aucun DELETE, remplacement, UPSERT changeant l'identité, ni remise à zéro.

### Étape B : fermer les inscriptions puis créer/rattacher le compte

Après validation explicite de ces écritures :

1. Dans Supabase Auth, désactiver **Allow new users to sign up** (`disable_signup=true`). Conserver le fournisseur email/mot de passe utilisé par `signInWithPassword`. Vérifier les connexions anonymes et les autres fournisseurs ; toute désactivation complémentaire devra figurer dans les paramètres approuvés. La désactivation des nouvelles inscriptions conserve la connexion des comptes existants. [Configuration officielle](https://supabase.com/docs/guides/auth/general-configuration).
2. Créer le compte par l'interface d'administration ou `auth.admin.createUser`, exclusivement depuis un contexte privilégié. Pas de route publique d'inscription et pas d'ajout manuel d'une ligne dans `auth.users`. Le choix de confirmation d'email doit être explicite ; `email_confirm=true` seulement après vérification de l'identité. Une invitation ou un email nécessite l'approbation de cet envoi. [API administrative](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
3. Récupérer l'UUID retourné et le vérifier par `getUserById`. Insérer uniquement `public.admin_users(user_id)` dans une transaction courte. Vérifier l'existence Auth et l'absence d'une appartenance différente sous verrou de table ; si la même appartenance existe déjà, ne rien écrire. La contrainte singleton protège aussi contre la concurrence. Ne jamais utiliser un email, `user_metadata.role` ou un UUID reçu du navigateur comme autorité.
4. Relire le lien et confirmer exactement une appartenance. La création Auth et l'insertion SQL ne sont pas atomiques ensemble : si le rattachement échoue, le compte reste sans privilèges. Signaler ce cas et reprendre le rattachement après contrôle ; ne pas supprimer le compte automatiquement.

Fermer d'abord les inscriptions évite une fenêtre de création publique. La création administrative doit être vérifiée indépendamment de l'inscription publique ; ne pas rouvrir les inscriptions en cas d'échec. Garder un accès propriétaire au tableau de bord pour la récupération.

À l'issue de cette étape, le compte peut exister sans que l'application locale l'utilise : le mode SQLite reste inchangé. Pas d'import catalogue ni d'activation des réservations dans cette étape.

## 4. Comptes ordinaires et sessions — recette prévue

| Cas | Résultat attendu |
| --- | --- |
| Aucun cookie, cookie local en mode Supabase, cookie altéré/expiré | Redirection des pages vers connexion ; API privées 401, aucune donnée métier |
| Identifiants Auth corrects mais aucune ligne `admin_users` | Login refusé, session déconnectée ; pages/API toujours interdites |
| `user_metadata` modifié pour annoncer un rôle admin | Aucun privilège supplémentaire |
| UUID administratrice injecté dans body/query par un compte ordinaire | Refus avant le repository ; `p_actor` doit provenir du serveur |
| Appels directs anon/authenticated aux trois RPC | Refus, même pour le JWT authenticated de la gérante |
| Tentative INSERT/UPDATE `admin_users` par authenticated | Refus ; aucune auto-promotion |
| Administratrice réelle et session vérifiée | Accès aux sections attendues, appels backend avec son UUID |
| Appartenance retirée dans une base isolée après connexion | Prochaine action refusée malgré le JWT encore valide |
| Origin absent ou différent sur POST | 403 avant mutation |
| Déconnexion puis réutilisation des cookies | Nouvelle requête de gestion refusée ; vérifier aussi renouvellement et expiration des JWT |

Les comptes ordinaires seront simulés sur une base Auth de recette isolée ; aucun second compte distant ne sera créé dans MONÉA pour ces tests sans validation spécifique. Les tests de session devront couvrir Next.js → Auth → membership → RPC, et pas seulement SQL.

Limites constatées à traiter dans une étape de correction séparément validée :

- `logout` exige encore le rôle admin : après retrait de l'appartenance, le compte ne peut plus utiliser cette route pour vider ses cookies. Les données restent protégées, mais la sortie de session doit être rendue utilisable pour une session Auth devenue ordinaire.
- `getUser()` vérifie l'utilisateur auprès d'Auth, mais cela ne démontre pas la révocation instantanée de tout access token après un signOut. Tester les durées effectives ; l'appartenance relue à chaque requête permet une révocation métier immédiate pour les nouvelles actions. Une action déjà en cours peut finir.
- Aucun parcours applicatif de réinitialisation du mot de passe ou MFA n'a été trouvé. Prévoir la récupération via l'administration Supabase avant la remise du compte ; ne pas prétendre que le formulaire actuel gère une invitation, un reset ou un challenge MFA.

## 5. Tests contrôlés des RPC, sans modification métier durable

### Niveau 1 — base isolée, faisable dès maintenant

Reconstruire les quatre migrations dans une base éphémère uniquement. Couvrir snapshot autorisé et refusé, filtres/pagination/redaction, statut absent et neuf champs publics, expiration de réservation sans paiement, rollback des effets d'expiration, droits anon/authenticated/service_role et singleton. Les données synthétiques restent dans cette base de test et ne sont jamais présentées comme des rendez-vous réels.

Tests existants exécutés pour cette préparation :

```text
npx vitest run tests/database.test.ts tests/backend-rpc-migration.test.ts tests/supabase-repository.test.ts
40 tests réussis / 3 fichiers
```

Ces tests couvrent SQL/RLS et l'adaptateur ; ils ne constituent pas une connexion réelle à Supabase Auth. La fixture navigateur existante `scripts/supabase-qa-server.mjs` utilise PostgreSQL réel avec des substituts HTTP Auth/PostgREST : elle ne certifie pas non plus le comportement du service Auth hébergé.

### Niveau 2 — RPC réellement déployées dans une transaction annulée

Après rattachement approuvé et validation de l'accès SQL, exécuter les deux fonctions sur **une seule connexion SQL**, transaction READ WRITE terminée obligatoirement par ROLLBACK. READ ONLY ne convient pas : `expire_holds()` tente des UPDATE. Un GET PostgREST resterait bloqué ; un POST HTTP ordinaire pourrait au contraire valider ces effets. Ne pas se fier à `Prefer: tx=rollback` sans vérifier que le serveur l'accepte. [Transactions PostgREST](https://docs.postgrest.org/en/stable/references/transactions.html).

Protocole prévu, non exécuté :

1. Capturer les comptes/états métier de référence sans extraire de données clientes.
2. `BEGIN` sur une connexion dédiée, avec délais de verrouillage et d'exécution courts ; `SET LOCAL ROLE service_role`. Ne pas utiliser postgres comme rôle d'exécution des fonctions.
3. Lire l'unique `admin_users.user_id`, contrôler sa présence et son lien Auth. Aucun faux compte ni appartenance temporaire dans MONÉA.
4. Appeler `management_snapshot(p_actor => UUID vérifié, p_query => '{"section":"lookup","page":0,"search":""}'::jsonb)`. Contrôler l'objet JSONB, ses tableaux, pagination et provider, puis le dashboard et les autres sections attendues. N'imprimer que les clés, comptes et booléens de conformité.
5. Appeler `repository_booking_status(p_token => UUID absent vérifié avant l'appel)` : attendre SQL NULL. Le catalogue vide n'empêche pas ces deux tests. Le cas d'une réservation existante et de ses neuf champs reste testé sur la base isolée ; ne pas créer de rendez-vous sur MONÉA pour ce contrôle.
6. Exécuter `ROLLBACK` dans un bloc finally, y compris en cas d'erreur ; fermer la connexion. Vérifier depuis une nouvelle transaction que les données métier de référence sont conservées. Les écritures éventuelles d'expiration et leurs déclencheurs transactionnels sont annulés, les verrous libérés. Inspecter auparavant les triggers pour exclure tout effet externe non transactionnel.

Ce test valide les résultats SQL des fonctions déployées et leurs effets annulables. Il ne prouve pas qu'une session navigateur est autorisée : c'est le niveau suivant. Aucun accès SQL direct n'est actuellement supposé disponible via la clé REST seule.

### Niveau 3 — vraie session Next.js, après validation distincte

La connexion Auth crée nécessairement des sessions, des horodatages et des journaux Auth ; les compteurs anti-abus écrivent aussi en base. Ces traces ne sont pas annulables par la transaction SQL du niveau 2. Ne pas annoncer une recette navigateur distante « sans aucune écriture durable ». Elle devra être autorisée pour ces traces, ou réalisée sur un environnement Auth isolé.

Pour tester le back-office Supabase sans basculer l'instance SQLite : préparer un processus Next.js de recette séparé, sur un autre port, avec variables de processus explicites et sans modifier `.env.local`. Le démarrage de ce processus connecté au vrai projet reste soumis à validation. Contrôler la connexion, le renouvellement de cookie et le refus des accès anonymes ; ne pas utiliser `/api/admin/export` ni cliquer de mutations pendant la recette.

**Précondition importante :** un simple `DATA_PROVIDER=supabase` avec `PAYMENT_PROVIDER=mock` ne constitue pas une isolation des paiements. `src/app/api/bookings/route.ts` et `integrationStatus()` peuvent utiliser Stripe en mode non local dès que ses clés sont présentes ; l'ancienne route admin de remboursement appelle aussi Stripe. L'instance de recette doit donc avoir Stripe et les transports externes explicitement indisponibles, les endpoints de mutation exclus des scénarios, et les réservations publiques fermées. Vérifier ces garanties avant son démarrage. Aucun basculement global ni changement de code n'est réalisé dans cette préparation.

## 6. Ordre des validations et critères de sortie

1. **Valider l'identité et les écritures Auth/membership** : adresse de la gérante, confirmation d'identité, mode de remise du secret, fermeture des inscriptions. Puis seulement exécuter l'étape 3.
2. **Valider la recette SQL annulée** : accès SQL habilité, rôle service_role, résultats masqués, rollback obligatoire ; aucun paiement ou catalogue requis.
3. **Valider la recette de session et son isolation** : autoriser les traces Auth/rate limit ou choisir une base isolée ; confirmer les protections empêchant tout appel Stripe et toute mutation métier distante involontaire.
4. **Décider séparément de l'activation applicative** : seulement après réussite de la connexion de la gérante et refus des comptes ordinaires. Catalogue, horaires, réservations et paiements restent des étapes ultérieures.

Fichiers susceptibles d'une correction ultérieure, uniquement si approuvée : garde et sortie de session (`src/lib/db/server.ts`, `src/app/api/admin/logout/route.ts`), isolation des paiements (`src/app/api/bookings/route.ts`, `src/lib/db/queries.ts`, `src/app/api/admin/mutate/route.ts`), scénarios d'authentification (`tests/`, `e2e-supabase/`). Aucune de ces corrections n'est incluse ici.
