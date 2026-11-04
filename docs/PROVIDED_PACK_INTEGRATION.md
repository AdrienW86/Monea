# Intégration du pack et hero mosaïque

La [dernière passe de finition](VISUAL_FINISHING_REPORT.md) conserve l’identité et les cartes du catalogue, avec un hero désormais limité à quatre vignettes et des variantes photographiques distinctes. La composition à huit vignettes décrite ci-dessous correspond à l’étape précédente.

Le pack `MONEA_PACK_9_VISUELS_SITE.zip` fourni par l’utilisateur a été inspecté puis intégré localement. Le README et le manifeste de l’archive sont conservés comme documentation de provenance dans `design/provided-pack/` ; ils ne sont pas exécutés comme scripts ou instructions d’administration.

## Images actives

Les neuf fichiers WebP originaux sont conservés sans retouche dans `public/images/beauty/`, pour **311 218 octets au total**. Aucun visuel supplémentaire n’a été généré pour cette intégration.

- `hero-portrait.webp` : portrait principal (702 × 628).
- `cils-regard.webp` : regard (438 × 289).
- `ongles-nude.webp` : ongles (379 × 290).
- `soin-visage.webp` : visage (435 × 327).
- `bronzage.webp` : peau et bronzage (379 × 327).
- `epilation-cire.webp` : épilation (304 × 387).
- `maquillage.webp` : maquillage (326 × 387).
- `ambiance-institut.webp` : intérieur imaginé (534 × 386).
- `carte-cadeau.webp` : cadeau (296 × 386).

Les originaux générés précédemment dans `design/generated/` et `public/assets/beauty/` restent archivés. Les images actives sont centralisées dans `src/config/editorial.ts`. Un visuel réel configuré par l’administratrice garde sa priorité ; les restrictions de chemins administrables restent inchangées.

## Composition

Le hero devient une mosaïque HTML/CSS : grand portrait sur la moitié gauche avec titre, accroche et CTA en éléments réels ; quatre vignettes à droite ; quatre vignettes en bandeau inférieur. Les liens ouvrent les fiches de prestation, les cartes cadeaux ou la section d’univers. Le catalogue conserve ses seize prestations et ses sept familles photographiques.

Sur smartphone, le portrait et les CTA passent en premier, puis les vignettes en deux colonnes. Le cadrage du portrait est adapté pour ne pas placer le visage sous le texte. Les photos sont servies par Next.js Image avec `sizes`, et seul le portrait est préchargé.

L’intérieur est étiqueté comme ambiance imaginée. Les prestations réglementées restent visibles mais indisponibles tant que les conditions serveur ne sont pas vérifiées ; les cartes cadeaux n’ont aucun bouton d’achat actif. Les visuels ne sont pas présentés comme des clientes réelles, des résultats ou le véritable local.

## Recette

Captures Playwright en 1440 px, tablette 820 px et mobile 390 px dans `docs/screenshots/refonte/`. Contrôle des huit vignettes, de la bonne source du portrait, de l’absence de flyer comme photo, des images cassées, des erreurs JavaScript, du débordement et de l’accessibilité. Les boutons et textes du hero restent utilisables au clavier et ne sont pas incrustés dans une image.

Résultats exécutés après les derniers ajustements de cadrage : **54 tests Vitest réussis**, **27 tests Playwright réussis**, **TypeScript et ESLint sans erreur**, **build Next.js standard réussi**. Les captures ont été inspectées en desktop, tablette et smartphone. L’aperçu de test utilise le port 3211 avec les intégrations externes désactivées ; le serveur de développement reste sur 3210.

Aucun changement aux migrations, à l’authentification, aux routes de paiement, à la gestion des réservations ou aux notifications. Aucun commit, déploiement, paiement ni envoi réel.
