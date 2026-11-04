# MISSION CODEX — SITE WEB + RÉSERVATIONS + BACK-OFFICE POUR UN INSTITUT DE BEAUTÉ

Tu travailles **en local**, dans le dossier courant. L'utilisateur prépare lui-même le dépôt GitHub : **ne crée pas de dépôt distant, ne pousse pas, ne déploie pas et ne déclenche aucune opération extérieure réelle sans autorisation**. Si le dossier est vide, initialise le projet; s'il contient un projet, fais d'abord un audit et préserve tout l'existant utile. Exécute les étapes, implémente, teste et documente : ne te contente pas de produire un plan. Tu peux prendre des décisions techniques raisonnables et documenter tes choix, sans interrompre le travail pour des précisions non bloquantes.

## 1. Contexte et résultat attendu

Construire une application web responsive, performante, accessible et exploitable pour une professionnelle de la beauté à Perpignan. Son nom définitif, son logo, sa raison sociale, son adresse, son numéro et ses comptes sociaux ne sont **pas encore arrêtés**. Utilise une identité **temporaire de démonstration « MONÉA »**, issue du flyer de référence, mais **tous les éléments de marque doivent être centralisés dans une configuration et remplaçables sans refonte**. Ne crée pas de faux avis, de fausses photos de l'établissement, d'adresse fictive, de numéro inventé, de compte social ou de promesse de résultat inventée. Une information obligatoire non fournie doit désactiver proprement la fonction dépendante, avec un diagnostic visible en administration; ne jamais simuler une réussite.

L'objectif est un **site vitrine avec réservation et paiement en ligne intégré**, et un **back-office privé équivalent aux fonctions de base de Planity**, pour **une seule administratrice et une seule ressource de prestation** : Monica. Les clientes ne créent pas de compte pour réserver. Elles consultent les disponibilités, choisissent un soin, saisissent leurs coordonnées, règlent sur Stripe, puis reçoivent une confirmation uniquement après validation du paiement. Les créneaux occupés sont grisés et non réservables; aucune information personnelle ou administrative ne fuite au public.

**Paramètres initiaux** : chaque prestation = **60 minutes**, tarif = **20,00 € TTC affichés** (montant en centimes côté technique); ces paramètres sont modifiables depuis le back-office. Horaires, dates d'ouverture, adresse et modalités de déplacement **non connues** : ils sont configurables par l'administratrice, sans horaires fictifs. Fuseau **Europe/Paris**; date locale en français. Le montant global de 20 € est une donnée de cadrage à rendre paramétrable, non une promesse de tarif définitivement validé.

## 2. Direction artistique — référence obligatoire

Le visuel joint par l'utilisateur est la référence **graphique**, non une preuve qu'un local existe. Place sa copie dans `design/reference-flyer.png` si le fichier est fourni localement; sinon, documente comment l'ajouter et continue le développement avec une palette très proche.

Identité visuelle : fond nuit très sombre / graphite, blanc cassé, rose poudré et pêche/corail, contrastes forts; typographie éditoriale premium pour les titres, sans-serif propre et lisible pour le texte, accents manuscrits parcimonieux, photos beauté traitées façon magazine, compositions modernes (cartes décalées, grands portraits, découpes, superpositions légères), micro-interactions soignées, approche Instagram/TikTok **sans sacrifier l'ergonomie**. Navigation fluide mobile d'abord. Éviter le rendu générique de template, les carrousels lourds et les animations qui empêchent la réservation. Respect `prefers-reduced-motion`.

Marque configurable : nom commercial, sous-titre (ex. Beauty Studio), slogan, logo SVG/PNG, favicon, couleurs/tokens, images, adresse, téléphone, email, réseaux, lien WhatsApp, liens de réservation. Ne pas insérer le faux identifiant `@monea.beauty` comme si le compte existait. Ne pas présenter la photo du local généré sur le flyer comme une photo réelle de l'établissement. Pas de logos de tiers ni photos sans droit d'utilisation. Si les assets réels manquent, utiliser des compositions CSS, des visuels génériques sous licence vérifiable et des emplacements facilement remplaçables; ne jamais attribuer une image générique à Monica.

Pages : accueil éditorial soigné avec CTA « Réserver », catalogue des prestations et catégories, fiches service, prise de rendez-vous, confirmation / retour de paiement, contact, cartes cadeaux en page de présentation (achat désactivé tant que le fonctionnement n'est pas défini), informations légales et confidentialité (pages structurées mais publication des mentions légales conditionnée aux vraies données), 404 / erreurs. Prévoir SEO local cohérent sans affirmer l'existence d'un établissement ouvert ou d'une adresse non confirmée; métadonnées, sitemap, robots, données structurées uniquement quand les données sont réelles. Vercel Analytics/Speed Insights uniquement si demandé ou configuré, avec conformité consentement.

## 3. Catalogue complet et statut réglementaire

Inclure **toutes les lignes du tableau fourni précédemment** dans une table `services`, regroupées en catégories. Une prestation peut être visible sans être réservable. Le statut de qualification doit être une donnée distincte de l'état commercial.

**Catégorie A — peut être proposée sans CAP esthétique, sous réserve de savoir-faire, sécurité et assurance :**
1. Pose de faux-cils / extensions de cils
2. Réhaussement de cils
3. Browlift
4. Teinture des cils et des sourcils
5. Pose de faux ongles / prothésie ongulaire **sans manucure préalable**

**Catégorie B — soins esthétiques réservés aux personnes professionnellement qualifiées :**
6. Manucure / beauté des mains
7. Beauté des pieds / soins esthétiques des pieds
8. Nettoyage de peau
9. Soins du visage
10. Gommages et masques
11. Modelage esthétique du visage ou du corps
12. Épilation à la cire
13. Maquillage esthétique
14. Spray tan / douche bronzante : par prudence, considérer comme **non réservable en attendant la vérification de qualification et de la nature exacte du procédé**, notamment lorsqu'il consiste à appliquer un produit cosmétique sur la peau.

**En plus, prévus dans le brief initial mais absents du tableau :** « luminothérapie » et « appareil de bronzage UV ». Les afficher uniquement dans une rubrique `Prestations à l'étude`, **sans tarif de réservation ni paiement**, tant que le matériel, les obligations réglementaires, la sécurité et l'assurance ne sont pas validés. Une cabine UV a des exigences propres de formation, déclaration et contrôle : ne pas l'activer sur la seule base de l'obtention du CAP.

Pour les prestations B, montrer dans le catalogue **« Bientôt disponible » / « Réservation indisponible »**, et désactiver également la réservation dans les API serveur, pas seulement dans le bouton. Ne pas présenter Monica comme diplômée avant preuve. Prévoir `qualification_requirement`, `qualification_verified_at`, `operational_status`, `bookable`, `visibility`, `price_cents`, `duration_minutes`, `sort_order` et `description`, avec vérifications serveur. Un toggle UI ne suffit pas à contourner l'exigence de qualification; exiger une action administrative explicite attestant que la qualification appropriée a été vérifiée, enregistrée dans un journal d'audit. Les exigences différentes (UV, matériel particulier) conservent un blocage distinct.

Il faut pouvoir modifier durée, prix, catégorie, description, disponibilité et visibilité de chaque prestation plus tard, sans modifier le code. Au lancement, **seules les prestations de catégorie A peuvent être activées par défaut** et uniquement si les intégrations et horaires réels sont prêts. Catégorie B visible mais non réservables. Les images de services sont facultatives et administrables.

## 4. Parcours cliente de réservation et paiement

1. Sélectionner une prestation réellement réservable.
2. Voir un calendrier propre, navigation par semaine/jour, dates disponibles et indisponibles grisées (jours fermés, créneaux réservés, blocs administratifs, créneaux expirés). Pas de nom des autres clientes, ni statut précis des blocages.
3. Choisir un créneau de 60 min sur les horaires configurés; contrôler en serveur les règles d'ouverture, jours fériés/exceptionnels configurés, fuseau Europe/Paris, antériorité, délai minimum et fenêtre maximale configurables, chevauchements, et qualification.
4. Saisir prénom, nom, téléphone, email, consentement requis à la politique de confidentialité; validation robuste côté serveur (Zod ou équivalent), anti-spam et limitation de débit. Aucun compte cliente requis.
5. Créer **atomiquement** une réservation provisoire unique, puis une session **Stripe Checkout hébergée** au prix calculé côté serveur, jamais depuis une somme modifiable par le navigateur. Présenter clairement le récapitulatif et le montant TTC avant paiement.
6. Si paiement confirmé par **webhook Stripe vérifié** : réserver définitivement, consigner paiement/commande, notifier l'administratrice via file WhatsApp, envoyer un email transactionnel de confirmation à la cliente si le fournisseur est configuré. Une URL « succès » ne constitue jamais une preuve de paiement.
7. En cas d'abandon, expiration, échec ou annulation du paiement : libérer le créneau suivant la politique sécurisée d'expiration. Un webhook tardif ne doit jamais engendrer une double réservation; prévoir réconciliation, alerte admin et remboursement à traiter si paiement reçu alors que le créneau a été légalement réattribué.
8. Afficher une page de confirmation avec référence de réservation, prestation, créneau et statut vérifié depuis le serveur; ne pas exposer de données privées via un identifiant prévisible.

Choisir une politique cohérente pour la rétention provisoire : exemple **35 minutes de hold serveur pour Checkout expirant à 30 minutes**, configurable et testé. Expirer les holds via transaction/cron + nettoyage à la lecture, en tenant compte des webhooks différés. Traiter `checkout.session.completed` uniquement si `payment_status` payé; gérer les paiements asynchrones (`async_payment_succeeded`/`failed`), expiration, remboursements et redelivery de webhooks. Identifiants Stripe et clé d'idempotence stockés avec unicité.

**En absence de Stripe :** parcours public de paiement non activé, message clair, aucune fausse confirmation de paiement. Le back-office peut néanmoins gérer des rendez-vous manuels quand Supabase est disponible.

## 5. Anti-doublons : contrainte obligatoire en base de données

**Jamais de protection fondée uniquement sur le front-end.** Utiliser Supabase Postgres avec **une seule table de réservations temporelles** représentant tous les intervalles indisponibles : holds, RDV confirmés, RDV ajoutés manuellement, blocages admin. On peut conserver des tables `bookings`, `payments`, `closures` reliées, mais le verrouillage du temps doit passer par cette source commune, sans possibilité de conflit entre tables.

Prévoir une contrainte Postgres d'exclusion sur plage de temps, par exemple `EXCLUDE USING gist (tstzrange(start_at, end_at, '[)') WITH &&)` limitée aux états qui consomment la capacité, sur une ressource unique. Si un identifiant de ressource est ajouté, combiner `resource_id WITH =` (extension `btree_gist`) et le range. Vérifier `start_at < end_at`; stocker des instants UTC en DB (`timestamptz`), afficher en Europe/Paris et tester les changements d'heure été/hiver. Les intervalles adjacents doivent être autorisés : 10-11 h et 11-12 h. Les réservations annulées/expirées libèrent le créneau sans perte de l'historique.

Pour toute création/modification/annulation/blocage, faire les transactions côté serveur, idéalement dans des **fonctions SQL/RPC transactionnelles** avec contrôle d'identité et d'état. À chaque création, traiter proprement l'exception de conflit en réponse « créneau indisponible » et proposer une nouvelle sélection. La vérification des horaires, de l'éligibilité et des holds ne doit pas pouvoir être contournée par une requête API falsifiée.

Tests indispensables : 2 demandes simultanées sur le même créneau => exactement 1 créée; conflit RDV manuel / cliente; conflit blocage / réservation; créneaux adjacents acceptés; expiration/retry webhooks; blocage d'une journée entière, d'une semaine entière, d'un mois entier.

## 6. Back-office administratrice — une seule personne

Espace privé `/admin`, authentification **Supabase Auth** compatible SSR Next.js, connexion sécurisée; **aucune inscription publique**. Un seul compte autorisé, identifiant d'utilisateur admin configuré explicitement/autorisé en DB. Ne pas supposer qu'une simple adresse email dans le navigateur garantit le rôle. Vérifications de session **et** d'autorisation sur chaque page, Server Action, API et RPC concernées. Cookies sécurisés, rate limiting, protection CSRF selon flux, pas de secrets dans le client. Éviter la mise en cache des pages privées. RLS activée et politiques testées.

Tableau de bord moderne :
- Vue agenda **jour / semaine / mois**, navigation, plage horaire lisible sur mobile.
- Indicateurs : rendez-vous à venir, prestations et sommes encaissées, annulations, paiements en attente, notifications en échec.
- Consulter les fiches RDV (nom, téléphone, email, prestation, début/fin, source, paiement, notes internes, historique).
- **Ajouter manuellement** un RDV (cliente, prestation, date/heure, état payé/hors ligne/non payé explicitement distingués), avec même anti-chevauchement. Ne jamais falsifier un paiement Stripe.
- Modifier ou annuler un rendez-vous avec confirmation et motif optionnel; politique explicite de remboursement Stripe : **annuler un rendez-vous n'est pas automatiquement rembourser**, l'opération de remboursement exige une action distincte et confirmée, via Stripe, idempotente et auditée.
- **Bloquer une heure, un intervalle, une journée, une semaine ou un mois**, avec motif privé optionnel et calendrier de fermeture exceptionnel. Refuser ou signaler les conflits avec des réservations déjà payées : jamais les écraser silencieusement.
- Débloquer, réouvrir et gérer les horaires récurrents, pauses, jours exceptionnels et congés.
- Gérer les prestations, prix/durée, images et disponibilité; voir quelle qualification a été vérifiée et quand.
- Consulter et traiter les messages de contact; consulter le journal des notifications; bouton de relance contrôlé en cas d'échec.
- Paramètres : identité visuelle, coordonnées réelles, canaux, horaires, politique de réservation, intégrations (afficher les états de configuration sans révéler les secrets), changement du nom/logo à tout moment.
- Export CSV des rendez-vous (réservé admin) avec dates, statuts et contrôle des données personnelles; journal d'audit admin.

Dans la partie publique, les créneaux indisponibles apparaissent **gris ou non sélectionnables**, jamais la nature du blocage, le nom de la cliente ou d'autres données personnelles.

## 7. Supabase : schéma / migration / sécurité

Préparer des migrations SQL **versionnées** et réexécutables sur base locale/de test, avec seed uniquement de catalogue et paramètres sans identités fictives. Tables suggérées :
- `site_settings` (marque, contacts, horaires, drapeaux d'activation)
- `services` (catégories, réglementation, durée, tarifs et disponibilité)
- `clients` (PII minimale)
- `time_allocations` (plages occupées, type/état, plage Postgres avec EXCLUDE)
- `bookings` (liens client/service/temps, statut, instantané durée/prix, origine)
- `payments` (session/payment intent Stripe, état, montant, remboursements)
- `business_hours` et `special_hours` (ou équivalent)
- `contact_messages`
- `notification_outbox` (transport, tentatives, erreur, next_attempt_at, idempotency_key)
- `webhook_events` (événements Stripe traités une fois)
- `admin_audit_log`.

Clefs étrangères, index, checks, contraintes d'unicité, timestamps. Les historiques et montants de commandes passées ne doivent jamais changer quand on modifie le tarif des services. RLS : deny-by-default côté public pour données privées; public n'accède qu'à des listes de services et disponibilités **minimales** via routes serveur / RPC sécurisées et filtrées. Supabase `service_role` **serveur uniquement**, jamais en variable `NEXT_PUBLIC_*`; aucune PII dans la réponse de disponibilité. Tests RLS sur utilisateurs anonymes et non admin.

## 8. Stripe : préparer le branchement réel

Utiliser Stripe Checkout et l'API Stripe officielle, paramètres dans `.env.example` uniquement avec valeurs vides et documentation d'installation : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` uniquement si nécessaire, `NEXT_PUBLIC_APP_URL` (vraie URL à configurer). Enregistrer IDs/événements et vérifier les signatures à partir du **corps brut** des webhooks. Éviter les secrets en logs. Tester avec Stripe CLI, carte de test et événements idempotents. Ne jamais appeler la production ou encaisser des paiements réels sans identifiants, configuration et validation du propriétaire.

Le catalogue fonctionne sans Stripe, mais le bouton payer doit indiquer « Paiement indisponible pour le moment » ou être désactivé quand ce n'est pas connecté. Pas de faux « payé ».

## 9. WhatsApp : deux flux bien distincts

**Côté cliente :** bouton « Contacter sur WhatsApp » / « Question rapide » depuis pages et fiches prestations, lien `https://wa.me/<numéro E.164>` avec texte prérempli contenant nom du service choisi, **seulement quand le vrai numéro professionnel est saisi**. Sinon désactiver ce bouton avec message explicite. Ne jamais utiliser un numéro provisoire.

**Côté administratrice :** notification automatique d'une **réservation payée confirmée**, avec référence, prestation, date et heure, prénom ou infos strictement nécessaires, sans détails médicaux ou sensibles. Préparer l'intégration **Meta WhatsApp Business Platform / Cloud API** avec expéditeur, destinataire, token sécurisé, ID du modèle transactionnel (utility) approuvé. Une notification initiée par l'entreprise doit respecter les règles de modèles de messages WhatsApp; pas de simple lien `wa.me` pour prétendre à un envoi automatique. Envoi **après** validation du webhook Stripe, via outbox idempotente, retries bornés/backoff, journal, et alerte admin si échec. L'échec WhatsApp ne doit **pas annuler** une réservation payée. L'administratrice doit voir l'état « WhatsApp non configuré » tant que les identifiants et le modèle approuvé manquent.

Variables proposées : `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ADMIN_TO`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`, `META_GRAPH_API_VERSION` (version vérifiée à l'implémentation). Ne pas inventer l'ID ou la version; reprendre la version supportée documentée.

## 10. Formulaire de contact opérationnel

Formulaire public prénom, email, téléphone facultatif, sujet, message, consentement; validation serveur, anti-spam (honeypot + quotas/IP avec protection compatible hébergement, Turnstile si configuré), erreurs accessibles, pas de captcha bloquant par défaut. Sauvegarder de façon sûre en Supabase **et montrer les messages dans l'admin**. Envoyer une notification par email via fournisseur transactionnel (ex. Resend) si clés/domaines configurés; ne jamais perdre le message si cet envoi échoue, enregistrer l'échec et permettre une relance. Ne jamais annoncer « email envoyé » sans envoi vérifié. En l'absence de Supabase, bloquer la soumission avec un message honnête; pas de simulation de succès.

Prévoir des email HTML/texte esthétiques pour les confirmations et contact, uniquement avec expéditeur vérifié et vraies coordonnées. Ne pas publier d'adresse email inventée. Ne pas inclure de marketing sans consentement.

## 11. Tech / qualité / UX

Préférence : **Next.js App Router**, **TypeScript strict**, **Tailwind CSS**, composants accessibles (Radix/shadcn si utile), Supabase Postgres + Auth SSR, Stripe SDK, Zod, tests Vitest/Node + **Playwright**. Choisir versions stables réellement compatibles avec la version de Node locale; ne pas installer des dépendances obsolètes ou incompatibles. Architecture modulaire : `src/config/brand.ts`, `src/config/booking.ts`, `src/lib/booking`, `src/lib/payments`, `src/lib/notifications`, `src/lib/db`, routes publiques, `/admin`, API webhooks, migrations Supabase, tests.

Accessibilité clavier, focus visibles, couleurs contrastées, erreurs formulaires accessibles, calendrier utilisable sur smartphone, états chargement/vide/erreur. Images `next/image`, optimization de fonts, metadata, sitemap SEO, Core Web Vitals, pas de données privées côté client, pas de console d'erreurs. Respect RGPD : collecte minimale, texte d'information, consentement/acceptation distincts, possibilité de gestion/suppression selon obligations, durée de conservation paramétrable, pas d'analytics non essentiels avant consentement. Mentions légales et politique de confidentialité avec exigences réelles listées dans les points bloquants, sans faux texte publiable.

Se protéger contre injection, CSRF quand pertinent, IDOR, SSRF si URL acceptée, XSS, spam, enumeration de rendez-vous, abus de réservation, logs de secrets et fuite de PII. Rate limiter la création de holds et les réservations; email/téléphone normalisés. Aucune donnée de carte bancaire dans l'application : paiement chez Stripe.

## 12. Ordre d'exécution imposé

1. Examiner le dossier et les contraintes existantes; créer `docs/IMPLEMENTATION_PLAN.md` et inventaire des dépendances/variables manquantes. **Poursuivre ensuite l'implémentation**, sans attendre le GitHub.
2. Créer le design system, layout responsive, pages publiques, catalogue complet, logo/nom remplaçables et états de non-disponibilité conformes à la réglementation.
3. Créer les migrations SQL Supabase, modèles/validation, RLS et fonctions transactionnelles d'allocation anti-chevauchement.
4. Implémenter authentification admin unique, tableau de bord, gestion des horaires, blocages et RDV manuels, calendrier jour/semaine/mois.
5. Implémenter le tunnel public réel de réservation, holds, prix serveur, Stripe Checkout, webhook et confirmation.
6. Ajouter messages de contact, email transactionnel conditionné aux variables, WhatsApp public et outbox WhatsApp admin.
7. Écrire tests unitaires, intégration DB (incluant simultanéité) et E2E Playwright, vérifier TypeScript, lint, build.
8. Fournir `.env.example` **sans valeurs secrètes**, `README.md` avec procédure d'installation locale, démarrage Supabase local/migrations, Stripe CLI, WhatsApp et Resend, création du **seul** compte admin, procédures de test, puis `docs/GO_LIVE_CHECKLIST.md` listant explicitement tout ce qui empêche un vrai lancement.
9. Rendre un bilan final : fichiers, fonctionnalités prêtes, résultats des tests, limites, commandes à exécuter, et configuration manquante. Ne pas annoncer « opérationnel en production » sans tests de bout en bout et identifiants réels.

## 13. Scénarios de recette à valider

- Une cliente ne peut réserver qu'un service réellement activé; les soins réglementés sont visibles mais bloqués y compris via API.
- Deux clientes tentant le même créneau au même instant : **une seule** réservation provisoire; l'autre voit « Créneau indisponible ».
- Une cliente voit le créneau occupé en gris, **aucun nom client** ne fuit.
- Un rendez-vous manuel bloque immédiatement le créneau public.
- Un blocage admin jour/semaine/mois grise toutes les heures correspondantes. Un blocage sur un créneau déjà payé est rejeté ou nécessite une procédure explicite sans écraser la cliente.
- Les créneaux adjacents fonctionnent, ainsi que le passage à l'heure d'été/hiver en Europe/Paris.
- Le webhook Stripe validé confirme une seule fois le rendez-vous, même si Stripe renvoie le même événement plusieurs fois; un retour de page « succès » sans webhook ne confirme pas le paiement.
- Une session Checkout expirée libère sa réservation; un paiement tardif provoque réconciliation sûre, jamais une double réservation.
- Seule Monica (identité admin autorisée) voit et modifie le back-office; les autres sessions/API sont refusées.
- Une annulation n'entraîne pas implicitement un remboursement; remboursement explicite et tracé.
- Le contact apparaît en admin; erreur d'email externe consignée sans faux succès d'envoi.
- Une réservation payée insère une notification WhatsApp dans l'outbox; si configurée, elle s'envoie une seule fois; sinon elle reste clairement signalée comme non configurée et relançable.
- Aucune adresse, numéro, Instagram, logo réel ou situation d'ouverture fictive publiée.

## 14. Livrable final

Je veux **du code réellement exécuté et vérifié en local**, pas seulement des maquettes ou du pseudocode. N'attends pas le dépôt GitHub pour commencer. Aucun commit poussé, aucun déploiement, aucun vrai paiement ni message WhatsApp externe sans mon accord. Si une intégration exige une clé ou un compte manquant, termine **tout le code et tous les tests locaux possibles**, garde le composant hors service de façon sûre, et donne les instructions précises de branchement. Priorité : sécurité des réservations et conformité des prestations, puis UX et finitions visuelles.

Références officielles utiles :
- DGCCRF : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/faq-encadrement-des-soins-esthetiques-et-de-la-coiffure
- Supabase Auth : https://supabase.com/docs/guides/auth
- Supabase RLS : https://supabase.com/docs/guides/database/postgres/row-level-security
- Stripe : https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted
- Politique WhatsApp : https://whatsappbusiness.com/fr/policy/
