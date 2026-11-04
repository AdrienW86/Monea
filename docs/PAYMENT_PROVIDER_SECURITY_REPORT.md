# MONÉA — Sécurisation du fournisseur de paiement

31 octobre 2026. Configuration conservée : `DATA_PROVIDER=local`, `PAYMENT_PROVIDER=mock`. Aucun secret affiché, aucune requête Stripe réelle, aucune écriture distante, migration, import ou activation Supabase. Aucun changement de design.

## Correction

La politique est centralisée dans [`src/lib/payments/provider.mjs`](../src/lib/payments/provider.mjs), module réservé à l'exécution serveur avec refus d'exécution dans le navigateur, partagé avec les scripts Node. Il ne contient aucune clé. La construction du SDK reste dans le module `server-only` `stripe.ts`.

- Seul `PAYMENT_PROVIDER=stripe` autorise Stripe, et jamais avec `DATA_PROVIDER=local`.
- `mock`, valeur absente ou valeur inconnue refusent Stripe. Aucun choix implicite de Stripe à partir de la présence des clés.
- Les simulations restent limitées à SQLite en développement. Aucun paiement mock Supabase n'est créé.
- La sélection est relue à chaque contrôle, sans cache du fournisseur.
- Les appels HTTP du SDK sont également protégés : un client construit en mode Stripe puis utilisé en mode mock échoue avant `fetch`, y compris sur les nouvelles tentatives.
- Les contrôles existants de format des clés, cohérence test/live et autorisation explicite du live restent en place.

## Points d'entrée audités et sécurisés

| Point d'entrée | Résultat en mode mock |
| --- | --- |
| `POST /api/bookings`, branche Supabase | `503`, code `PAYMENT_PROVIDER_DISABLED`, avant rate limit et création de réservation ; ni création Checkout ni récupération d'une ancienne session |
| `POST /api/admin/mutate`, action `refund` | Garde après vérification administratrice/entrée, avant rate limit, `prepare_refund` et appel Stripe ; aucun changement financier préalable au refus |
| `POST /api/webhooks/stripe` | `503` avant lecture/signature/traitement SQL, même pour un événement valablement signé ; aucun `process_payment_event` |
| `stripeClient()` | Construction refusée ; le transport d'une instance conservée est aussi bloqué |
| `integrationStatus().Stripe` | `false` indépendamment des clés ; lectures et actions administratives sans Stripe restent disponibles |
| `stripe-check.mjs --verify-api` / `--verify-cli` | Refus avant API ou démarrage de CLI ; le diagnostic de format sans réseau reste disponible |
| `stripe-listen.mjs` | Refus avant démarrage du listener |

La recherche des points d'appel a trouvé deux constructions du SDK : la fabrique serveur et le diagnostic CLI, toutes deux protégées. Dans l'application, les opérations réseau présentes sont la création/récupération Checkout et le remboursement. Aucune route actuelle n'appelle `paymentIntents.confirm`, `checkout.sessions.expire` ou une autre annulation Stripe. Ces méthodes sont néanmoins couvertes par la garde commune du transport et par les tests d'une instance conservée.

Les annulations métier existantes ne déclenchent pas de remboursement Stripe automatique : elles restent disponibles selon leurs contrôles administrateur habituels. Les pages de retour lisent un état en base et ne confirment aucun paiement. Les tâches d'expiration SQL restent fonctionnelles : une expiration métier ne constitue pas une preuve d'encaissement.

Les webhooks refusés reçoivent une réponse non réussie pour permettre à Stripe de réessayer. Ils ne sont pas enregistrés comme consommés. Leur éventuel traitement après une future réactivation explicite de Stripe conserve les vérifications de signature, montant, devise, mode et idempotence existantes.

## Séparation des paiements fictifs

- `/api/payments/mock` refuse Supabase avant toute simulation.
- SQLite continue de produire `payment_provider=mock`, `payment_status=mock_paid` pour une simulation réussie, jamais `paid`. Le rendez-vous de démonstration peut être confirmé comme auparavant, sans prétendre à un encaissement réel.
- Les contraintes SQL existantes `payment_mock_separation` interdisent le statut réel `paid` et les identifiants Stripe sur un paiement mock.
- Tests renforcés sur un import **isolé** : le paiement mock reste `mock_paid`, une mise à jour vers `paid` échoue et un événement Stripe essayant de s'y rattacher échoue sans entrée durable dans `webhook_events`.
- Un paiement Stripe pending dans PostgreSQL isolé reste identique après des webhooks signés reçus en mode mock : ni confirmation, ni remboursement, ni expiration par ces événements. Le même parcours reste traitable après retour explicite au mode Stripe.

## Scénarios vérifiés

Le nouveau fichier `tests/payment-provider.test.ts` utilise le véritable SDK avec un `fetch` remplacé par un espion qui refuse tout réseau inattendu. Il contrôle :

- SQLite/mock et Supabase/mock, clés de test présentes : aucune construction autorisée ni requête Stripe.
- Fournisseur absent, invalide ou mauvaise casse : refus fermé.
- Checkout nouveau/reprise, remboursement et les cinq événements webhook acceptés habituellement : refus explicite, aucune RPC de paiement.
- Lecture administrative et annulation métier : fonctionnement conservé avec Supabase/mock.
- Paiement fictif sur Supabase : refus sans simulation.
- Client SDK conservé : création, récupération, expiration Checkout, confirmation PaymentIntent et remboursement refusés avant tout `fetch` après passage en mock.
- Stripe avec clés synthétiques `sk_test_`/`pk_test_` : récupération de session à travers le SDK avec réponse HTTP substituée.

Les tests existants Checkout et webhook sélectionnent désormais explicitement `PAYMENT_PROVIDER=stripe`. Les scénarios base isolée continuent de vérifier prix serveur, signature HMAC réelle, confirmation transactionnelle, répétition du webhook, montant falsifié, refus et expiration. Les contrôles live restent testés.

Le diagnostic local a également constaté, sans valeurs de clés : clés configurées de format test, aucun conflit d'alias, aucun flag live, configuration local/mock inchangée. L'exécution `stripe-check --verify-api --verify-cli` se termine avec le refus attendu `PAYMENT_PROVIDER_DISABLED` et ne contacte aucun fournisseur.

**Limite explicite :** aucun Checkout hébergé, remboursement, test de connectivité Stripe ou parcours Supabase distant n'a été exécuté. Les réponses Stripe sont substituées et les écritures SQL se limitent aux bases de test. Les tests du SDK prouvent l'autorisation et le blocage du transport dans le code, pas la réussite d'un paiement sur le service Stripe.

## Validation

- TypeScript : réussi.
- ESLint : réussi.
- Tests Vitest : **145 tests réussis, 17 fichiers**, suite complète.
- Build Next.js : réussi. Avertissement Turbopack sur le motif trop large `.local` dans `src/lib/data/local.ts:67`, hors des fichiers fonctionnels modifiés ; avertissements Node sur SQLite expérimental. Aucun échec.
- Tests navigateur non relancés ; aucune modification de composant visuel. La recette Stripe hébergée reste non exécutée.
- Aucun composant visuel, style, logo, police ou animation modifié.

## Fichiers concernés

- Politique et SDK : `src/lib/payments/provider.mjs`, `src/lib/payments/stripe.ts`.
- Compatibilité et état des intégrations : `src/lib/data/provider.ts`, `src/lib/db/queries.ts`.
- Réponse d'erreur explicite : `src/lib/security.ts`.
- Routes : `src/app/api/bookings/route.ts`, `src/app/api/admin/mutate/route.ts`, `src/app/api/webhooks/stripe/route.ts`.
- Diagnostics : `scripts/stripe-check.mjs`, `scripts/stripe-listen.mjs`.
- Tests : `tests/payment-provider.test.ts`, `tests/live-guard.test.ts`, `tests/checkout.test.ts`, `tests/routes.test.ts`, `tests/stripe-flow.test.ts`, `tests/local-transfer.test.ts`.
- Documentation : ce rapport et lien de résolution dans le plan d'activation administratrice.

Les quatre migrations, `.env.local`, SQLite et les fonctions SQL déployées ne sont pas modifiées.
