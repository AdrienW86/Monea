# MONÉA — Données du catalogue proposées pour Supabase

Destination : `qnmpfswaeexpchietwzf`. Préparation locale uniquement ; aucun import exécuté.

Source : sauvegarde cohérente WAL et restauration vérifiée. SHA-256 de l’export : `224340bf2d186f9aba7b0d8d7179bddf53c58072d95315cd3fb5b03880c69b93`.

## Catégories (7)

| Catégorie | Active | UUID conservé |
| --- | --- | --- |
| Le visage | Oui | 37bb8a7b-ee15-441a-854d-5002c0e59bb1 |
| Les ongles | Oui | 596ce519-6e0f-46a4-bebb-f35ff955c251 |
| Mains & pieds | Oui | 88e17323-f711-4716-95a3-691901641df5 |
| Prestations à l’étude | Oui | 9e1a3256-bc7c-43ce-9f26-94cbb6b5fb15 |
| Le corps | Oui | badc37e0-8a40-47e0-a5a6-c0978668eb07 |
| Le regard | Oui | d2910099-6661-44a8-8518-7a78b4e2b270 |
| Le maquillage | Oui | ec0e8740-9b44-48b4-87b6-5114b82c0c90 |

## Prestations (16)

**Les 14 tarifs à 20 € sont provisoires, à confirmer commercialement.** Ils sont conservés tels quels pour cette proposition, sans validation des prix ni ouverture des réservations. Les obligations professionnelles sont conservées, sans attestation ajoutée.

| Prestation | Catégorie | Prix enregistré | Minutes | Qualification requise | Qualification/procédé validés | État | Réservable configuré | Visible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Extensions de cils | Le regard | 20.00 € (provisoire) | 60 | none | Non / Non | active | Oui | Oui |
| Rehaussement de cils | Le regard | 20.00 € (provisoire) | 60 | none | Non / Non | active | Oui | Oui |
| Browlift | Le regard | 20.00 € (provisoire) | 60 | none | Non / Non | active | Oui | Oui |
| Teinture des cils et des sourcils | Le regard | 20.00 € (provisoire) | 60 | none | Non / Non | active | Oui | Oui |
| Prothésie ongulaire | Les ongles | 20.00 € (provisoire) | 60 | none | Non / Non | active | Oui | Oui |
| Manucure · beauté des mains | Mains & pieds | 20.00 € (provisoire) | 60 | professional | Non / Non | coming_soon | Non | Oui |
| Beauté des pieds | Mains & pieds | 20.00 € (provisoire) | 60 | professional | Non / Non | coming_soon | Non | Oui |
| Nettoyage de peau | Le visage | 20.00 € (provisoire) | 60 | professional | Non / Non | coming_soon | Non | Oui |
| Soins du visage | Le visage | 20.00 € (provisoire) | 60 | professional | Non / Non | coming_soon | Non | Oui |
| Gommages et masques | Le visage | 20.00 € (provisoire) | 60 | professional | Non / Non | coming_soon | Non | Oui |
| Modelage esthétique | Le corps | 20.00 € (provisoire) | 60 | professional | Non / Non | coming_soon | Non | Oui |
| Épilation à la cire | Le corps | 20.00 € (provisoire) | 60 | professional | Non / Non | coming_soon | Non | Oui |
| Maquillage esthétique | Le maquillage | 20.00 € (provisoire) | 60 | professional | Non / Non | coming_soon | Non | Oui |
| Spray tan · douche bronzante | Le corps | 20.00 € (provisoire) | 60 | procedure | Non / Non | coming_soon | Non | Oui |
| Luminothérapie | Prestations à l’étude | Non renseigné | 60 | equipment | Non / Non | study | Non | Oui |
| Appareil de bronzage UV | Prestations à l’étude | Non renseigné | 60 | equipment | Non / Non | study | Non | Oui |

5 prestations sans restriction professionnelle sont configurées comme réservables. Aucune ouverture globale n’est activée par cet import.

## Hors import

Aucun paramètre, horaire, compte Auth, rendez-vous, cliente, paiement, notification ou historique de migration. Les lignes existantes identiques sont conservées ; un UUID différent associé au même nom/slug provoque un conflit à résoudre avant import. Aucune suppression, aucun UPDATE, aucun UPSERT. Le fichier SQL préparé termine par ROLLBACK et n’a pas été exécuté.

## Horaires à valider

La source contient 0 intervalle d’ouverture et 0 exception. Aucune plage réelle n’est inventée. Choisir les jours, heures, pauses et exceptions dans l’administration après validation ; pour le test, approuver une plage future explicite en Europe/Paris.

## Migrations locales à comparer (ne pas réappliquer)

| Version/fichier | SHA-256 local |
| --- | --- |
| 20261030115435_initial_schema.sql | 87f951e2d9986f8e313af3dd7f511b803c8d3fc9ebb928ae1b3f910ddea1b1f9 |
| 20261030115449_local_management_preparation.sql | 735213817be0b1a009aec11dcac5421434a6a564676f97c26a17eadac06c549b |
| 20261030115458_management_repository_parity.sql | b46154bf29a28347003e979eefc5ac9b1c0fd9d14bd14c2abd38b78e41ff7a88 |
| 20261031085519_backend_rpc_contract_alignment.sql | 63e033127b0e21e695faa739dc3828390e66ca13b684963f7b70941b8847478f |
