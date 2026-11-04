# Photographies et typographies de la refonte MONÉA

**Mise à jour :** les neuf photos du pack fourni sont désormais les visuels actifs, dans `public/images/beauty/`. Voir [le rapport d’intégration](../docs/PROVIDED_PACK_INTEGRATION.md). Les sept visuels décrits ci-dessous sont conservés comme archives de la première refonte, sans être les images par défaut actuelles.

Les **sept photographies sont des illustrations générées indépendamment du flyer**, avec l’outil intégré `image_gen.imagegen` (mode built-in). Elles ne montrent ni Monica, ni une cliente réelle, ni un résultat de soin réalisé par elle, ni un établissement attesté. Le flyer reste uniquement la référence de direction artistique dans `design/reference-flyer.png` ; sa copie publique a été retirée.

## Fichiers livrés

| Univers | Original local | Fichier web local | Poids web approximatif |
|---|---|---|---|
| Portrait glamour | `design/generated/portrait.png` | `public/assets/beauty/portrait.webp` | 87 Ko |
| Regard / cils | `design/generated/regard.png` | `public/assets/beauty/regard.webp` | 95 Ko |
| Ongles nude | `design/generated/ongles.png` | `public/assets/beauty/ongles.webp` | 120 Ko |
| Soin visage | `design/generated/visage.png` | `public/assets/beauty/visage.webp` | 91 Ko |
| Peau / lumière | `design/generated/peau.png` | `public/assets/beauty/peau.webp` | 120 Ko |
| Maquillage | `design/generated/maquillage.png` | `public/assets/beauty/maquillage.webp` | 107 Ko |
| Intérieur imaginé | `design/generated/ambiance.png` | `public/assets/beauty/ambiance.webp` | 220 Ko |

Optimisation reproductible : `node scripts/prepare-beauty-assets.mjs`. Redimensionnement et conversion WebP uniquement, sans montage de texte ni retouche artistique. Les composants utilisent Next.js Image, des ratios réservés, `sizes`, le chargement différé et le préchargement du seul portrait principal. Les images et les correspondances de familles sont centralisées dans `src/config/editorial.ts`. Les chemins de photographies réelles configurés par l’administratrice restent prioritaires.

## Prompts finaux

Préfixe commun aux six photographies portrait, regard, ongles, visage, maquillage et ambiance :

> Use case: photorealistic-natural. Create a standalone premium French beauty editorial photograph for a glamour beauty studio website. Cinematic warm late-afternoon light, warm near-black shadows, peach and dusty blush accents, warm nude skin tones, natural detailed skin texture, elegant sensual beauty editorial without sexualization, luxurious yet believable camera photography, subtle film grain, creamy shallow depth of field. No text, no letters, no logo, no watermark, no border, no collage, no flyer, no UI. Fictional adult models only, no recognizable real person. Harmonized campaign art direction.

Compléments exacts, un appel intégré par photographie :

1. **Portrait** — Vertical portrait 4:5 composition, an adult brunette woman with loose softly pinned up hair, face tilted gently towards warm sunlight, eyes half closed, full face and head visible, luminous healthy skin and subtle glossy nude lips, bare shoulders cropped above upper chest, deep warm black studio backdrop with soft out-of-focus botanical shadows. Beauty magazine cover photography, 85mm portrait lens. Give enough space around face for organic crop.
2. **Regard** — Close-up macro editorial beauty photograph of one adult woman's beautiful hazel eye, delicately curled long dark eyelashes and immaculately groomed natural brow, natural skin pores, warm soft light. Horizontal 4:3 composition, full eye comfortably inside image, premium eyelash campaign. No tools, no artificial graphic lashes, no medical imagery.
3. **Ongles** — Close-up photograph of two elegant adult woman's hands overlapping softly on ivory silk and rose-beige fabric, perfect nude pink almond-shaped glossy nails, anatomically correct natural fingers, delicate warm gold thin ring. Editorial manicure campaign, portrait 4:5, warm luminous side lighting and soft shadows, clear focus on nails.
4. **Visage** — Editorial photograph of a relaxed adult woman reclining with closed eyes, a gentle white cosmetic mask on her cheeks being applied by a beautician's single hand using a small clean brush, ivory towel headband, warm peach spa setting, professional aesthetic facial treatment, no medical procedure. Portrait 4:5, intimate cinematic crop with full face visible and natural anatomy.
5. **Maquillage** — Beauty macro photograph of adult woman's face from nose to eyes and lips, softly closed eyes with warm rose-brown eyeshadow, beautiful subtle eyeliner, clean fluffy makeup brush held near cheek, glossy peach nude lips and natural luminous skin. Portrait 4:5, cinematic professional makeup editorial, creamy blush backdrop.
6. **Ambiance** — Wide landscape 3:2 photograph of an imagined premium intimate beauty studio interior, warm champagne lighting, curved dusty pink wall, softly glowing mirror, textured ivory boucle armchair, travertine side table with a small ceramic vase and sculptural dried branches, fluted warm wood vanity, discreet greenery with soft natural shadows, sunlight. Interior design editorial photography, no people, no brand signage, no text, no logo, no screens, no false business identity.

Prompt final autonome pour **Peau / lumière** :

> Use case: photorealistic-natural. Create a standalone editorial body-care photograph for a premium French beauty website. Close-up of an adult woman's hands gently applying a small drop of golden skincare oil onto her own forearm, only hands and forearms in the composition, otherwise wearing an ivory linen sleeve, sun-kissed luminous skin, natural skin texture, simple anatomically correct hands. Background soft champagne and blush linen, beautiful warm afternoon sunlight and delicate botanical shadows. Elegant spa product editorial, photorealistic camera photo, portrait 4:5. No face, no nudity, no text, no logo, no watermark, no graphics, no border, no collage. Harmonize with warm black / blush / peach beauty campaign photography.

## Polices locales

**Cormorant Garamond**, **Allura**, **Manrope** : versions latines WOFF2 dans `src/app/fonts/`, environ 87 Ko au total, chargées avec `next/font/local`. Aucun appel Google Fonts depuis le navigateur. Licences SIL Open Font License conservées dans `docs/licenses/*-OFL.txt` ; feuille de provenance des URL officielles dans `docs/licenses/fonts-source.css`.

Sources : [Google Fonts — Cormorant Garamond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond), [Allura](https://github.com/google/fonts/tree/main/ofl/allura), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope). Les compositions Polaroid, badges, carte cadeau et smartphone sont réalisées en HTML/CSS ; aucune capture de compte social réel n’est utilisée.
