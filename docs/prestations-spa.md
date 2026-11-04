# MONÉA — Photos et catalogue simplifié

Travail effectué en local le 4 novembre 2026, sans déploiement ni écriture dans Supabase distant ou Stripe.

## Photos

Seize photographies d’illustration ont été générées avec l’outil Imagegen intégré, puis optimisées en WebP 1536 × 1024. Bois clair, linge ivoire, eucalyptus, lumière chaude et bougies constituent le fil conducteur. Ces images illustrent les soins ; elles ne documentent pas les locaux ou les clientes de l’institut.

| Univers | Asset utilisé |
|---|---|
| Cils et sourcils | `public/images/beauty/spa-regard-v2.webp` |
| Ongles et mains | `public/images/beauty/spa-ongles-v2.webp` |
| Soins du visage | `public/images/beauty/spa-visage-v2.webp` |
| Modelage | `public/images/beauty/spa-modelage-v2.webp` |
| Épilation | `public/images/beauty/spa-epilation-v2.webp` |
| Maquillage | `public/images/beauty/spa-maquillage-v2.webp` |
| Spray tan | `public/images/beauty/spa-spray-tan-v2.webp` |
| Beauté des pieds | `public/images/beauty/spa-pedicure-v2.webp` |
| Luminothérapie | `public/images/beauty/spa-luminotherapie-v2.webp` |
| UV | `public/images/beauty/spa-uv-v2.webp` |
| Extensions de cils | `public/images/beauty/spa-extensions-cils-v2.webp` |
| Browlift | `public/images/beauty/spa-browlift-v2.webp` |
| Teinture des cils et sourcils | `public/images/beauty/spa-teinture-cils-sourcils-v2.webp` |
| Prothésie ongulaire | `public/images/beauty/spa-prothesie-ongulaire-v2.webp` |
| Nettoyage de peau | `public/images/beauty/spa-nettoyage-peau-v2.webp` |
| Soin du visage | `public/images/beauty/spa-soin-visage-v2.webp` |

Les anciens visuels du catalogue sont remplacés à l’affichage par cette sélection. Les images personnalisées qui ne font pas partie des anciens assets restent prioritaires. Après le complément demandé, les 16 prestations disposent chacune d’une photo distincte : la première image du regard reste dédiée au rehaussement, celle des ongles à la manucure et celle du visage aux gommages et masques. Les images des familles sur l’accueil reprennent cette même sélection ; le petit visuel du hero est remplacé par le nouveau soin du visage. Les anciennes variantes du hero et l’ancienne référence de carte cadeau inutilisée sont retirées de la configuration. Les chemins des originaux, les prompts exacts et le mode de génération sont conservés dans [le manifeste initial](../design/generated-prestations.json) et [le complément de six photos](../design/generated-prestations-complement.json).

La vraie carte cadeau validée et les deux faces de la vraie carte de visite restent utilisées sans recréation. Leur provenance est décrite dans [le dossier des supports](corrections-supports.md).

## Catalogue et espace privé

- Catalogue et fiches : catégorie, nom, descriptif, prix TTC ; retrait des badges de statut, des mentions de qualification à vérifier et des durées dans ces présentations.
- La catégorie « Prestations à l’étude » devient « Technologies esthétiques ». Les anciens descriptifs provisoires sont remplacés par des textes de soin ; les descriptions personnalisées sont préservées.
- Espace privé → Catalogue : quatre champs, nom, catégorie, description et prix TTC. Les durées et autres données internes sont conservées lors des modifications.
- Espace privé → Catégories : nom et description. Une prestation tarifée enregistrée est ouverte à la réservation, sous réserve des vérifications internes déjà enregistrées et de la catégorie active.
- UV et luminothérapie n’ont aucun prix renseigné : affichage « Sur demande » et lien de contact, sans prix inventé.

## Ouverture locale demandée

Sur la déclaration explicite du propriétaire concernant les diplômes et sa demande d’ouvrir les prestations tarifées, 14 prestations ont été activées dans `.local/data/monea-development.sqlite`. Les confirmations internes ont été enregistrées avec une trace d’audit `owner_confirmed_catalogue`. Il s’agit de la déclaration du propriétaire, pas d’une vérification documentaire de diplômes par l’agent.

Les prix, durées et rendez-vous existants sont conservés. Une sauvegarde préalable se trouve dans `.local/backups/avant-ouverture-prestations-2026-11-04T09-56-28-522Z.sqlite`. Le script local correspondant est `scripts/activate-local-priced-services.mjs`.

**Aucun horaire d’ouverture n’est actuellement renseigné dans cette base locale.** Les prestations sont activées, mais les créneaux nécessitent la saisie des vrais horaires dans **Espace privé → Horaires**. Aucun horaire n’a été inventé.

La migration `20261104103000_qualified_equipment_catalogue.sql` est préparée et testée uniquement sur PostgreSQL embarqué : elle autorise un équipement déjà confirmé à être tarifé, avec conservation du verrou en l’absence de confirmation. Elle n’a pas été appliquée à une base distante.

## Vérifications et captures

- Suite unitaire initiale : 165 tests réussis ; deux cas supplémentaires SQLite/PostgreSQL réussis pour les équipements confirmés et tarifés, avec les suites ciblées (51 tests).
- Parcours locaux : 10 tests réussis sur ordinateur/mobile, dont création, modification et persistance du catalogue, réservation, conflit, annulation et confidentialité.
- Formulaires : contrôle supplémentaire de l’accessibilité AA au survol du bouton Enregistrer, sur ordinateur/mobile.
- Contrôles visuels et navigation : 6 tests réussis sur ordinateur, tablette et mobile ; images chargées, absence de débordement, contrastes AA et supports validés conservés.
- Captures finales avec prestations tarifées activées : 3 tests supplémentaires réussis. Compilation de production locale, lint et contrôle TypeScript réussis. La compilation conserve un avertissement existant sur le traçage trop large du dossier `.local`.
- Complément des images : captures accueil/catalogue/fiches actualisées sur ordinateur, tablette et mobile (3 tests réussis), avec vérification automatique de 16 sources d’images distinctes sur les 16 cartes du catalogue.

Les captures utilisent une base de test isolée. La série finale reproduit l’activation des prestations tarifées sans copier de données clientes.

| Vue | Ordinateur | Mobile |
|---|---|---|
| Accueil | [Capture](screenshots/prestations/apres/desktop/accueil.png) | [Capture](screenshots/prestations/apres/mobile/accueil.png) |
| Catalogue | [Capture](screenshots/prestations/apres/desktop/catalogue.png) | [Capture](screenshots/prestations/apres/mobile/catalogue.png) |
| Fiche visage | [Capture](screenshots/prestations/apres/desktop/prestation-reglementee.png) | [Capture](screenshots/prestations/apres/mobile/prestation-reglementee.png) |
| Carte cadeau | [Capture](screenshots/prestations/apres/desktop/cadeaux-section-cadeaux.png) | [Capture](screenshots/prestations/apres/mobile/cadeaux-section-cadeaux.png) |
| Supports imprimés | [Capture](screenshots/prestations/apres/desktop/supports-imprimes.png) | [Capture](screenshots/prestations/apres/mobile/supports-imprimes.png) |
| Catalogue privé | [Capture](screenshots/prestations/apres/desktop/admin-catalogue.png) | [Capture](screenshots/prestations/apres/mobile/admin-catalogue.png) |

Les formats tablette et les autres pages sont également disponibles sous `docs/screenshots/prestations/apres/`. Les captures du formulaire privé sont conservées dans `docs/screenshots/prestations/formulaires/`.
