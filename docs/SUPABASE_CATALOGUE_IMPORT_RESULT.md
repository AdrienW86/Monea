# MONÉA — Import catalogue effectué le 1er novembre 2026

**Import distant terminé et vérifié** sur `qnmpfswaeexpchietwzf`, après validation explicite de l'utilisateur. 7 catégories et 16 prestations enregistrées, avec conservation exacte de tous les champs du payload approuvé.

## Déroulement réel

1. Hash du SQL de revue vérifié : `d9ca289cd3fa8e777a17b1ca1e5f195eedf3a7a9ad004612b3517ea9e618ea4b`.
2. Catalogue SQLite actuel comparé champ par champ au payload approuvé : identité complète ; aucun changement de la source depuis la revue.
3. Précontrôle distant : catalogue vide, administratrice unique, réservations fermées, prix non validés. Trigger de catégorie inspecté : aucun envoi externe.
4. Simulation sur le véritable Supabase, dans une seule transaction avec verrous et contrôles : 7 catégories, 16 prestations, 5 actives, 9 réglementées bloquées et 2 équipements à l'étude. ROLLBACK exécuté.
5. Relecture hors transaction : zéro catégorie, zéro prestation, réglages inchangés et zéro notification. Annulation de la simulation confirmée.
6. Même transaction protégée, avec COMMIT autorisé. Contrôles de contenu, tarifs, visibilité, restrictions et paramètres exécutés avant validation.
7. Relecture distante après COMMIT, depuis une nouvelle requête : **tous les champs des 23 lignes correspondent exactement au payload approuvé**, sans différence.

Les protections supplémentaires d'exécution vérifiaient les comptes attendus, l'absence de notification et l'empreinte des paramètres. Aucun UPDATE/DELETE/UPSERT, aucune migration réappliquée.

## Catégories effectivement enregistrées

| Catégorie | UUID | Active |
| --- | --- | --- |
| Le visage | 37bb8a7b-ee15-441a-854d-5002c0e59bb1 | Oui |
| Les ongles | 596ce519-6e0f-46a4-bebb-f35ff955c251 | Oui |
| Mains & pieds | 88e17323-f711-4716-95a3-691901641df5 | Oui |
| Prestations à l’étude | 9e1a3256-bc7c-43ce-9f26-94cbb6b5fb15 | Oui |
| Le corps | badc37e0-8a40-47e0-a5a6-c0978668eb07 | Oui |
| Le regard | d2910099-6661-44a8-8518-7a78b4e2b270 | Oui |
| Le maquillage | ec0e8740-9b44-48b4-87b6-5114b82c0c90 | Oui |

## Prestations effectivement enregistrées

**Les 14 tarifs à 20 € restent provisoires et ne sont pas commercialement validés.** Toutes les durées sont conservées à 60 minutes. « Bookable » désigne le champ du catalogue, pas l'ouverture globale des réservations.

| Prestation | Catégorie | Tarif | Minutes | Visible | État SQL | Bookable | Restriction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Extensions de cils | Le regard | 20 € provisoires | 60 | Oui | active | Oui | Aucune exigence dans la source |
| Rehaussement de cils | Le regard | 20 € provisoires | 60 | Oui | active | Oui | Aucune exigence dans la source |
| Browlift | Le regard | 20 € provisoires | 60 | Oui | active | Oui | Aucune exigence dans la source |
| Teinture des cils et des sourcils | Le regard | 20 € provisoires | 60 | Oui | active | Oui | Aucune exigence dans la source |
| Prothésie ongulaire | Les ongles | 20 € provisoires | 60 | Oui | active | Oui | Aucune exigence dans la source |
| Manucure · beauté des mains | Mains & pieds | 20 € provisoires | 60 | Oui | coming_soon | Non | Qualification non vérifiée |
| Beauté des pieds | Mains & pieds | 20 € provisoires | 60 | Oui | coming_soon | Non | Qualification non vérifiée |
| Nettoyage de peau | Le visage | 20 € provisoires | 60 | Oui | coming_soon | Non | Qualification non vérifiée |
| Soins du visage | Le visage | 20 € provisoires | 60 | Oui | coming_soon | Non | Qualification non vérifiée |
| Gommages et masques | Le visage | 20 € provisoires | 60 | Oui | coming_soon | Non | Qualification non vérifiée |
| Modelage esthétique | Le corps | 20 € provisoires | 60 | Oui | coming_soon | Non | Qualification non vérifiée |
| Épilation à la cire | Le corps | 20 € provisoires | 60 | Oui | coming_soon | Non | Qualification non vérifiée |
| Maquillage esthétique | Le maquillage | 20 € provisoires | 60 | Oui | coming_soon | Non | Qualification non vérifiée |
| Spray tan · douche bronzante | Le corps | 20 € provisoires | 60 | Oui | coming_soon | Non | Qualification et procédé non vérifiés |
| Luminothérapie | Prestations à l’étude | Aucun | 60 | Oui | study | Non | Équipement à l'étude |
| Appareil de bronzage UV | Prestations à l’étude | Aucun | 60 | Oui | study | Non | Équipement à l'étude |

Les 9 prestations réglementées restent non réservables, avec leurs vérifications de qualification/procédé non renseignées. Les deux équipements restent `equipment`, `study`, `bookable=false`, `price_cents=null`. Les 5 prestations sans exigence dans la source restent `active` et `bookable=true`. Aucun changement d'habilitation.

UUID, slug, nom, description, catégorie et son UUID, image (y compris valeurs nulles ou vides), ordre, visibilité, bookable, prix, durée, état, exigences, dates de vérification et indicateur demo ont été relus et comparés intégralement. Les dates techniques de création/mise à jour sont celles attribuées par le schéma distant et ne font pas partie des données métier validées à recopier.

## Réglages et autres données préservés

Empreinte MD5 de la ligne complète `site_settings(id=1)`, avant simulation, après rollback et après commit : `d88c15dcda33a1fdf1ab21c90b15e9a9`, identique.

Précision : les clés JSON `bookingEnabled` et `pricesValidated` sont absentes dans la ligne existante ; les valeurs effectives restent **false** par les valeurs par défaut de Next.js et les contrôles SQL `coalesce(..., false)`. Elles n'ont pas été ajoutées ni réécrites, conformément à l'interdiction de modifier les paramètres de réservation.

Relecture finale :
- Administratrice : 1, préservée.
- Rendez-vous : 0 ; paiements : 0 ; allocations : 0.
- Horaires récurrents : 0.
- Notifications outbox : 0 ; notifications de gestion : 0.
- Réservations effectives : fermées ; prix commercialement validés : non.
- Aucun appel Stripe, aucun envoi de notification, aucun déploiement.
- Configuration principale conservée : `DATA_PROVIDER=local`, `PAYMENT_PROVIDER=mock` ; aucune modification du design ou du code applicatif.

## Traçabilité

- [Payload intégral approuvé et vérifié](../.local/migration/catalogue-definitif-20261101/catalogue-payload.json).
- [Simulation réellement exécutée, copie d'audit à ne pas rejouer](../.local/migration/catalogue-definitif-20261101/executed-simulation.sql).
- [Transaction COMMIT exécutée, copie d'audit à ne pas rejouer](../.local/migration/catalogue-definitif-20261101/executed-commit.sql).
- [Plan validé et garanties de préparation](SUPABASE_CATALOGUE_FINAL_IMPORT_PLAN.md).

Les tests pertinents de cette opération sont la simulation distante annulée, ses contrôles avant/après, puis la comparaison intégrale après COMMIT. Les tests isolés/TypeScript/lint de préparation restent documentés dans le plan ; ils n'ont pas été relancés pour cette exécution sans changement de code.

