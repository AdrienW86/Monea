# Refonte visuelle MONÉA

Ce rapport décrit la première refonte. La dernière évolution — hero mosaïque et neuf images du pack utilisateur — est détaillée dans [le rapport d’intégration du pack](PROVIDED_PACK_INTEGRATION.md). Les captures du dossier `refonte/` correspondent désormais à cette version plus récente.

## Direction artistique réalisée

La page d’accueil a été reconstruite autour de photographies autonomes et d’une composition éditoriale : portrait glamour en grand format, typographies Cormorant Garamond / Allura / Manrope, lumière chaude, noir chaud, corail, poudré et crème. Trois Polaroids chevauchés, badges circulaires roses, petits cœurs et étoiles, sept cartes de soins photographiques, intérieur d’ambiance en découpe arrondie et collage asymétrique, invitation à réserver, détail du regard, mise en scène carte cadeau et moodboard dans un smartphone.

Le catalogue, les fiches, le contact, les cartes cadeaux, les introductions de pages, le header, la navigation mobile et le footer partagent la nouvelle identité. Les prestations, statuts réglementaires et fonctions de réservation restent en place. Aucun avis, numéro, adresse, compte social, publication ou résultat client n’a été inventé.

Les photographies sont explicitement illustratives. L’intérieur est identifié comme imaginé. Aucun extrait du flyer n’est utilisé comme photo ; le fichier public du flyer a été retiré. Voir [la provenance, les fichiers et les prompts](../design/ASSETS.md).

## Adaptations mobiles et animations

À 390 px : hero recomposé verticalement avec portrait intégré au fond, CTA visible, photos secondaires en éventail ; cartes tactiles en deux colonnes, puis carte d’ambiance large ; collages et sections empilés, menu natif refermable et réservation dans le header collant. Les accroches, badges et espacements ont été ajustés après inspection des captures.

Les apparitions reposent sur IntersectionObserver et des transitions CSS légères, sans nouvelle bibliothèque d’animation. Les effets s’arrêtent avec `prefers-reduced-motion`. Le contenu reste visible sans JavaScript. Les images sont locales, réservées en taille, optimisées WebP et servies par Next.js Image ; les trois fontes WOFF2 locales totalisent environ 87 Ko.

## Contrôle visuel

Playwright ouvre et photographie les sept pages suivantes dans chaque format : accueil, catalogue, fiche regard, réservation, contact, cartes cadeaux et connexion admin. Profils : **desktop 1440 × 1000**, **tablette 820 × 1180**, **smartphone 390 × 844**. Les captures finales du profil mobile utilisent une densité de 1 pour représenter les 390 pixels demandés sans fichiers inutilement lourds.

Répertoires : `docs/screenshots/refonte/desktop/`, `tablet/`, `mobile/`. Chaque profil contient aussi le premier écran de l’accueil et les détails hero, soins et cadeaux. Les images différées sont chargées et les sections révélées avant capture ; les fontes sont attendues. La recette contrôle images cassées, erreurs JavaScript, absence de débordement horizontal, sept cartes et trois Polaroids, ainsi que l’absence d’image issue du flyer.

Comparaison au flyer : mêmes familles de couleurs chaudes, accroches manuscrites corail, portraits lumineux, cartes photographiques blanches inclinées, cercles poudrés, jeux de superposition et inspiration sociale. Les écarts observés ont été corrigés : captures initiales incomplètes à cause du défilement doux, accroche cadeau trop proche de la carte sur tablette, point d’interrogation isolé sur mobile, badges trop petits et densité des captures mobiles.

## Vérifications

Résultats finaux : **54 tests Vitest réussis**, **27 tests Playwright réussis** sur les trois formats, **TypeScript strict et ESLint sans erreur**, **build Next.js de production réussi**. Les contrôles Axe WCAG A/AA et 2.1 AA passent sur les six pages contrôlées, dans les trois profils. Aucun problème d’image cassée, de débordement horizontal ou d’erreur JavaScript n’a été détecté par la recette visuelle. **33 captures** sont conservées : 21 pages complètes et 12 premiers écrans/détails.

L’aperçu QA est isolé sur **127.0.0.1:3211**, avec sortie `.next-qa` et intégrations désactivées dans l’environnement de test. Il ne réutilise pas le serveur du propriétaire sur 3210. La réponse HTTP de ce dernier a également été vérifiée : **200**. Les détails de sections sont capturés sans le header collant afin de ne pas masquer leurs titres dans les fichiers d’inspection ; le comportement collant reste actif dans l’application.

Les migrations SQL, l’authentification, les routes de paiement/contact/webhook, les protections de disponibilité, les notifications et les secrets n’ont pas été modifiés par la refonte. Aucun appel de paiement ni notification réelle, aucune modification de données de production, aucun commit, push ou déploiement.
