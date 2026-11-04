# MONÉA — Résultat de l’audit Supabase en lecture seule

> État au 1er novembre 2026 après autorisation : catalogue de 7 catégories et 16 prestations importé et vérifié, réservations fermées et paramètres inchangés. Voir le [rapport d'import effectif](SUPABASE_CATALOGUE_IMPORT_RESULT.md). Cet audit historique précède l'import.

> **Mise à jour du 31 octobre 2026 :** la migration distante `20261031085519` est appliquée. La connexion est validée, 21/21 ensembles de colonnes et 16/16 signatures RPC correspondent désormais. Les quatre noms de migrations locaux ont été rapprochés sans changer leur SQL. Voir le [rapport de vérification des RPC déployées](SUPABASE_DEPLOYED_RPC_VERIFICATION.md) pour les résultats réels et les limites des tests en lecture seule. SQLite/mock sont conservés. Le texte ci-dessous reste l'état historique du 30 octobre et ses anciens blocages ne décrivent plus l'état actuel.

Audit du 30 octobre 2026, projet `qnmpfswaeexpchietwzf`. Ce rapport remplace le constat d’accès bloqué du plan précédent : les variables applicatives sont maintenant présentes et la connexion à l’API du projet fonctionne.

## Conclusion

**Connexion validée, basculement applicatif prématuré.** Les 21 tables attendues sont accessibles, mais le schéma exposé ne correspond pas entièrement au code local actuel. Aucun import, migration, réparation d’historique, compte Auth, réglage distant ou paiement n’a été créé/modifié.

`DATA_PROVIDER=local` et `PAYMENT_PROVIDER=mock` sont conservés. Les secrets n’ont été ni affichés ni copiés. Aucun fichier applicatif, style, logo ou migration existante n’a été modifié pour cet audit.

## Connexion et contenu observé sur le projet distant

- URL : correspond au projet demandé.
- Clé publique : format publishable ; l’endpoint public des paramètres Auth répond.
- Clé serveur : rôle service_role ; lecture effective des 21 tables réussie.
- Les 20 tables autres que `site_settings` sont vides : notamment catégories, prestations, clientes, rendez-vous, paiements, allocations, horaires, exceptions, notifications, archives et historiques métier.
- `site_settings` contient une ligne. Aucun des neuf champs contrôlés n’y est renseigné : `bookingEnabled`, `pricesValidated`, `legalReady`, `privacyReady`, `checkoutMinutes`, `holdMinutes`, `noticeHours`, `horizonDays`, `slotStepMinutes`. Cela ne constitue pas une autorisation d’initialiser ces valeurs.
- Aucun utilisateur Auth et aucune ligne dans `admin_users` : aucune administratrice Supabase n’est actuellement utilisable par l’application.
- Auth annonce `disable_signup=false` : les inscriptions publiques sont autorisées. Pour le modèle à administratrice unique, leur désactivation devra être proposée et validée séparément. Aucune inscription ni connexion de test n’a été effectuée. [Configuration Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration).

## Écarts de compatibilité avec le code local

Les trois migrations locales ont été chargées exclusivement dans un PGlite éphémère pour construire une référence. Elles n’ont pas été exécutées sur Supabase. La comparaison distante utilise seulement l’OpenAPI et des sélections sans ligne.

| Contrôle | Résultat distant |
| --- | --- |
| Tables attendues/exposées | 21 / 21 |
| Ensembles de colonnes identiques à la référence | 20 tables sur 21 |
| `payments.checkout_expires_at` | Absente ; confirmation par GET `select=checkout_expires_at&limit=0`, HTTP 400 / PostgreSQL `42703` |
| Signatures de RPC du parcours commun comparées | 13 conformes sur les 16 contrôlées |
| `management_snapshot(p_actor,p_query)` | Non exposée au backend dans l’OpenAPI |
| `repository_catalogue()` | Non exposée au backend dans l’OpenAPI |
| `repository_booking_status(p_token)` | Non exposée au backend dans l’OpenAPI |
| Auxiliaires `management_import_archive`, `admin_mutate_legacy` | Également non exposées dans l’OpenAPI |

Conséquences : `snapshot()` ne peut pas être considéré compatible sur ce projet ; catalogue/paramètres et statut public utilisent aussi des RPC non exposées. Le stockage de l’échéance Checkout prévu par la version locale n’a pas sa colonne. Un changement immédiat de `DATA_PROVIDER` risquerait donc de casser des pages et le back-office.

L’absence d’une RPC dans l’OpenAPI ne distingue pas à elle seule une fonction inexistante, un problème de privilèges ou un cache de schéma obsolète. Ses corps SQL ne sont pas consultables par cet accès. Les 13 signatures correspondantes ne prouvent pas l’identité de leurs implémentations. [Description OpenAPI PostgREST](https://docs.postgrest.org/en/stable/references/api/openapi.html).

## Permissions et limites de l’audit

Les lectures anonymes sans ligne de `clients`, `bookings`, `payments` et `admin_users` ont toutes reçu HTTP 401. Aucune donnée cliente n’a été extraite. L’OpenAPI anonyme n’est pas accessible.

Ces refus sont utiles mais ne certifient pas toutes les politiques RLS, contraintes et privilèges : la clé service_role contourne RLS et les tables sont vides. Le contrôle complet nécessite une lecture des catalogues PostgreSQL.

L’historique n’a pas pu être lu :

- Le connecteur Supabase continue de refuser l’accès au projet.
- La CLI requiert une authentification supplémentaire ; aucune version distante n’a été obtenue.
- Le schéma `supabase_migrations` n’est pas exposé par la Data API : HTTP 406 / `PGRST106`. Son exposition n’a pas été modifiée.

L’affirmation « trois migrations appliquées » n’est donc pas contredite quant au nombre, mais leur historique et leur équivalence avec les fichiers locaux restent **non vérifiés**. La présence des 21 tables ne garantit pas que la même révision de SQL a été appliquée.

Les versions locales à rapprocher sont `20261028142329`, `20261028164846`, `20261030114906`. Aucune n’a été réappliquée ou marquée artificiellement comme appliquée. Ne pas réparer l’historique avant clarification des écarts observés.

## Catalogue exact proposé, sans import effectué

[Revue complète des catégories, prestations, UUID, prix, durées et états](SUPABASE_CATALOGUE_REVIEW.md).

Les 7 catégories sont actives dans la source : **Le visage ; Les ongles ; Mains & pieds ; Prestations à l’étude ; Le corps ; Le regard ; Le maquillage**. Aucune catégorie ou prestation n’existe actuellement dans les tables distantes contrôlées.

| Prestation | Catégorie | Prix enregistré | Durée | État de réservation à conserver |
| --- | --- | --- | --- | --- |
| Extensions de cils | Le regard | 20 € | 60 min | Activée, sans qualification requise dans le catalogue |
| Rehaussement de cils | Le regard | 20 € | 60 min | Activée, sans qualification requise dans le catalogue |
| Browlift | Le regard | 20 € | 60 min | Activée, sans qualification requise dans le catalogue |
| Teinture des cils et des sourcils | Le regard | 20 € | 60 min | Activée, sans qualification requise dans le catalogue |
| Prothésie ongulaire | Les ongles | 20 € | 60 min | Activée, sans qualification requise dans le catalogue |
| Manucure · beauté des mains | Mains & pieds | 20 € | 60 min | Bloquée : qualification non validée |
| Beauté des pieds | Mains & pieds | 20 € | 60 min | Bloquée : qualification non validée |
| Nettoyage de peau | Le visage | 20 € | 60 min | Bloquée : qualification non validée |
| Soins du visage | Le visage | 20 € | 60 min | Bloquée : qualification non validée |
| Gommages et masques | Le visage | 20 € | 60 min | Bloquée : qualification non validée |
| Modelage esthétique | Le corps | 20 € | 60 min | Bloquée : qualification non validée |
| Épilation à la cire | Le corps | 20 € | 60 min | Bloquée : qualification non validée |
| Maquillage esthétique | Le maquillage | 20 € | 60 min | Bloquée : qualification non validée |
| Spray tan · douche bronzante | Le corps | 20 € | 60 min | Bloquée : qualification et procédé non validés |
| Luminothérapie | Prestations à l’étude | Non renseigné | 60 min | À l’étude : équipement, non réservable |
| Appareil de bronzage UV | Prestations à l’étude | Non renseigné | 60 min | À l’étude : équipement, non réservable |

Ces valeurs sont celles de SQLite, pas une nouvelle validation professionnelle ou tarifaire. Les neuf prestations bloquées restent `bookable=false`, `operational_status=coming_soon`, sans qualification/procédé ajouté ; les deux équipements restent `study`, sans tarif et non réservables. Les cinq prestations activées ne deviennent pas réservables sans horaires et validation globale d’ouverture.

La source ne contient **aucun horaire** : aucune ouverture n’est proposée comme donnée réelle. Il faudra faire valider une plage de recette ou les horaires commerciaux séparément.

## Lot préparé et garanties avant validation

Nouvelle sauvegarde cohérente WAL avec restauration contrôlée : `.local/migration/supabase-readonly-audit-20261030/`.

- Export : `export.json`, SHA-256 `ffafafd3a278fc6507fe7eae2fe4db08f1e5758591fdf425b82a6c2efea5643f`.
- Sauvegarde/restauration : même SHA-256 `db66504f7c0d4328359496a6ae8504529e71abcb9886eb9712c2a291e31211cb`, identique à la sauvegarde précédente.
- Lot proposé : `catalogue-review.sql` — uniquement 7 catégories et 16 prestations, sans UPDATE, suppression ou écrasement. Rejeu sans doublon pour les données identiques ; refus des conflits. Il se termine par ROLLBACK et n’a pas été exécuté sur Supabase.
- Aucun paramètre, compte Auth, horaire, cliente, rendez-vous, paiement, notification ou historique de migration dans ce lot.

Le test de ce générateur sur PostgreSQL isolé a été exécuté à l’étape précédente : conservation des paramètres, restrictions, rejeu et refus des modifications existantes. Ce résultat ne transforme pas l’import proposé en import distant effectué.

## Suite proposée avant toute écriture

1. Autoriser une lecture SQL par le connecteur ou faire exécuter [le fichier d’audit READ ONLY](SUPABASE_REMOTE_READONLY_AUDIT.sql) dans l’éditeur SQL du projet. Contrôler les définitions/privilèges des RPC et les versions réellement enregistrées.
2. Présenter une correction ciblée des écarts confirmés — ou un réglage de droits/cache si c’est la cause des RPC non exposées — puis demander validation. **Ne pas réappliquer les trois migrations** et ne pas masquer les écarts par une simple réparation d’historique.
3. Après cette clarification, faire valider le lot exact 7/16 et l’importer transactionnellement en préservant tous les paramètres distants. Vérifier les lignes après import.
4. Faire valider séparément l’identité de l’unique administratrice, la fermeture des inscriptions, les horaires et les réglages d’ouverture. Ne pas créer d’utilisateur ou passer les validations légales à true sans accord.
5. Garder SQLite/mock jusqu’à une validation explicite de bascule. Les scénarios Stripe test, leur marquage et la reprise tardive restent ceux du [plan précédent](SUPABASE_CONNECTION_APPROVAL_PLAN.md) ; aucun n’a été exécuté pendant cet audit.

L’audit distant a utilisé seulement GET/HEAD. Aucun RPC métier susceptible d’expirer des holds, aucune connexion Auth, aucune commande de mutation SQL, aucun appel Stripe, aucun déploiement et aucun push.

Preuve technique expurgée : `.local/migration/supabase-readonly-audit-20261030/remote-schema-audit.json`. Le code de sortie 1 de l’outil de schéma signale les écarts de compatibilité détectés, **pas** un échec de connexion.
