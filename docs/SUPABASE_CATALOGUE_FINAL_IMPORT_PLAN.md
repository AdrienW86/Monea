# MONÉA — Import définitif du catalogue : revue du 1er novembre 2026

> Import validé par l'utilisateur puis exécuté le 1er novembre 2026 : simulation ROLLBACK réussie, COMMIT réalisé, relecture intégrale conforme. Voir le [rapport d'exécution](SUPABASE_CATALOGUE_IMPORT_RESULT.md). Le texte ci-dessous conserve la revue préalable ; ne pas rejouer l'import.

**Prêt pour validation, aucun import distant effectué.** La copie SQLite actuelle contient 7 catégories et 16 prestations. Les 14 tarifs renseignés sont tous à **20 € provisoires** : ils sont conservés sans validation commerciale implicite. Les deux équipements restent sans prix.

## Données exactes à relire

- [Tableau complet des catégories et prestations](SUPABASE_CATALOGUE_REVIEW.md).
- [Payload complet : UUID, descriptions, images, catégories, tarifs, durées et restrictions](../.local/migration/catalogue-definitif-20261101/catalogue-payload.json).
- [Transaction SQL préparée, ROLLBACK par défaut](../.local/migration/catalogue-definitif-20261101/catalogue-review.sql).

Les 7 catégories actives sont Le visage, Les ongles, Mains & pieds, Prestations à l'étude, Le corps, Le regard et Le maquillage. Toutes les prestations sont visibles et ont une durée enregistrée de 60 minutes.

| Prestation | Tarif enregistré | Statut conservé |
| --- | --- | --- |
| Extensions de cils | 20 € provisoires | Active, réservation configurée au catalogue |
| Rehaussement de cils | 20 € provisoires | Active, réservation configurée au catalogue |
| Browlift | 20 € provisoires | Active, réservation configurée au catalogue |
| Teinture des cils et des sourcils | 20 € provisoires | Active, réservation configurée au catalogue |
| Prothésie ongulaire | 20 € provisoires | Active, réservation configurée au catalogue |
| Manucure · beauté des mains | 20 € provisoires | Bloquée : qualification non vérifiée |
| Beauté des pieds | 20 € provisoires | Bloquée : qualification non vérifiée |
| Nettoyage de peau | 20 € provisoires | Bloquée : qualification non vérifiée |
| Soins du visage | 20 € provisoires | Bloquée : qualification non vérifiée |
| Gommages et masques | 20 € provisoires | Bloquée : qualification non vérifiée |
| Modelage esthétique | 20 € provisoires | Bloquée : qualification non vérifiée |
| Épilation à la cire | 20 € provisoires | Bloquée : qualification non vérifiée |
| Maquillage esthétique | 20 € provisoires | Bloquée : qualification non vérifiée |
| Spray tan · douche bronzante | 20 € provisoires | Bloquée : qualification et procédé non vérifiés |
| Luminothérapie | Aucun tarif | À l'étude, non réservable |
| Appareil de bronzage UV | Aucun tarif | À l'étude, non réservable |

« Réservation configurée au catalogue » désigne les valeurs existantes `bookable=true` et `operational_status=active`, pas une ouverture du site. Les réservations publiques restent fermées. Les huit prestations avec qualification et le spray tan restent `coming_soon`, non réservables. Les équipements restent `equipment`, `study`, `bookable=false`, `price_cents=null`. Aucune attestation ou date de vérification ajoutée.

Les 16 images individuelles sont actuellement null : cette valeur sera conservée. Les images de catégories, utilisées par le site en repli, sont conservées avec leurs chemins exacts. Toutes les références non nulles vérifiées existent dans `public`. Aucun téléversement Storage requis pour cette copie du catalogue et aucun remplacement visuel.

## Source figée et contrôlée

Préparation depuis la base réellement configurée par `LOCAL_DATABASE_PATH`, ou son chemin par défaut. Sauvegarde cohérente incluant WAL par VACUUM INTO sur connexion source en lecture seule ; copie restaurée et contrôlée avant export. La base de travail n'est pas modifiée.

- Dossier : `.local/migration/catalogue-definitif-20261101/`.
- SHA-256 export : `224340bf2d186f9aba7b0d8d7179bddf53c58072d95315cd3fb5b03880c69b93`.
- SHA-256 SQL : `d9ca289cd3fa8e777a17b1ca1e5f195eedf3a7a9ad004612b3517ea9e618ea4b`.

Le payload de revue contient seulement catégories et prestations. Les autres collections éventuellement présentes dans la sauvegarde sont exclues du SQL.

## Cible observée en lecture seule

Projet `qnmpfswaeexpchietwzf` : zéro catégorie et zéro prestation au moment de la vérification, une administratrice et réservations fermées. Aucune écriture distante, même suivie d'un rollback, n'a été réalisée pour cette préparation.

Le trigger existant `assign_service_category` a été lu : pour un `category_id` fourni, il reprend le nom de la catégorie. Le générateur refuse donc une discordance nom/UUID dans la source plutôt que de laisser le trigger corriger silencieusement un champ. Les vérifications après insertion comparent également tous les champs importés.

## Garanties de la transaction

1. Après validation seulement : relire la cible et vérifier le SHA-256 du fichier approuvé. Si la source SQLite a changé, refaire la revue avant d'importer une nouvelle version.
2. Exécuter dans une seule transaction. Verrou applicatif puis verrous de table sur catégories et prestations, avec délais courts ; les verrous de table empêchent aussi les écritures concurrentes qui n'utilisent pas le verrou applicatif.
3. Insérer les catégories avant les prestations. Pour un UUID déjà présent : conserver la ligne si tous les champs importés sont identiques ; sinon lever une erreur. Un nom/slug unique déjà pris par un autre UUID fait échouer la transaction, sans remplacement automatique.
4. Aucun UPDATE, DELETE, UPSERT ni modification d'historique de migration. Les lignes sans rapport avec l'import sont conservées.
5. Vérifier dans la transaction chaque champ de chaque enregistrement après les triggers. Tout écart provoque une erreur et impose un rollback global. Ne jamais valider une transaction ayant échoué partiellement.
6. Le fichier actuel termine par ROLLBACK : toute exécution de revue annule les insertions. Pour l'import durable, remplacer uniquement cette dernière instruction par COMMIT après validation explicite du présent catalogue. Ce remplacement n'a pas été effectué sur un fichier d'application distante.
7. Après validation durable : relire 7 UUID catégories et 16 UUID prestations, champs et restrictions ; vérifier que paramètres de réservation, Auth, horaires, rendez-vous et paiements sont inchangés.

Le SQL ne touche pas `site_settings`, ne positionne pas `pricesValidated`, ne crée pas de créneau et n'active aucune réservation. Les prix à 20 € restent des prix provisoires jusqu'à une validation commerciale distincte. Aucune réapplication des quatre migrations.

## Tests effectués localement

- Test Vitest d'import catalogue : réussi. Rollback par défaut, répétition sans doublons, refus de modification d'un UUID existant et refus d'un slug existant avec un autre UUID, contraintes réglementaires et équipements conservés, paramètres de réservation inchangés.
- Test du fichier SQL exact de cette revue sur PGlite isolé : rollback vérifié ; deux applications COMMIT uniquement en mémoire, 7 catégories et 16 prestations, comparaison exacte de tous les champs du payload.
- Images référencées : aucune manquante.
- TypeScript et ESLint : réussis.
- Ni build ni recette navigateur relancés : aucun code applicatif ou design modifié.

Fichiers du projet modifiés : générateur `scripts/prepare-supabase-catalogue.mjs`, test `tests/supabase-catalogue-review.test.ts`, revue `docs/SUPABASE_CATALOGUE_REVIEW.md`, présent plan. Artefacts de sauvegarde et SQL ajoutés dans le dossier privé indiqué. `.env.local` inchangé : `DATA_PROVIDER=local`, `PAYMENT_PROVIDER=mock`.

**Validation attendue :** importer exactement ce catalogue et ses valeurs, y compris les 14 tarifs provisoires à 20 €, sans valider les prix commercialement, sans déblocage réglementaire et sans ouvrir les réservations. Aucune écriture distante avant cette validation.
