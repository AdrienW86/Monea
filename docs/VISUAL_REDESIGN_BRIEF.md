# MISSION — REFONTE VISUELLE COMPLÈTE DU SITE MONÉA

Le rendu actuel ne répond pas du tout à mes attentes visuelles.

Le flyer disponible dans `design/reference-flyer.png` constitue la référence artistique principale du projet.

Je ne veux pas un site qui reprend simplement quelques couleurs du flyer. Je veux retrouver **la même richesse visuelle, les mêmes codes graphiques, la même atmosphère glamour et le même niveau d'impact photographique**.

## 1. Diagnostic

Le site actuel présente plusieurs défauts :

- Design beaucoup trop minimaliste.
- Hero peu immersif.
- Sections trop vides.
- Manque de photographies de beauté.
- Absence de véritable composition graphique.
- Contraste trop important entre les grands aplats de couleurs.
- Aucun effet de collage éditorial comparable au flyer.
- La photographie principale provient d'un découpage du flyer lui-même, ce qui est inacceptable.
- Le site ne possède pas encore l'identité d'une véritable marque de beauté destinée aux réseaux sociaux.

Il faut donc reconstruire le frontend, pas simplement modifier les couleurs.

## 2. Direction artistique obligatoire

Reprendre précisément l'univers du flyer :

**Palette**
- Noir profond légèrement chaud.
- Rose poudré.
- Rose corail.
- Nude et beige rosé.
- Blanc crème.
- Quelques touches lumineuses et brillantes.

Éviter les grandes sections vertes, grises ou beiges uniformes qui donnent un aspect de template.

**Typographie**
- Titres éditoriaux élégants et expressifs.
- Association de caractères serif premium, typographies manuscrites pour les accroches et sans-serif modernes pour les contenus.
- Hiérarchie visuelle forte.
- Titres XXL et compositions typographiques assumées.

**Éléments graphiques**
- Photographies en grand format.
- Superpositions de photos.
- Cartes légèrement inclinées façon Polaroid.
- Cercles et badges roses.
- Découpes organiques.
- Ombres douces.
- Effets de profondeur.
- Petits cœurs dessinés, étoiles et détails éditoriaux.
- Composants inspirés des réseaux sociaux.
- Animations fluides et discrètes.

Le résultat doit ressembler à un site de marque beauté haut de gamme conçu par un studio de direction artistique.

## 3. Photographies : priorité absolue

Ne plus jamais utiliser une découpe du flyer contenant des textes, des icônes ou des éléments graphiques.

Créer ou obtenir des photographies indépendantes et cohérentes avec l'univers du flyer.

Prévoir notamment :

1. Portrait beauté glamour avec peau lumineuse.
2. Gros plan sur les extensions ou le rehaussement de cils.
3. Photographie de manucure avec ongles nude.
4. Soin du visage en institut.
5. Bronzage et peau lumineuse.
6. Maquillage professionnel en gros plan.
7. Univers intérieur d'un institut premium, uniquement comme visuel d'ambiance clairement non présenté comme le véritable établissement.

Les photos doivent être photoréalistes, harmonisées entre elles et adaptées au web.

Utiliser des fichiers locaux optimisés avec Next.js Image.

Si aucun outil de création ou aucune source de photographies correctement licenciées n'est disponible, signaler ce blocage. Ne pas fabriquer de fausses preuves d'activité et ne pas réutiliser le flyer comme photographie.

## 4. Nouvelle page d'accueil

### HERO

Créer une véritable composition immersive.

À gauche :
- Grand titre éditorial.
- Accroche manuscrite rose corail.
- Texte court et séduisant.
- Bouton principal de réservation.
- Bouton secondaire vers les prestations.

À droite :
- Grande photographie beauté indépendante.
- Forme de cadrage élégante.
- Petites photographies secondaires superposées.
- Badge circulaire rose.
- Effets de profondeur.

Le hero doit occuper presque tout le premier écran sur ordinateur.

### SECTION PRESTATIONS

Créer une composition de photographies et de cartes, inspirée directement du flyer.

Chaque famille de soins doit bénéficier d'un visuel :

- Regard.
- Ongles.
- Visage.
- Bronzage.
- Épilation.
- Maquillage.
- Bien-être.

Les cartes doivent être élégantes, immersives et interactives.

Conserver l'accès à l'intégralité des prestations, ainsi que leurs restrictions réglementaires actuelles.

### SECTION EXPÉRIENCE BEAUTÉ

Créer une section éditoriale avec :

- Grande photographie lifestyle.
- Texte de présentation.
- Composition asymétrique.
- Accroches manuscrites.
- Petits éléments graphiques.

### SECTION RÉSERVATION

Concevoir une invitation à réserver beaucoup plus séduisante.

Éviter un simple bloc avec un bouton.

Prévoir une photographie, une mise en scène graphique et un appel à l'action très visible.

### SECTION CARTES CADEAUX

Créer une mise en scène haut de gamme autour d'une carte cadeau élégante.

### SECTION RÉSEAUX SOCIAUX

Créer un aperçu visuel de l'univers Instagram/TikTok, éventuellement avec une maquette de smartphone.

Ne pas inventer de compte, de publications réelles ou de statistiques.

## 5. Animations et interactions

Utiliser Framer Motion ou une solution légère compatible avec l'architecture existante.

Prévoir :

- Apparition progressive des sections.
- Déplacements subtils des photographies.
- Effets au survol des cartes.
- Transitions douces des boutons.
- Apparition des éléments graphiques.
- Micro-interactions élégantes.

Ne pas sacrifier les performances ou l'accessibilité.

Respecter `prefers-reduced-motion`.

## 6. Mobile : conception spécifique

Le site doit être particulièrement réussi sur smartphone.

Ne pas simplement réduire la version ordinateur.

Recomposer les éléments pour obtenir une expérience mobile pensée pour une clientèle habituée à Instagram et TikTok.

Prévoir :
- Hero vertical immersif.
- Cartes photographiques adaptées au tactile.
- Bouton de réservation très accessible.
- Navigation fluide.
- Textes lisibles.
- Absence de débordement horizontal.

## 7. Conserver les fonctionnalités existantes

Ne pas supprimer ou réécrire inutilement :

- Le système de réservation.
- Le calendrier.
- Les disponibilités.
- Les protections contre les doubles réservations.
- Les accès administrateur.
- Les connexions préparées Supabase.
- Les intégrations Stripe.
- Les notifications WhatsApp.
- Les formulaires de contact.
- Les contrôles réglementaires sur les prestations.

Le travail porte principalement sur la direction artistique et l'expérience utilisateur.

Ne pas intégrer de fausses coordonnées, de faux avis ou de liens non fonctionnels.

Conserver la possibilité de remplacer le nom et le logo définitifs via la configuration centralisée.

## 8. Contrôle qualité visuel obligatoire

Je veux que tu utilises Playwright pour ouvrir et photographier les différentes pages.

Effectue des captures sur :
- Desktop 1440 px.
- Tablette.
- Smartphone 390 px.

Compare systématiquement ces captures à l'univers de `design/reference-flyer.png`.

Vérifie particulièrement :
- Richesse des compositions.
- Qualité des photographies.
- Fidélité de la palette.
- Cohérence de la typographie.
- Respect du style éditorial.
- Expérience mobile.
- Impact visuel du hero.

Corrige les écarts significatifs avant de terminer.

La validation ne doit pas se limiter à TypeScript, ESLint et au build.

**Le rendu visuel est ici un critère de réussite majeur.**

## 9. Contraintes de travail

Travaille exclusivement en local.

Ne pousse aucun commit sur GitHub.

Ne déploie rien.

Ne modifie pas les données réelles de production.

Ne déclenche aucun paiement ni notification réelle.

Exécute les tests existants pour vérifier qu'aucune fonctionnalité n'a régressé.

## OBJECTIF FINAL

Transformer le site actuel en une véritable expérience digitale beauté, photographique, glamour, moderne et immersive.

**Je veux retrouver l'ADN du flyer dès les trois premières secondes de navigation.**

Je ne veux plus voir un template de salon de beauté minimaliste.

Je veux un site avec une direction artistique forte, digne d'une marque de beauté premium présente sur Instagram et TikTok.