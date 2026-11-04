# Identité définitive MONÉA

La marque affichée est **MONÉA**, avec son accent. « Institut de beauté » reste une description. La mise en page, les photographies et les typographies éditoriales existantes sont conservées.

## Assets

La planche fournie est conservée dans `design/reference-logo-monea.png` comme référence uniquement. Les fichiers de production sont dans `public/assets/brand/` : logos clair/sombre, monogrammes clair/sombre et image sociale PNG de 1200 × 630 px. Les logos et monogrammes sont des tracés SVG originaux, sans police dépendante ni bitmap embarqué. Ils interprètent la référence ; ce ne sont pas des recadrages.

Les icônes sont disponibles à la racine de `public/` : `favicon.svg`, `apple-touch-icon.png` (180 px), `icon-192.png`, `icon-512.png`. `src/app/icon.svg` utilise le même monogramme. Pour les recréer : `node scripts/prepare-brand-assets.mjs`. Les fontes du site restent les fontes locales avec licences OFL déjà documentées dans `docs/licenses/`.

## Configuration et données

`src/config/brand.ts` centralise le nom, les assets, la description, la palette et les coordonnées par défaut. `BrandLogo` conserve les proportions et fournit les variantes sur fond clair et sombre. Les accents nude, poudré, bronze et cuivre sont injectés comme variables CSS ; la palette existante enregistrée reste conservée.

Les anciens réglages commerciaux sont harmonisés à la lecture avec `resolveBrand`. Aucune migration, réinitialisation ou modification directe de la base de travail n’est nécessaire. Les coordonnées enregistrées, l’identité juridique, les prix et les règles métier sont conservés. Le nom et le sous-titre de marque sont fixes dans l’administration locale.

Dans **Administration → Paramètres**, l’administratrice peut enregistrer l’adresse, le téléphone, l’e-mail, WhatsApp, le domaine officiel et les liens Instagram, TikTok et Snapchat. Ces champs sont facultatifs, validés côté serveur et laissés vides par défaut. Le domaine saisi doit être préalablement validé par l’établissement. Aucun domaine, compte social ou contact réel n’a été inventé.

## SEO et communications

Le titre d’accueil est `MONÉA | Institut de beauté à Perpignan`. Les pages publiques principales et les fiches prestations ont leurs métadonnées ; les données structurées BeautySalon ne contiennent ni géolocalisation inventée ni promesse de réservation de toutes les prestations. Le manifest et les icônes sont configurés.

Tant que le domaine officiel est vide, les URLs canoniques et les URLs absolues Open Graph/Twitter sont omises. L’image de partage est déjà disponible dans les assets. Le sitemap reste vide et l’indexation est bloquée en mode démonstration. Un domaine valide et la sortie explicite du mode démonstration sont nécessaires avant indexation ; l’espace privé et les routes de confirmation restent exclus.

Les nouveaux titres de notifications locales et les textes/sujets des e-mails existants utilisent MONÉA. Le transport WhatsApp conserve son contrat de template existant : son contenu hébergé chez le fournisseur devra être validé sous la marque MONÉA avant activation réelle. Aucun template distant ni paramètre d’envoi n’a été changé. Aucun message externe ou paiement réel n’a été déclenché.

## Vérification

- TypeScript et ESLint : succès.
- Vitest : 85 tests unitaires et d’intégration réussis, dont cinq tests de marque (assets, proportions déclarées, configuration, SEO sans coordonnées fictives, sauvegarde des contacts sur SQLite en mémoire).
- Playwright public : 27 tests réussis sur ordinateur, tablette et mobile, dont accessibilité axe et captures des pages principales ; le lanceur réalise un build de production isolé puis sert cette version.
- Playwright gestion : 10 tests réussis sur ordinateur et mobile (authentification, calendrier, conflits, catalogue, réservation complète, paiement fictif et notifications locales).
- Playwright marque sur **127.0.0.1:3210** : quatre tests réussis, dont chargement et proportions des logos, menu mobile, absence de débordement, assets, métadonnées et sauvegarde/restauration publique d’un contact depuis l’administration.
- Captures dédiées dans `docs/screenshots/marque/` ; captures publiques actualisées dans `docs/screenshots/refonte/`.

Les suites de gestion et de marque utilisent des bases SQLite de test distinctes et des dossiers de traces séparés. Les serveurs temporaires sont arrêtés à la fin des suites. Les avertissements Node sur SQLite expérimental et Next.js sur certaines photos LCP préexistantes n’empêchent pas les contrôles.

Commandes : `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run test:e2e:local`, `npx playwright test --config playwright.brand.config.ts`.

Aucun commit, push ou déploiement n’a été effectué. Les secrets et les migrations existantes sont inchangés.
