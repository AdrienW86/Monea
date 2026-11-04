# MONÉA — Refonte naturelle, spa et végétale

## Direction graphique

Cette version remplace la simple refonte de palette. Le nouveau brief autorise la réorganisation visuelle des pages publiques.

L’accueil adopte une composition claire, avec un texte à gauche, une grande image d’ambiance en arche et une photographie beauté en petit format. Le bois miel, le linge ivoire, la bougie et l’eucalyptus donnent une présence concrète aux matières demandées. Le vert olive se concentre sur les boutons, les signatures et les feuilles. Les grandes surfaces sont crème, lin et sable, avec des détails cuivrés.

Les univers de prestations sont présentés dans des cartes sans superposition de texte sur les photos. La mise en scène alterne trois grandes images et quatre formats plus petits sur ordinateur, puis deux colonnes sur mobile. Les sections de présentation et de cadeaux utilisent un grain léger et des nuances boisées, sans fond répétitif de planches. Les illustrations botaniques sont des SVG décoratifs non annoncés aux lecteurs d’écran.

Le catalogue conserve toutes ses catégories, tarifs et prestations. Les cartes distinguent catégorie, disponibilité, nom, descriptif et prix. Les prestations bloquées montrent explicitement leur indisponibilité et un motif provenant de la fonction métier existante. Les équipements à l’étude restent visibles et non réservables.

Les fiches, la réservation, le contact, les cadeaux, la connexion et les pages légales partagent les mêmes surfaces et contrôles. Le pied de page est clair. L’administration conserve son ergonomie : la comparaison des rectangles des éléments du tableau de bord, du catalogue et du planning est identique à l’état précédent sur les trois formats.

Les typographies locales, le monogramme, les photos de prestations et les informations commerciales sont conservés. Les textes de présentation de l’accueil ont été adaptés au nouveau brief. Les liens sociaux configurés restent accessibles dans le pied de page.

## Captures avant / après

Les captures « avant » sont celles de la version olive validée techniquement au tour précédent, copiées avant les nouvelles modifications. Les captures « après » proviennent d’un environnement local isolé ; les données vides de l’administration ne représentent pas la production.

| Page | Ordinateur 1440 px | Tablette 820 px | Mobile 390 px |
|---|---|---|---|
| Accueil | [Avant](screenshots/spa/avant/desktop/accueil.png) · [Après](screenshots/spa/apres/desktop/accueil.png) | [Avant](screenshots/spa/avant/tablet/accueil.png) · [Après](screenshots/spa/apres/tablet/accueil.png) | [Avant](screenshots/spa/avant/mobile/accueil.png) · [Après](screenshots/spa/apres/mobile/accueil.png) |
| Catalogue | [Avant](screenshots/spa/avant/desktop/catalogue.png) · [Après](screenshots/spa/apres/desktop/catalogue.png) | [Avant](screenshots/spa/avant/tablet/catalogue.png) · [Après](screenshots/spa/apres/tablet/catalogue.png) | [Avant](screenshots/spa/avant/mobile/catalogue.png) · [Après](screenshots/spa/apres/mobile/catalogue.png) |
| Fiche prestation | [Avant](screenshots/spa/avant/desktop/prestation.png) · [Après](screenshots/spa/apres/desktop/prestation.png) | [Avant](screenshots/spa/avant/tablet/prestation.png) · [Après](screenshots/spa/apres/tablet/prestation.png) | [Avant](screenshots/spa/avant/mobile/prestation.png) · [Après](screenshots/spa/apres/mobile/prestation.png) |
| Réservation | [Avant](screenshots/spa/avant/desktop/reservation.png) · [Après](screenshots/spa/apres/desktop/reservation.png) | [Avant](screenshots/spa/avant/tablet/reservation.png) · [Après](screenshots/spa/apres/tablet/reservation.png) | [Avant](screenshots/spa/avant/mobile/reservation.png) · [Après](screenshots/spa/apres/mobile/reservation.png) |
| Contact | [Avant](screenshots/spa/avant/desktop/contact.png) · [Après](screenshots/spa/apres/desktop/contact.png) | [Avant](screenshots/spa/avant/tablet/contact.png) · [Après](screenshots/spa/apres/tablet/contact.png) | [Avant](screenshots/spa/avant/mobile/contact.png) · [Après](screenshots/spa/apres/mobile/contact.png) |
| Cartes cadeaux | [Avant](screenshots/spa/avant/desktop/cadeaux.png) · [Après](screenshots/spa/apres/desktop/cadeaux.png) | [Avant](screenshots/spa/avant/tablet/cadeaux.png) · [Après](screenshots/spa/apres/tablet/cadeaux.png) | [Avant](screenshots/spa/avant/mobile/cadeaux.png) · [Après](screenshots/spa/apres/mobile/cadeaux.png) |
| Administration | [Avant](screenshots/spa/avant/desktop/administration.png) · [Après](screenshots/spa/apres/desktop/administration.png) | [Avant](screenshots/spa/avant/tablet/administration.png) · [Après](screenshots/spa/apres/tablet/administration.png) | [Avant](screenshots/spa/avant/mobile/administration.png) · [Après](screenshots/spa/apres/mobile/administration.png) |

Les dossiers après contiennent également le planning, le catalogue administrateur, une prestation réglementée, un équipement à l’étude et les pages légales. La suite publique produit aussi les captures de connexion dans `docs/screenshots/refonte/`.

## Fichiers de cette seconde refonte

- `src/app/page.tsx` : accueil recomposé et textes de présentation.
- `src/components/hero-mosaic.tsx` : nouveau hero ; contrat et nom technique conservés.
- `src/components/botanical-sprig.tsx` : décoration végétale légère.
- `src/components/beauty-art.tsx` : composition cadeau et vignette des introductions.
- `src/components/site.tsx`, `src/components/mobile-menu.tsx` : variantes du logo adaptées aux fonds clairs.
- `src/components/catalogue.tsx` : affichage explicite des indisponibilités à partir des règles existantes.
- `src/app/contact/page.tsx`, `src/app/cartes-cadeaux/page.tsx` : nouvelles compositions de présentation.
- `src/app/palette.css` : tokens de matières, surfaces et ombres, en complément de la palette centralisée.
- `src/app/spa.css` : compositions, responsive et états visuels du site public.
- `src/app/layout.tsx` : import de la nouvelle feuille de présentation après les styles existants.
- `e2e/visual.spec.ts` : attentes du hero adaptées à la nouvelle composition.
- `e2e-palette/palette.spec.ts`, `playwright.palette.config.ts` : recette sur trois formats et contrôles des restrictions.
- `public/images/spa/rituel-naturel.webp` : nouvelle image d’ambiance, 1536 × 1024, environ 156 Ko.
- `docs/screenshots/spa/` : preuves avant/après, géométrie et rapports Axe.

Les modifications des autres feuilles CSS et le rapport `refonte-palette.md` appartiennent à la première étape, toujours présente dans les changements locaux. Aucun fichier de logique métier, API, authentification, intégration Supabase ou Stripe, configuration d’environnement ou schéma de données n’a été modifié.

## Validation

| Contrôle | Résultat |
|---|---|
| TypeScript | Réussi |
| ESLint | Réussi |
| Vitest | 18 fichiers, 162 tests réussis |
| Playwright public | 27 tests réussis, ordinateur / tablette / mobile, y compris accessibilité, états sans intégrations, navigation et 404 |
| Playwright local | 10 tests réussis : réservation, paiement fictif, formulaires et persistance admin, conflits, annulation, planning et protections |
| Recette spa | 6 tests réussis : 13 pages × 3 formats, 16 fiches et filtres, navigation mobile, liens réservables et blocages |
| Responsive | Aucun débordement horizontal sur les pages contrôlées ; CTA principal visible dans le premier écran |
| Administration | Géométrie des trois pages contrôlées identique à l’état précédent |
| Accessibilité | Aucune violation détectée par Axe pour les règles WCAG 2 A / AA et 2.1 AA sur les 39 rendus locaux contrôlés |
| Build | Réussi, y compris dans le serveur QA de production utilisé par les 27 tests publics |

Les contrôles automatisés sont complétés par une inspection des captures de l’accueil, des cadeaux et du parcours de réservation. Ils ne constituent pas un audit d’accessibilité exhaustif. Les textures de fond peuvent empêcher Axe de calculer certains contrastes ; les textes du pied de page ont notamment été vérifiés et corrigés visuellement.

Le build conserve l’avertissement Turbopack sur le motif de fichiers `.local` dans le code de stockage local existant. Ce code n’a pas été modifié.

Les tests fonctionnels écrivent seulement dans leurs bases temporaires `.local/e2e/`, avec paiements simulés et notifications externes désactivées. Aucune écriture dans une base de travail ou de production, aucun push GitHub, aucun déploiement Vercel.

Commandes : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, `npx playwright test --config playwright.local.config.ts`, `npx playwright test --config playwright.palette.config.ts`. Les builds de recette utilisent un répertoire Next isolé.

## Provenance du nouveau visuel

Création avec l’outil Imagegen intégré. Image d’illustration, sans représentation du local réel ni d’une réalisation de l’institut. Original conservé dans le dossier des images générées ; copie optimisée intégrée au projet à `public/images/spa/rituel-naturel.webp`.

Prompt utilisé :

> Use case: photorealistic-natural. Asset type: main editorial photograph for MONÉA, a French natural beauty institute website. Create one premium, realistic still-life photograph, landscape 3:2. Mood of a warmly lit natural spa gift card: light honey oak tabletop in foreground, a small gently burning candle in a translucent amber vessel, soft ivory linen towel loosely folded, a ceramic shallow bowl, fresh graceful eucalyptus stems with muted olive leaves entering from the upper right, cream textured limewash wall. Light oak panel on the right, filtered afternoon sunlight casting botanical shadows. Spacious sophisticated composition, asymmetrical, foreground tactile materials, shallow depth of field, analogue editorial photography, authentic delicate details. Palette predominantly luminous cream, sand beige and light honey wood, with small olive leaf accents and warm copper candlelight. Main objects in center-right, clean wall and soft shadow upper left. No people, no lettering, no logo, no watermark, no skincare product labels, no excessive objects, no pink, no dark green background, no artificial glossy 3D. This is an illustration of a mood, not a photograph of a real salon.
