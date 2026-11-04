# MONÉA — Palette de la carte cadeau

Historique de la première étape. La version actuelle est décrite dans [la refonte spa](refonte-spa.md) ; les contraintes de géométrie du site public ont été levées dans le nouveau brief.

La présentation reprend l’olive végétal, le crème, l’ivoire, le beige naturel et le brun de la référence, avec quelques accents cuivrés. Les photos, le monogramme et les textes sont conservés.

## Fichiers modifiés

- `src/app/palette.css` : palette centralisée et alias des anciennes variables. Les alias de présentation prennent le dessus sur les anciennes couleurs enregistrées, sans modifier les réglages en base.
- `src/app/globals.css` : import de la palette, remplacement des couleurs littérales par des variables.
- `src/app/beauty.css` : couleurs du site public, boutons, formulaires, cartes, réservations, ombres et dégradés.
- `src/app/mosaic.css` : couleurs du hero existant et de ses états interactifs.
- `src/app/management.css` : couleurs de l’administration et du planning ; conservation des couleurs sémantiques des erreurs, avertissements et états terminés.
- `playwright.palette.config.ts` et `e2e-palette/palette.spec.ts` : captures, comparaison des positions et dimensions, absence de débordement et contrôle des contrastes.

Aucun composant, espacement, arrondi, breakpoint, style typographique ou comportement d’animation n’a été changé. Aucun fichier d’environnement, API, intégration de paiement ou accès aux données n’a été modifié. Aucun push ni déploiement.

## Captures avant / après

| Format | Accueil | Catalogue | Administration |
|---|---|---|---|
| Ordinateur 1440 px | [Avant](screenshots/palette/avant/desktop/accueil.png) · [Après](screenshots/palette/apres/desktop/accueil.png) | [Avant](screenshots/palette/avant/desktop/catalogue.png) · [Après](screenshots/palette/apres/desktop/catalogue.png) | [Avant](screenshots/palette/avant/desktop/administration.png) · [Après](screenshots/palette/apres/desktop/administration.png) |
| Tablette 820 px | [Avant](screenshots/palette/avant/tablet/accueil.png) · [Après](screenshots/palette/apres/tablet/accueil.png) | [Avant](screenshots/palette/avant/tablet/catalogue.png) · [Après](screenshots/palette/apres/tablet/catalogue.png) | [Avant](screenshots/palette/avant/tablet/administration.png) · [Après](screenshots/palette/apres/tablet/administration.png) |
| Mobile 390 px | [Avant](screenshots/palette/avant/mobile/accueil.png) · [Après](screenshots/palette/apres/mobile/accueil.png) | [Avant](screenshots/palette/avant/mobile/catalogue.png) · [Après](screenshots/palette/apres/mobile/catalogue.png) | [Avant](screenshots/palette/avant/mobile/administration.png) · [Après](screenshots/palette/apres/mobile/administration.png) |

Les dossiers contiennent aussi la fiche extensions de cils, la réservation, les cartes cadeaux, le contact, le catalogue administrateur et le planning. Les JSON associés enregistrent les rectangles des éléments visibles, arrondis au dixième de pixel. Les rapports `*-contrastes.json` contiennent les violations détectées par Axe ; une liste vide indique qu’aucune violation n’a été détectée.

## Vérifications

- TypeScript et ESLint : réussis.
- Vitest : 18 fichiers, 162 tests réussis.
- Parcours locaux : 10 tests Playwright réussis sur ordinateur et mobile, dont réservation avec paiement fictif, administration, conflits, annulation et navigation du planning.
- Comparaison visuelle : 9 pages × 3 formats, positions et dimensions identiques avant / après ; aucun débordement horizontal.
- Contrastes : aucune violation détectée par la règle `color-contrast` d’Axe sur les 27 rendus contrôlés. Ce contrôle automatisé ne remplace pas un audit exhaustif des textes superposés aux photographies ou des états non affichés.
- Audit CSS : sélecteurs, media queries et déclarations hors couleurs / ombres identiques à la version initiale.
- Build de production : réussi dans `.next-qa`. Avertissement Turbopack sur le motif de fichiers `.local` dans `src/lib/data/local.ts`, hors périmètre de cette refonte.

Les captures et parcours utilisent une base SQLite temporaire dans `.local/e2e`, des paiements fictifs et des notifications externes désactivées. Les bases de travail et de production ne sont pas utilisées. Les données vides du tableau de bord sont celles de cet environnement de vérification.

Pour relancer les captures : `npx playwright test --config playwright.palette.config.ts`. Pour établir une nouvelle référence avant une future refonte : définir `MONEA_CAPTURE_BEFORE=1` et lancer la même commande avant toute modification.
