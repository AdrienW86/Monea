# MONÉA — Corrections des supports et de l’ambiance

## Supports utilisés

La carte cadeau reconstruite en HTML/CSS a été retirée de l’accueil et de la page cartes cadeaux. Elle est remplacée par l’image jointe explicitement sélectionnée par le propriétaire le 4 novembre 2026 (« celle ci »), avec bois clair et bandeau olive. La carte de visite apparaît sur la page contact, avec son recto et son verso issus du PDF fourni.

| Présentation remplacée ou ajoutée | Source retrouvée | Asset affiché |
|---|---|---|
| Carte cadeau générique, puis version au ruban vert non retenue | Image jointe validée : bois clair, eucalyptus, bougie et bandeau olive | `public/branding/supports/carte-cadeau-bois-validee.jpg` |
| Recto de la carte de visite, désormais montré sur Contact | Page 1 de `MONEA_recto_verso_version_exacte_65x90_fond_perdu.pdf` | `public/branding/supports/carte-visite-recto.png` |
| Verso de la carte de visite, désormais montré sur Contact | Page 2 du même PDF | `public/branding/supports/carte-visite-verso.png` |

Le fichier cadeau est une copie strictement identique du JPEG joint, vérifiée par SHA-256. Le PDF original est conservé dans `design/validated-supports/carte-visite-source.pdf`. Les exports PNG retirent uniquement les 3 mm de fond perdu d’impression. Les textes, QR codes, couleurs, éléments graphiques et proportions ne sont pas recomposés. Les images sont affichées intégralement, sans filtre, rotation, perspective ni recompression Next.js. Chaque support peut être ouvert en grand par un clic.

**Version cadeau confirmée :** l’image jointe au fond bois clair, eucalyptus, bougie, fleur blanche et bandeau olive est celle retenue. La version au ruban vert est archivée et n’est plus servie par le site. La provenance et les empreintes sont détaillées dans [le dossier des sources](../design/validated-supports/README.md).

Après cette confirmation : 3 tests ciblés des supports réussis et 3 contrôles Playwright réussis sur l’accueil et la page cadeaux, en ordinateur, tablette et mobile. Les captures de ces deux pages et de leurs sections cadeaux ont été actualisées avec la pièce jointe exacte.

Le coffret rose `public/images/beauty/carte-cadeau.webp` n’est pas utilisé. Aucun visuel de carte n’a été généré ou redessiné.

## Ajustements visuels

- Hero : scène bois / bougie / eucalyptus agrandie ; cadre moins fermé, table et lumière de bougie davantage visibles, petit portrait beauté réduit.
- Matières : bois photographique perceptible dans le bandeau sous le hero, la section cadeaux et la présentation des cartes de visite. Le reste des grandes surfaces reste clair et lisible.
- Feuillage : accents végétaux renforcés autour du hero et des compositions, sans fond vert dominant.
- Catalogue : introduction sur une surface lin, vignette spa agrandie et séparateur photographique bois ; tarifs, catégories, filtres et restrictions conservés.
- Supports imprimés : le décor et les ombres entourent les fichiers d’origine. Sur mobile, le recto et le verso sont présentés l’un sous l’autre pour faciliter leur lecture.

Le visuel d’ambiance `public/images/spa/rituel-naturel.webp`, créé lors de l’étape précédente, est réutilisé pour ces matières. Aucun nouvel asset d’ambiance n’a été généré. Les proportions demandées sont utilisées comme direction de composition ; elles ne constituent pas une mesure pixel par pixel.

## Captures de la version corrigée

| Vue | Ordinateur | Tablette | Mobile |
|---|---|---|---|
| Home complète | [Voir](screenshots/supports/apres/desktop/accueil.png) | [Voir](screenshots/supports/apres/tablet/accueil.png) | [Voir](screenshots/supports/apres/mobile/accueil.png) |
| Hero | [Voir](screenshots/supports/apres/desktop/hero.png) | [Voir](screenshots/supports/apres/tablet/hero.png) | [Voir](screenshots/supports/apres/mobile/hero.png) |
| Section cadeaux de la home | [Voir](screenshots/supports/apres/desktop/accueil-section-cadeaux.png) | [Voir](screenshots/supports/apres/tablet/accueil-section-cadeaux.png) | [Voir](screenshots/supports/apres/mobile/accueil-section-cadeaux.png) |
| Page cartes cadeaux | [Voir](screenshots/supports/apres/desktop/cadeaux.png) | [Voir](screenshots/supports/apres/tablet/cadeaux.png) | [Voir](screenshots/supports/apres/mobile/cadeaux.png) |
| Détail de la page cadeaux | [Voir](screenshots/supports/apres/desktop/cadeaux-section-cadeaux.png) | [Voir](screenshots/supports/apres/tablet/cadeaux-section-cadeaux.png) | [Voir](screenshots/supports/apres/mobile/cadeaux-section-cadeaux.png) |
| Cartes de visite recto / verso | [Voir](screenshots/supports/apres/desktop/supports-imprimes.png) | [Voir](screenshots/supports/apres/tablet/supports-imprimes.png) | [Voir](screenshots/supports/apres/mobile/supports-imprimes.png) |

Les captures précédentes restent dans `docs/screenshots/spa/apres/`. Les dossiers de cette correction contiennent également les autres pages contrôlées, les relevés de géométrie et les rapports Axe.

## Fichiers de cette correction

- `src/components/beauty-art.tsx` : remplacement de la reconstruction cadeau par l’image d’origine.
- `src/components/printed-supports.tsx` : présentation fidèle du recto-verso.
- `src/config/printed-supports.ts` : chemins, dimensions et alternatives textuelles des trois supports.
- `src/app/contact/page.tsx` : intégration des cartes de visite.
- `src/components/hero-mosaic.tsx` : classe de présentation du portrait secondaire.
- `src/app/spa.css`, `src/app/palette.css` : cadrages du hero, matières photographiques, cadre des supports, catalogue et responsive.
- `tests/printed-supports.test.ts` : empreintes des sources, dimensions et absence de reconstruction.
- `e2e-palette/palette.spec.ts` : contrôle des fichiers affichés, du ratio, des filtres et captures spécifiques.
- `public/branding/supports/`, `design/validated-supports/` : supports exacts, PDF source et provenance.

Les autres changements déjà présents dans le dossier appartiennent aux refontes précédentes. La logique métier, les APIs, Supabase, Stripe, l’authentification et les données de travail n’ont pas été modifiés.

## Vérification

- TypeScript et ESLint : réussis.
- Vitest : 19 fichiers et 165 tests réussis, dont les trois contrôles des supports d’origine.
- Recette visuelle et catalogue : 6 tests réussis sur ordinateur, tablette et mobile ; fichiers exacts, proportions respectées, filtres et blocages de réservation préservés.
- Parcours locaux : 10 tests réussis, dont réservation avec paiement fictif, annulation, conflits et administration.
- Axe : aucune violation détectée sur les 13 pages contrôlées × 3 formats. Les fonds photographiques peuvent limiter le calcul automatisé des contrastes ; les captures sont aussi inspectées visuellement.
- Administration : dimensions et positions des éléments comparés identiques à la référence précédente.
- Build isolé : réussi. L’avertissement Turbopack existant sur le motif `.local` du stockage local est conservé.

Les captures de sections masquent uniquement le header collant pendant la prise de vue, pour éviter qu’il ne recouvre les supports. Les pages complètes montrent le header normal.

Les tests utilisent leurs bases temporaires avec paiements fictifs et notifications externes désactivées. Aucun push GitHub ni déploiement Vercel.
