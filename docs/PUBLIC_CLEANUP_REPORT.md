# MONÉA — Nettoyage public et consultation des prestations

## Portée

Intervention limitée aux textes publics et à l’accès au catalogue/réservation. Aucun fichier CSS, aucune police, image, animation, section ou asset de logo n’a été modifié. Les compositions et les classes de présentation sont conservées ; seuls les textes et blocs provisoires ont été retirés ou remplacés par des informations commerciales ou fonctionnelles durables.

## Mentions nettoyées

- Accueil et mosaïque : légendes « Photographies d’illustration », « INTÉRIEUR D’AMBIANCE IMAGINÉ », message « Le studio se prépare », annonce d’ouverture future des réservations, « Catalogue de lancement » et badges « Bientôt disponible ».
- Réseaux sociaux : comptes Instagram/TikTok « à venir », « Moodboard d’illustration » et « BEAUTY MOODBOARD · APERÇU ». Seuls les liens réellement configurés sont affichés ; la composition photographique demeure.
- Catalogue et fiches : suppression des légendes et des mentions de tarifs de démonstration/préouverture. Les tarifs et durées affichés restent ceux de la configuration. Les badges indiquent maintenant « Réservation en ligne » ou « Consultation », sans promettre la réservation des prestations bloquées.
- Cartes cadeaux : « CARTE CADEAU · APERÇU » devient « CARTE CADEAU ». Les annonces de préparation sont retirées ; le bouton conduit au contact, sans inventer une vente ou des modalités de carte cadeau.
- Contact et footer : retrait des annonces de coordonnées/WhatsApp à confirmer, des messages techniques de stockage local et des légendes d’ambiance. Aucun contact absent n’a été inventé.
- Mentions légales et retour de réservation : retrait du vocabulaire « démonstration locale », « développement » et « base locale ». Les informations légales manquantes restent signalées et les paiements simulés restent explicitement identifiés comme tels.

Les attributs alternatifs fidèles aux images d’ambiance restent conservés : aucune photo n’est présentée comme une réalisation réelle ou une photographie du véritable local. Les avis fonctionnels d’indisponibilité, les restrictions professionnelles, les informations légales et les avertissements sur les paiements fictifs sont maintenus.

## Consultation et réservation

L’audit en lecture seule de la base de travail confirme **16 prestations visibles et 7 catégories actives**. Aucune n’était exclue du catalogue à cause de `coming_soon` ou `study` ; ces statuts ne sont pas utilisés comme filtre de consultation. Il n’a donc pas été nécessaire de modifier les prestations, les catégories ou leurs statuts enregistrés.

Les 16 fiches sont consultables, y compris celles dont la réservation est bloquée. Les liens de l’accueil et les filtres de catégories ont été contrôlés. Un paramètre de catégorie inconnu affiche désormais le catalogue complet au lieu d’une liste vide.

Cinq prestations sont activées et proposées dans le sélecteur de réservation :

1. Extensions de cils.
2. Rehaussement de cils.
3. Browlift.
4. Teinture des cils et des sourcils.
5. Prothésie ongulaire.

Leurs liens de fiche conduisent à la prestation exacte dans la réservation. Un lien direct vers une prestation bloquée affiche maintenant sa raison précise, au lieu de sélectionner silencieusement une autre prestation. Une demande inconnue et un catalogue sans prestation réservable ont également un message fonctionnel adapté.

Les prix n’ont pas changé. L’affichage d’un prix configuré à zéro est corrigé pour présenter `0,00 €`, sans le remplacer par un tiret.

### Réservations maintenues bloquées

Les raisons ci-dessous proviennent des contrôles déjà présents dans le projet ; aucun contrôle n’a été assoupli et aucune habilitation n’a été déclarée validée.

| Prestation | Restriction dans la configuration actuelle |
| --- | --- |
| Manucure · beauté des mains | Qualification professionnelle non validée ; réservation non activée. |
| Beauté des pieds | Qualification professionnelle non validée ; réservation non activée. |
| Nettoyage de peau | Qualification professionnelle non validée ; réservation non activée. |
| Soins du visage | Qualification professionnelle non validée ; réservation non activée. |
| Gommages et masques | Qualification professionnelle non validée ; réservation non activée. |
| Modelage esthétique | Qualification professionnelle non validée ; réservation non activée. |
| Épilation à la cire | Qualification professionnelle non validée ; réservation non activée. |
| Maquillage esthétique | Qualification professionnelle non validée ; réservation non activée. |
| Spray tan · douche bronzante | Qualification professionnelle et procédé non validés ; réservation non activée. |
| Luminothérapie | Restriction spécifique aux équipements dans le moteur existant ; vérifications de matériel/sécurité/habilitation non validées ; aucun tarif renseigné. |
| Appareil de bronzage UV | Restriction spécifique aux équipements dans le moteur existant ; formation, déclaration, contrôle et assurance à valider selon la fiche ; aucun tarif renseigné. |

### Disponibilités réelles

**Aucun horaire d’ouverture n’est enregistré dans la base de travail.** Les cinq prestations activées ne disposent donc actuellement d’aucun créneau. Aucun horaire, prix ou statut n’a été créé pour masquer cette situation.

Le parcours complet de chacune des cinq prestations est contrôlé avec des horaires de test dans une base SQLite distincte. Le paiement et les notifications restent simulés. Les paramètres de production (`bookingEnabled`, validation des tarifs, mentions légales/confidentialité et intégrations) sont conservés ; le nettoyage éditorial ne vaut pas activation commerciale de la réservation réelle.

## Vérification et conservation des données

L’empreinte SHA-256 de `.local/data/monea-development.sqlite` est identique avant/après :

`d872a52e869261dc4cf51c6a70fd85736916c38e14fc5d704cd8f74a406c4942`

Les tests utilisent exclusivement des bases isolées. L’agenda jour/semaine/mois, les clientes, l’authentification, les notifications, les paramètres, les blocages et les règles de qualification n’ont pas été modifiés.

Les captures avant/après sont dans `docs/screenshots/nettoyage/{avant,apres}/{local-desktop,local-mobile}/`. Un contrôle automatique compare les images, polices, couleurs, fonds, espacements internes et écarts de la mosaïque, des cartes de l’accueil, du header et du logo avec l’état initial. Les suppressions de paragraphes provisoires peuvent naturellement réduire la hauteur des zones concernées.

Résultats finaux :

| Contrôle | Résultat |
| --- | --- |
| `npm run typecheck` | Réussi |
| `npm run lint` | Réussi |
| `npm test` | 87 tests réussis |
| Build de production isolé via le lanceur `npm run test:e2e` | Réussi |
| Playwright public | 27 tests réussis sur ordinateur, tablette et mobile |
| Playwright administration locale | 10 tests réussis |
| Playwright nettoyage/catalogue | 4 tests réussis sur ordinateur et mobile : 16 fiches, 7 catégories, liens de l’accueil, raisons de blocage et cinq réservations complètes par format |

Total : **41 tests Playwright réussis**. Les réservations de contrôle utilisent uniquement le paiement mock, des coordonnées de test et des horaires dans la base de test isolée. La limite anti-abus réelle reste inchangée ; les deux formats de test représentent deux visiteurs distincts.

## Fichiers concernés

- Pages publiques : `src/app/page.tsx`, `src/app/prestations/page.tsx`, `src/app/prestations/[slug]/page.tsx`, `src/app/reservation/page.tsx`, `src/app/cartes-cadeaux/page.tsx`, `src/app/contact/page.tsx`, `src/app/mentions-legales/page.tsx`.
- Composants : `src/components/hero-mosaic.tsx`, `src/components/beauty-art.tsx`, `src/components/site.tsx`, `src/components/catalogue.tsx`, `src/components/contact-form.tsx`, `src/components/booking-form.tsx`, `src/components/local-receipt.tsx`.
- Texte des badges d’accueil : `src/config/editorial.ts` (images inchangées).
- Explications des blocages : `src/lib/catalogue.ts` (fonction d’explication ajoutée ; `eligible`, entrées du catalogue et restrictions inchangés).
- Tests : `tests/domain.test.ts`, `e2e/public.spec.ts`, `e2e-cleanup/public-catalogue.spec.ts`, `playwright.cleanup.config.ts`.
- Documentation et captures : le présent rapport, `docs/screenshots/nettoyage/` et les captures publiques/gestion régénérées par les suites existantes. Le script d’audit en lecture seule est conservé dans `.local/audit-public-catalogue.mjs`, dossier local ignoré.

Aucun secret, migration, fichier de design ou composant d’administration n’a été changé. Aucun commit, push, déploiement, paiement réel ou envoi externe.
