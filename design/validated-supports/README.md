# Supports MONÉA fournis

Les supports affichés sont des fichiers d’origine, sans reconstruction HTML/CSS ni génération d’image.

- Carte cadeau : pièce jointe envoyée et explicitement sélectionnée par le propriétaire le 4 novembre 2026 (« celle ci »). Le contenu JPEG de cette pièce jointe a été copié **à l’identique**, sans décodage/réencodage de l’image, dans `public/branding/supports/carte-cadeau-bois-validee.jpg`. Visuel : bois clair, eucalyptus, bougie, fleur blanche et bandeau olive. Dimensions : 1536 × 1024 px. SHA-256 : `8e450573502862d4d3111fddfc6a50c1b8988abc13d6b64016d1f3cbf53312cd`.
- Carte de visite : `MONEA_recto_verso_version_exacte_65x90_fond_perdu.pdf`, conservé à l’identique ici comme `carte-visite-source.pdf`. SHA-256 : `53137b1b06cd1d9544c89f488ac3ba4f3bc1093dfd3e74f38d993e9e102375ad`.
- Recto et verso : rendus PNG des pages 1 et 2 du PDF, à l’échelle 6, avec retrait des 3 mm de fond perdu sur chaque côté. Dimensions : 1104 × 1529 px. Aucun texte ni dessin repris, corrigé ou recomposé. Export local avec PDFium et Pillow dans `.local/pdf-tools`, sans dépendance ajoutée à l’application.

Le PNG au ruban vert retrouvé précédemment dans Téléchargements n’est pas la version retenue. Il est archivé dans ce dossier sous `carte-cadeau-ruban-non-retenue.png` et retiré des assets publics. La sélection de la pièce jointe ci-dessus lève l’ambiguïté de version.

Les trois images sont affichées intégralement, avec leur ratio d’origine, sans filtre, découpe CSS, effet de perspective ou recompression Next.js. Un clic ouvre chaque image d’origine en grand. Les cadres, ombres et décors restent à l’extérieur des images. Le PDF d’origine n’est pas exposé publiquement.
