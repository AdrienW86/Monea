# Monogramme MONÉA — intégration locale

## Source

Une seule image a été utilisée, conformément à votre dernière instruction : le monogramme rose doré joint au chat. Le PNG original n’étant pas accessible sur disque, l’outil image intégré a préparé une **version dérivée transparente**, conservée dans `design/monogramme/monea-symbol-derived.png`. Ce fichier n’est pas une copie binaire certifiée du fichier original. Aucune autre variante graphique n’a été inventée.

Le canal alpha a été vérifié. La copie web est `public/branding/monea-symbol.png`. Le même monogramme est utilisé sur fonds clairs et sombres ; aucun fond blanc ou noir n’a été ajouté au PNG.

Prompt de l’outil image intégré (`image_gen`, édition de la seule image jointe) :

> Prepare this exact supplied emblem as a clean transparent PNG web asset. Preserve its existing serif capital M, diagonal meeting low at center, circular open ring, three botanical leaves on the lower right, proportions, rose gold metallic highlights and peach color. Do not redesign, do not add lettering, do not add MONÉA, do not add any background, no shadow outside the emblem, no new details. Remove only stray isolated colored or white specks surrounding the emblem and make all background and the open spaces inside the ring and letter genuinely alpha-transparent. Keep the supplied original composition and artwork as faithfully as possible. Center the whole emblem including the rightmost leaves within a square with a narrow even transparent safe margin. Output one transparent PNG.

## Affichage

Le composant existant `BrandLogo` affiche le monogramme seul ou accompagné du **véritable texte MONÉA**, avec dimensions personnalisables. L’image est décorative lorsqu’elle accompagne le nom, afin de ne pas répéter son annonce aux lecteurs d’écran.

Header : 38 px sur ordinateur, 30 px sur smartphone et 28 px sur les petits écrans. Le lien englobe symbole et nom. L’intégration couvre aussi le menu mobile, le footer, la connexion, la barre latérale et le header du tableau de bord.

L’état initial affichait le nom sous forme de SVG. Le nom est désormais du texte utilisant la famille éditoriale locale déjà présente. Les cartes cadeaux conservent leur illustration antérieure via `BrandWordmark`. Hero, photographies, cartes de prestations et animations sont inchangés.

## Icônes

`src/app/favicon.ico` est un conteneur ICO avec trois images en 16, 32 et 48 px. `src/app/icon.png` mesure 512 px et `src/app/apple-icon.png` 180 px. Les icônes du manifest sont `public/icon-192.png` et `public/icon-512.png`. `public/apple-touch-icon.png` conserve une copie de compatibilité.

L’ancien fichier spécial `src/app/icon.svg` a été retiré. `metadata.icons` a été supprimé pour laisser Next.js produire les balises cohérentes à partir des conventions de fichiers. L’ancien `public/favicon.svg` reste un asset historique non référencé par ces balises.

Le script `node scripts/prepare-monogram-assets.mjs` reproduit les tailles et le conteneur ICO à partir de la source dérivée. Les aperçus PNG 16/32/48 sont conservés dans `public/branding/`.

## Captures avant / après

| Vue | Avant | Après |
| --- | --- | --- |
| Header ordinateur | [Avant](screenshots/monogramme/avant/local-desktop/header.png) | [Après](screenshots/monogramme/apres/local-desktop/header.png) |
| Header smartphone | [Avant](screenshots/monogramme/avant/local-mobile/header.png) | [Après](screenshots/monogramme/apres/local-mobile/header.png) |
| Menu mobile | [Avant](screenshots/monogramme/avant/local-mobile/menu-mobile.png) | [Après](screenshots/monogramme/apres/local-mobile/menu-mobile.png) |
| Footer | [Avant](screenshots/monogramme/avant/local-desktop/footer.png) | [Après](screenshots/monogramme/apres/local-desktop/footer.png) |
| Connexion | [Avant](screenshots/monogramme/avant/local-desktop/connexion.png) | [Après](screenshots/monogramme/apres/local-desktop/connexion.png) |
| Tableau de bord | [Avant](screenshots/monogramme/avant/local-desktop/tableau-de-bord.png) | [Après](screenshots/monogramme/apres/local-desktop/tableau-de-bord.png) |

[Favicons à 16, 32 et 48 px sur fonds clair et sombre](screenshots/monogramme/apres/local-desktop/favicons-16-32-48.png).

## Fichiers modifiés ou ajoutés

- Composants : `src/components/brand-logo.tsx`, `src/components/beauty-art.tsx` (illustration préservée), `src/components/management/app.tsx`.
- Configuration et styles : `src/config/brand.ts`, `src/app/brand.css`, `src/app/layout.tsx` (uniquement les déclarations d’icônes).
- Assets : `design/monogramme/monea-symbol-derived.png`, `public/branding/monea-symbol.png`, les trois aperçus `public/branding/favicon-{16,32,48}.png`, les icônes listées ci-dessus ; suppression de `src/app/icon.svg`.
- Préparation : `scripts/prepare-monogram-assets.mjs`.
- Tests : `tests/brand.test.ts`, `e2e-brand/brand.spec.ts`, `e2e-monogram/monogram.spec.ts`, `playwright.monogram.config.ts`.
- Documentation : le présent rapport et les captures dans `docs/screenshots/monogramme/`. Next.js peut actualiser ses références de types générés dans `next-env.d.ts`/`tsconfig.json` au démarrage.

## Vérification

TypeScript et ESLint réussis. 86 tests unitaires et d’intégration réussis, dont transparence alpha, rendu textuel accessible et structure du fichier ICO. Le lanceur Playwright public effectue un build de production isolé : build et 27 tests publics réussis, dont accessibilité axe et affichage ordinateur/tablette/mobile. Deux tests spécifiques au monogramme réussis sur le port **3210**, couvrant les captures, les icônes réellement déclarées dans le navigateur et l’alignement dans l’administration. Les quatre tests de régression de marque réussissent aussi, soit **33 tests Playwright** au total pour cette intégration.

Les tests utilisent des bases séparées, sans modifier la base SQLite de travail. Aucun changement de secrets, de schéma, de migrations, de textes SEO ou d’intégrations Supabase/Stripe/WhatsApp. Aucun envoi, paiement réel, commit, push ou déploiement.
