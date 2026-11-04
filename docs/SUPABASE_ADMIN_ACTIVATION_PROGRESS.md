# MONÉA — Activation administratrice : suivi des opérations

> Clôture du 1er novembre 2026 : compte vérifié et rattaché, inscriptions fermées, connexion navigateur et snapshot Next.js/Supabase réussis. Recette temporaire arrêtée, instance principale conservée en SQLite/mock. Voir les [résultats définitifs](SUPABASE_ADMIN_ACTIVATION_RESULT.md). Le précontrôle historique ci-dessous précède la création du compte.

31 octobre 2026. La procédure est autorisée par l'utilisateur, sous maintien de SQLite/mock, réservations fermées, sans import ni déploiement.

## Précontrôles effectués sur le véritable projet

Projet confirmé : `qnmpfswaeexpchietwzf`.

- Connexion API avec les clés locales : fonctionnelle ; aucune valeur secrète affichée.
- Connecteur SQL Supabase : désormais accessible, contrairement aux constats historiques.
- Aucun compte Auth ni ligne `admin_users` au moment du précontrôle.
- Contraintes distantes vérifiées : clé primaire `user_id`, clé étrangère vers `auth.users(id)`, `CHECK(singleton)`, `UNIQUE(singleton)`.
- Réservations distantes : `coalesce(bookingEnabled,false)=false`. Aucun paramètre modifié.
- Catalogue : zéro catégorie et zéro prestation ; aucun import effectué.
- Les trois RPC ont EXECUTE pour service_role et pas pour anon/authenticated, vérification des privilèges PostgreSQL sur le véritable projet.
- Appels HTTP anonymes réels aux trois RPC : HTTP 401 / `42501`.
- `management_snapshot` avec acteur absent/non habilité : refus `P0001 / UNAUTHORIZED`.
- `repository_booking_status` en GET : écriture d'expiration bloquée par READ ONLY (`25006`), sans modification durable.
- Paramètres Auth publics : fournisseur email actif, inscriptions encore ouvertes (`disable_signup=false`). Leur fermeture attend la création et la vérification du compte, conformément à l'ordre autorisé.
- `DATA_PROVIDER=local` et `PAYMENT_PROVIDER=mock` vérifiés, inchangés.

## Action utilisateur nécessaire

Créer l'utilisatrice dans Authentication → Users → Add user → Create user du Dashboard MONÉA. L'utilisateur choisit l'adresse et saisit le mot de passe directement dans le Dashboard. Communiquer uniquement l'adresse choisie et le véritable User UID ; aucun mot de passe ni clé dans le chat ou le rapport.

## Étapes autorisées restant à effectuer

1. Vérifier le compte par son UUID et son adresse, sa confirmation email et son état non anonyme/non banni.
2. Rattacher cet UUID à l'unique `public.admin_users` sans remplacement d'une autre identité, puis relire le résultat.
3. Fermer les inscriptions publiques après vérification. Le connecteur SQL disponible ne comporte pas d'opération de configuration Auth ; si aucun accès de gestion Auth n'est disponible, guider l'utilisateur pour cette bascule Dashboard puis vérifier `disable_signup=true` par l'API publique. Ne pas essayer de remplacer ce paramètre de service par une écriture directe dans le schéma Auth.
4. Tester le snapshot réel sous rôle service_role en transaction annulée, à partir de l'appartenance vérifiée, sans données synthétiques sur MONÉA.
5. Vérifier la connexion de l'administratrice dans un processus Next.js de recette séparé, en conservant l'instance principale et `.env.local` en SQLite/mock. Les identifiants ne doivent pas être demandés dans le chat. Les sessions et traces Auth éventuelles sont distinctes des données métier annulables.
6. Compléter le rapport avec les résultats effectifs. Les tests isolés antérieurs ne seront pas présentés comme une connexion Auth distante réelle.

À ce stade, aucune création, association, modification Auth, activation Supabase, opération Stripe ou migration n'a été effectuée par l'agent. Le snapshot avec une véritable administratrice reste en attente de la création de ce compte.
