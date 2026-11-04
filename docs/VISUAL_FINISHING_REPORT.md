# Finition visuelle MONÉA

## Périmètre

Passe de finition sur l’identité validée, sans nouvelle direction artistique. Palette, typographies, sept cartes photographiques Polaroid, inclinaisons, bordures et animations du catalogue conservées. Les styles de ces cartes dans `src/app/beauty.css` n’ont pas été modifiés.

## Ajustements

- Hero ramené à **un portrait dominant et quatre vignettes**, avec une grille plus aérée, des séparations sombres discrètes et des cadrages adaptés à chaque format. Les huit petites vignettes de la version précédente sont remplacées par quatre familles représentatives : regard, ongles, visage et corps.
- Variantes photographiques déjà disponibles réservées au hero (`heroEditorial` dans `src/config/editorial.ts`). Les images du catalogue restent celles du pack fourni : aucune source de vignette du hero n’est répétée dans les cartes Polaroid voisines. Aucun nouveau visuel généré ni téléchargement nécessaire.
- Bouton principal corail plus contrasté, plus grand, avec flèche, bordure poudrée et ombre discrète. Zone tactile d’au moins 52 px de haut et visibilité dans le premier écran contrôlées par Playwright.
- Mentions « Identité de démonstration » retirées du footer ; « tarif de démonstration » supprimé des cartes et remplacé, sur le catalogue et les fiches, par une information conditionnelle sur les tarifs indicatifs lorsque leur validation manque. Le parcours de réservation n’a pas été modifié.
- Mentions photographiques essentielles conservées : illustration dans le hero et le catalogue, intérieur imaginé dans les sections concernées, moodboard sans compte ni publication réelle. Aucune photo n’est présentée comme le véritable établissement ou une réalisation cliente.
- Distinction des soins réglementés conservée : badges « Bientôt disponible » et contrôles existants inchangés ; aucune prestation activée par cette passe de finition.

## Vérification du périmètre protégé

Une comparaison SHA-256 avant/après porte sur **29 fichiers** : bibliothèques et routes métier, migrations, seed/config Supabase, back-office, formulaires d’administration/réservation, pages du parcours de réservation et feuille de style des cartes Polaroid. **Aucun de ces fichiers n’a changé.** Aucun accès aux données réelles de production, paiement, notification, commit, push ou déploiement.

## Inspection visuelle

Playwright photographie les pages principales en desktop **1440 px**, tablette **820 px** et smartphone **390 px**. Les captures du premier écran, du hero, des soins et des cartes cadeaux ont été inspectées. Les vérifications couvrent : quatre vignettes, portrait chargé, absence de sources répétées entre hero et cartes, CTA visible et suffisamment haut, images chargées, absence de débordement, erreurs JavaScript, navigation mobile, réduction des mouvements et accessibilité Axe.

Captures courantes : `docs/screenshots/refonte/desktop/`, `tablet/`, `mobile/`. Le serveur de recette reste isolé sur le port 3211, sans intégrations externes activées.

Résultats de la recette finale : **54 tests Vitest réussis**, **27 tests Playwright réussis**, contrôles d’accessibilité Axe réussis, **TypeScript et ESLint sans erreur**, **build Next.js standard réussi**. Les cadrages et superpositions ont été inspectés sur ordinateur, tablette et mobile ; le CTA principal reste dans le premier écran sur les trois profils.
