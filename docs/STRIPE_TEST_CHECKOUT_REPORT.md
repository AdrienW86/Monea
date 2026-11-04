# MONÉA — Préparation et vérification Stripe Checkout

Contrôles du 30 octobre 2026. Aucun paiement, même de test, n’a été créé dans le compte Stripe. Aucun déploiement, push, migration distante, envoi de message ou changement de l’administration/design n’a été effectué. `.env.local` et la base de travail restent inchangés.

## Résultat réel des contrôles

| Élément | Résultat |
| --- | --- |
| `STRIPE_API_KEY` | Présente, format test valide ; authentification Stripe réellement vérifiée par une requête en lecture seule, réponse en mode test |
| `STRIPE_PUBLISHABLE_KEY` | Présente, format `pk_test_` valide ; aucune utilisation côté navigateur dans ce Checkout hébergé |
| Ancien `STRIPE_SECRET_KEY` | Absent ; aucune copie créée |
| `STRIPE_WEBHOOK_SECRET` | Présent, format valide et égal au secret du listener Stripe CLI de test ; comparaison effectuée sans afficher les secrets |
| Clés live | Aucune détectée parmi les variables Stripe utilisées ; `ALLOW_LIVE_PAYMENTS` désactivé |
| Stripe CLI | Version 1.55.3 disponible ; aide et récupération masquée du secret vérifiées |
| Mode du projet | Toujours `DATA_PROVIDER=local`, `PAYMENT_PROVIDER=mock` |
| Supabase | Configuration absente ; aucune connexion distante tentée |
| Checkout hébergé payé puis webhook livré par Stripe | **Non exécuté** : le backend Supabase de recette n’est pas configuré |

Les préfixes test/live et le secret de signature distinct sont documentés par [Stripe](https://docs.stripe.com/keys). La clé publique n’a pas été authentifiée indépendamment ni rapprochée d’un compte ; son format seul est contrôlé. Elle n’intervient pas dans le parcours actuel, qui redirige vers `session.url`.

## Configuration adaptée sans duplication

`src/lib/payments/stripe.ts` lit désormais `STRIPE_API_KEY` en priorité et accepte `STRIPE_SECRET_KEY` comme alias historique. Si les deux existent avec des valeurs différentes, le client Stripe refuse de démarrer. Aucune variable n’est recopiée ni écrite dans `.env.local`.

Le format de la clé serveur et, lorsqu’elle est renseignée, de la clé publique est contrôlé. Une paire test/live incohérente est refusée. Les protections historiques des paiements live restent en place : aucune activation de production n’a été ajoutée.

`.env.example` présente les noms utilisés, sans valeurs. La clé privée reste dans un module `server-only`. Il n’est pas nécessaire de créer une variable `NEXT_PUBLIC_STRIPE_*` pour cette redirection Checkout.

Le webhook vérifie maintenant aussi que `event.livemode` correspond au mode de la clé serveur. Une clé test refuse donc un événement live signé, même si un flag de production était activé par erreur.

## Parcours et contrôle des montants

1. `/api/bookings` valide les coordonnées, l’origine et le quota. Le mode local conserve sa branche SQLite/mock. La branche Stripe exige les configurations Stripe **et** Supabase avant toute réservation.
2. La RPC `create_booking` réserve provisoirement le créneau et fige les lignes, prix et durées à partir des prestations en base. Les conditions d’ouverture, horaires, catégories et qualifications s’appliquent. Un prix envoyé par le navigateur est supprimé par la validation et n’est pas transmis comme tarif.
3. Le serveur utilise `b.price_cents`, en centimes et en euros, dans `line_items`. L’UUID de demande est la clé d’idempotence Stripe ; les métadonnées portent les identifiants de réservation/demande. Une session déjà attachée est reprise.
4. `/api/webhooks/stripe` utilise le corps brut et `constructEvent`, avec validation de signature et de fraîcheur. Un retour navigateur n’est jamais une preuve de paiement. [Vérification des signatures Stripe](https://docs.stripe.com/webhooks).
5. Seuls les événements admis sont traités. Une session completed mais non payée ne confirme rien. Le webhook refuse les montants absents, négatifs ou non entiers, les devises autres qu’EUR et les paiements positifs sans identifiant PaymentIntent ; cela empêche notamment un montant `NULL` de contourner une comparaison SQL.
6. `process_payment_event` vérifie le montant enregistré et applique la confirmation dans une transaction. L’événement n’est marqué traité que si cette transaction réussit. Le statut public est ensuite consultable par jeton.

Le nouveau test `tests/stripe-flow.test.ts` relie les vraies routes Next.js aux migrations PostgreSQL exécutées dans PGlite. Checkout est simulé ; la signature HMAC est réellement calculée et vérifiée par le SDK Stripe. Une prestation du catalogue **de test isolé** est fixée à 36,75 € ; une requête navigateur falsifiée à 0,01 € transmet bien 36,75 € à Checkout. Aucun tarif de travail n’a été modifié.

## Protections vérifiées

| Situation | Comportement vérifié |
| --- | --- |
| Double soumission avec même UUID | Même réservation et reprise de session ; pas de deuxième création Checkout après attachement |
| Même UUID avec un autre contenu | Refus par la transaction de réservation |
| Même événement reçu deux fois | Résultat `duplicate`, une seule confirmation |
| Deux événements de succès pour le même paiement | Résultat `already_paid`, pas de nouvelle notification |
| Signature invalide/ancienne, secret absent, événement live avec clé test | Refus avant toute écriture métier |
| Montant/devise erronés | Pas de confirmation ; rollback et réponse d’échec pour permettre une reprise |
| Erreur de base ou session inconnue | HTTP 500, transaction non validée, réessai possible |
| Échec asynchrone ou expiration | Créneau libéré, aucune confirmation ni notification d’encaissement |
| Session completed non payée | Acquittement sans confirmation ; attente d’un résultat payé |
| Paiement tardif après réattribution du créneau | Réconciliation et signalement, sans double réservation |
| Réservation annulée puis paiement tardif | Réconciliation, sans réactivation silencieuse |
| Retour navigateur success falsifié | Aucune confirmation sur la seule URL |
| Mode SQLite | Webhook Stripe refusé ; paiement fictif et stockage local préservés |

Les doublons peuvent provenir d’un même événement ou d’événements distincts ; Stripe ne garantit pas leur ordre de livraison. Les protections sont testées au niveau de l’événement et du paiement. [Documentation des webhooks](https://docs.stripe.com/webhooks#handle-duplicate-events).

Une carte refusée dans un Checkout carte peut laisser la session ouverte pour une nouvelle tentative : le refus carte n’est pas automatiquement un événement `async_payment_failed`. Le hold expire si le paiement n’aboutit pas. La vraie interaction carte/refus/3DS reste à tester sur Checkout hébergé avec les [moyens de paiement de test Stripe](https://docs.stripe.com/testing).

## Scripts de diagnostic et listener préparés

```powershell
# Contrôle local masqué ; aucun appel réseau :
npm run stripe:check

# Lecture seule auprès de Stripe, sans création de paiement :
node scripts/stripe-check.mjs --verify-api

# Comparaison masquée du secret local avec Stripe CLI :
node scripts/stripe-check.mjs --verify-cli

# Après configuration d’un backend Supabase de recette et démarrage de Next :
npm run stripe:listen
```

Le diagnostic interrompt les vérifications externes si une clé live, un format invalide ou un conflit entre alias est détecté. Codes de sortie : 0 valide, 1 configuration incomplète/échec de vérification, 2 clé live ou conflit.

`stripe:listen` charge les variables existantes, refuse SQLite ou un backend Supabase non configuré et n’accepte qu’une origine localhost/loopback. Il transmet la clé à la CLI par l’environnement du processus, sans argument contenant le secret. Il n’ajoute jamais `--live`. Il masque clés et secret webhook dans les lignes de sortie et s’arrête si le secret annoncé diffère de celui configuré.

La commande CLI préparée est équivalente à :

```text
stripe listen --skip-update --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded --forward-to <origine locale>/api/webhooks/stripe
```

Utiliser le wrapper fourni pour éviter l’affichage du secret par la commande native. Aucun endpoint distant n’a besoin d’être créé pour ce listener local. Le secret du listener est distinct du secret d’un éventuel endpoint hébergé : [Stripe CLI listen](https://docs.stripe.com/cli/listen).

Le lancement du wrapper a été testé dans la configuration actuelle : il refuse correctement de démarrer puisque le site reste en SQLite/mock sans Supabase. Aucun listener n’est laissé actif.

## Supabase : nécessaire pour quels tests ?

- Tests unitaires, SQL, webhooks signés synthétiques et SQLite/mock : **aucun Supabase distant nécessaire**. Ils utilisent des fixtures et bases isolées.
- Diagnostic de clé et comparaison du secret CLI : connexion Stripe en lecture seule, **pas de Supabase nécessaire**.
- Parcours réel de l’application vers Checkout puis confirmation persistante : **API Supabase/PostgREST fonctionnelle nécessaire**, locale ou dans un projet de recette dédié. La branche Stripe du projet utilise ses RPC ; elle ne fonctionne pas simplement en ajoutant une clé Stripe au mode SQLite/mock.
- Aucun projet de production n’est requis pour cette recette. Le mode SQLite n’a pas été converti en backend Stripe.

Pour la recette complète ultérieure, configurer les trois variables Supabase sur un environnement distinct, les migrations de la Mission 1, le catalogue, les qualifications, les horaires et les validations d’ouverture. Employer `DATA_PROVIDER=supabase`, `PAYMENT_PROVIDER=stripe`, une origine locale exacte et `RATE_LIMIT_SALT`. Conserver `ALLOW_LIVE_PAYMENTS=false` et `ENABLE_EXTERNAL_NOTIFICATIONS=false`. Ne pas modifier à l’aveugle la base ou les validations légales actuelles.

## Limite de reprise à traiter avant validation du Checkout connecté

Stripe impose une échéance de session située au moins 30 minutes après sa création. L’application persiste actuellement une échéance proche de 30 minutes, avec une marge de quelques secondes lorsque `checkoutMinutes=30`. [Paramètre `expires_at`](https://docs.stripe.com/api/checkout/sessions/create#checkout_session_create-expires_at).

La reprise d’une session déjà créée est couverte. En revanche, une première requête qui n’a jamais atteint Stripe, suivie d’une reprise tardive sans session connue, peut être refusée parce que l’échéance persistée est devenue trop proche. Il faut valider/adapter cette fenêtre de reprise en recette connectée en conservant l’idempotence et la cohérence avec le hold. Les tests simulés ne prouvent pas que Stripe accepte cette situation. Les règles de durée des holds et le schéma n’ont pas été modifiés dans cette mission.

Un simple `stripe trigger checkout.session.completed` crée une fixture qui ne correspond généralement à aucune réservation MONÉA. Il ne prouve pas le parcours métier ; le handler peut légitimement répondre 500 pour session inconnue. La recette complète devra partir d’une réservation créée par l’application et conserver ses métadonnées.

## Tests exécutés et fichiers concernés

- `npm test` : **117 réussis, 14 fichiers**, dont 4 nouveaux scénarios intégrés du parcours et les contrôles de clés, mode, signature et enveloppe.
- `npm run typecheck` et `npm run lint` : réussis.
- `npm run test:e2e:local` : **10 réussis**, ordinateur et mobile ; parcours fictif complet et fonctions locales préservés.
- `npm run test:e2e` : **27 réussis**, ordinateur, tablette et mobile ; site public, accessibilité, faux retours de paiement et garde-fous sans intégrations.
- `npm run build` : réussi, build production isolé dans `.next-qa`, clés et intégrations explicitement neutralisées dans le processus de compilation.
- Lecture Stripe test et comparaison du secret CLI : réellement exécutées, réussies. Aucune session Checkout Stripe, carte, charge ou remboursement externe créé.

Avertissements observés : API SQLite expérimentale dans Node ; un build a signalé le traçage trop large de `.local` par Turbopack. Le dossier contient des bases et sauvegardes privées : contrôler les exclusions/artefacts avant une future publication. Aucun déploiement n’est effectué ici, ni aucun changement du stockage local.

Fichiers modifiés/créés :

- `src/lib/payments/stripe.ts` : alias et contrôles de clés.
- `src/app/api/bookings/route.ts` : garde de configuration Supabase avant Checkout.
- `src/app/api/webhooks/stripe/route.ts` : mode cohérent et enveloppe de paiement validée.
- `.env.example`, `package.json` : noms documentés et commandes locales.
- `scripts/stripe-check.mjs`, `scripts/stripe-listen.mjs` : outils masqués.
- `tests/live-guard.test.ts`, `tests/checkout.test.ts`, `tests/routes.test.ts`, `tests/stripe-flow.test.ts` : vérifications.
- Ce rapport. Aucun composant visuel, fichier de style, fichier administrateur ou migration SQL modifié.

La prochaine étape est une recette Checkout hébergée sur backend de test explicitement configuré, avec validation de la reprise tardive. Cette livraison ne vaut pas validation de mise en production.
