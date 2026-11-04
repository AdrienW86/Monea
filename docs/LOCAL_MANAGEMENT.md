# Administration locale MONÉA

Le mode local fonctionne sans Supabase, Stripe, WhatsApp ou email. La direction artistique publique et les cartes du catalogue sont conservées. L’administration dispose d’une interface distincte, avec navigation latérale, tableaux, recherche et formulaires en fenêtres modales.

## Démarrer et se connecter

```powershell
npm.cmd run local:setup
npm.cmd run dev -- --port 3210
```

Ouvrir http://localhost:3210/admin/connexion. Lire `LOCAL_ADMIN_EMAIL` et `LOCAL_ADMIN_PASSWORD` dans `.env.local`. Le mot de passe et le secret de session sont générés aléatoirement ; ils ne sont pas imprimés dans les journaux. Le script ne remplace aucune valeur existante. Si un ancien `.env.local` existe, définir explicitement `DATA_PROVIDER=local`, `PAYMENT_PROVIDER=mock` et `NEXT_PUBLIC_APP_URL=http://localhost:3210`. Redémarrer après modification des secrets. Ne pas copier des identifiants Supabase ou Stripe de production dans cet environnement.

Un seul compte, sans inscription publique. La session est stockée côté serveur, le cookie est HttpOnly/SameSite Strict et expire au bout de 12 heures. Déconnexion et rotation des identifiants invalident les sessions concernées. Les actions vérifient l’origine et la session côté serveur. Les routes historiques Supabase ne permettent pas de contourner l’authentification locale. Le mode local et les paiements fictifs sont refusés en production ; `npm run build` compile le projet mais `npm start` ne doit pas servir une configuration `DATA_PROVIDER=local`.

## Fonctionnalités disponibles

| Rubrique                  | Utilisation réelle                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                  | Rendez-vous à venir, clientes, paiements explicitement fictifs, état des horaires, chargement explicite du jeu fictif                                                                           |
| `/admin/planning`         | Jour, semaine lundi–dimanche, mois ; positions horaires réelles, événements cliquables, créneaux libres, blocages et fermetures ; jour courant ; navigation tactile et défilement de la semaine |
| `/admin/rendez-vous`      | Création manuelle sans Stripe, cliente existante ou nouvelle, prestations consécutives, notes privées, date/heure, statuts, annulation, recherche, filtres et journal                           |
| `/admin/clientes`         | Fiches, coordonnées, notes, historique ; suppression protégée si des rendez-vous existent                                                                                                       |
| `/admin/indisponibilites` | Heure, demi-journée, journée, semaine, plusieurs semaines, mois, période personnalisée, récurrence hebdomadaire ; modification d’une occurrence, suppression d’une occurrence ou série          |
| `/admin/horaires`         | Ouvertures, pauses, jours fermés, exceptions, intervalle de départ, durée initiale, préavis, horizon ; génération serveur sur une période sans suppression des rendez-vous                      |
| `/admin/catalogue`        | Prestations : prix, durée, catégorie, description, ordre, visuel, visibilité, réservation et archivage ; produits séparés avec prix et stock facultatif                                         |
| `/admin/categories`       | Création, édition, visuel, ordre, masquage et suppression si aucune référence                                                                                                                   |
| `/admin/notifications`    | Outbox locale des créations, modifications, annulations, paiements simulés et contacts ; état lu/non lu ; aucun envoi                                                                           |
| `/admin/messages`         | Consultation, traitement et suppression des contacts reçus localement                                                                                                                           |
| `/admin/parametres`       | Identité commerciale, règles, affichage du planning, activation locale du parcours, export privé complet, journal et rechargement explicite des données fictives                                |

Les produits n’occupent aucun créneau et ne sont pas vendus en ligne. Les nouveaux visuels PNG/JPEG/WebP peuvent être importés : taille maximale du corps 5 Mio, contrôle des dimensions et format, réencodage WebP, fichiers dans `public/assets/uploads/`. Les SVG ne sont pas acceptés à l’import. Les visuels d’illustration ne sont pas présentés comme des photographies réelles de l’établissement.

Les prix et intitulés sont figés dans les lignes du rendez-vous. Changer le catalogue ou déplacer un rendez-vous conserve ses anciennes lignes. Changer volontairement les prestations d’un rendez-vous manuel crée de nouvelles lignes, avec trace des anciennes dans le journal. Une réservation dont le paiement fictif est accepté conserve ses prestations et son montant ; pour changer ces prestations, annuler et créer un nouveau rendez-vous. Aucun remboursement n’est annoncé automatiquement.

Les restrictions professionnelles/procédés/matériels sont vérifiées côté serveur. Cocher « Réservable » ne valide aucune qualification. Une attestation séparée avec preuve et confirmation explicite est journalisée. L’exigence d’une prestation existante ne peut pas être abaissée. Le matériel spécifique reste à l’étude, sans réservation ni prix.

## Parcours public et sécurité des créneaux

`/reservation` : catégorie → prestation autorisée → jour → heure → coordonnées → `/paiement-local` → succès, refus ou expiration fictifs → reçu minimal. Le paiement ne contacte aucun prestataire. Un hold occupe le créneau jusqu’au résultat ou son expiration. Un succès le confirme ; un refus/une expiration le libère. La projection publique ne contient ni cliente, ni coordonnées, ni note, ni motif interne.

Une seule ressource est planifiée, comme dans l’architecture initiale. Une réservation multiple réserve un intervalle continu égal à la somme des durées. SQLite utilise `BEGIN IMMEDIATE`, WAL, clés étrangères et triggers d’exclusion pour tous les rendez-vous, holds, modifications et blocages. Les bornes sont semi-ouvertes : un rendez-vous finissant à 10 h peut être suivi d’un autre à 10 h. Une fermeture en conflit est refusée entièrement, avec les périodes concernées dans l’administration. Les horaires et dates sont calculés en Europe/Paris, avec tests des changements d’heure.

Les modifications d’horaires recalculent les disponibilités et préservent tous les rendez-vous déjà créés. Une fermeture horaire n’annule pas une cliente ; utiliser une indisponibilité pour obtenir le contrôle explicite des conflits. Les disponibilités publiques sont recalculées à chaque lecture ; la génération constitue un aperçu enregistré, jamais un stock de créneaux faisant autorité.

## Persistance, démonstration et sauvegardes

Node 22.13 minimum pour `node:sqlite`. Sur Node 22.13, SQLite émet un avertissement expérimental ; les tests ont été exécutés avec cette version. Aucun moteur ou service externe n’est requis.

- Base habituelle : `.local/data/monea-development.sqlite`, configurable par `LOCAL_DATABASE_PATH` uniquement sous `.local/`.
- Les migrations SQLite versionnées s’appliquent sans remise à zéro. Seuls les réglages et le catalogue initial sont créés sur une base neuve ; aucune cliente ni horaire n’est injecté au lancement.
- Le jeu fictif se charge uniquement par le bouton dédié et contient des clientes identifiées « fictives ». Son rechargement conserve les saisies manuelles. Il ajoute des horaires exemples seulement si aucun horaire n’existe ; son action explicite règle le préavis à une heure et active le parcours local.
- Les tests Playwright utilisent un fichier SQLite unique dans `.local/e2e/`, séparé de la base de travail. Aucun reset de la base de travail.
- Exporter depuis Paramètres pour obtenir le JSON complet version 2 (données, lignes, allocations, règles, paiements mock, historique et outbox). Les sessions, mots de passe et secrets en sont exclus. Cet export privé contient les coordonnées clientes et les jetons de reçu : le conserver hors Git et hors `public/`.
- Pour une sauvegarde SQLite brute, arrêter le serveur proprement et copier le dossier de la base, avec les éventuels fichiers WAL/SHM. Sauvegarder également `public/assets/uploads/`. Aucun nettoyage ou reset automatique n’est exécuté.

## Préparer Supabase sans perdre les données

Mise à jour du 30 octobre 2026 : le raccordement du back-office commun est maintenant implémenté. La procédure détaillée, les sauvegardes WAL, l’import réexécutable et les limites de recette hors ligne sont décrits dans [le rapport Mission 1](SUPABASE_MISSION_1_REPORT.md). Ce rapport fait référence pour la bascule ; aucune connexion distante n’a encore été réalisée.

1. Exporter le JSON depuis Paramètres et conserver une sauvegarde SQLite arrêtée ainsi que les médias.
2. Exécuter `npm.cmd run local:prepare-import -- chemin/export.json`. Le script vérifie collections, identifiants et références ; il produit un SQL d’archive et un manifeste dans `.local/migration/`. Il ne se connecte à aucun serveur.
3. Sur un futur environnement de recette, appliquer les migrations locales avec un opérateur autorisé. La nouvelle migration ajoute catégories, produits, notes clientes, séries de blocages, statuts terminés/absence et lignes figées. Les contraintes GiST et les contrôles antérieurs sont préservés. Les tables supplémentaires ont RLS et lecture limitée à l’administratrice ; aucune écriture publique.
4. L’archive SQL préparée conserve le contenu intégral de l’export dans `local_import_archives`, avec empreinte SHA-256 et déduplication. La migration de parité permet ensuite une promotion explicite des paiements fictifs avec `provider=mock`, une contrainte de séparation et leur exclusion des encaissements Stripe.
5. Avant toute promotion dans les tables opérationnelles : sélectionner les données utiles, exclure ou archiver les démonstrations, rapprocher les UUID existants, reprendre catégories/services/clientes/allocations/rendez-vous/lignes dans cet ordre, vérifier les sommes et durées, contrôler tous les chevauchements, conserver l’historique source. Le script prépare une archive ; il ne promeut pas automatiquement les données fictives en production.
6. Les onze écrans avancés utilisent maintenant la même interface et le même contrat repository en modes SQLite et Supabase. Le parcours Stripe existant est conservé. Changer seulement `DATA_PROVIDER` ne migre aucune donnée : appliquer les migrations et importer sur une destination autorisée reste indispensable, ainsi que la recette de la véritable pile Supabase avant basculement.
7. Créer le seul compte Supabase Auth autorisé et l’inscrire dans `admin_users`, sans inscription publique. Régler `DATA_PROVIDER=supabase`, `PAYMENT_PROVIDER=stripe`, clés serveur et publiques appropriées, URL exacte et sel anti-abus. Tester en recette avant production.
8. Stripe : mode test, webhook signé, confirmation idempotente, remboursement vérifié puis configuration de production avec autorisation explicite. WhatsApp/email : identifiants, destinataires et modèles validés, `ENABLE_EXTERNAL_NOTIFICATIONS` explicitement activé après recette. Les routes Stripe/cron et le worker externe sont inactifs en mode local.

Référence RLS consultée : [documentation Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security). Aucun changement distant, paiement ou message externe n’a été effectué.

## Vérifications

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e:local
npm.cmd run test:e2e
npm.cmd run build
```

Les tests locaux couvrent les scénarios du brief : catalogue, prix/durées figés, rendez-vous manuels et consécutifs, concurrence SQLite indépendante, chevauchements/déplacements, annulation/libération, blocages 1/7/31 jours et récurrences atomiques, génération sans perte, paiement mock succès/refus/expiration, confidentialité, qualifications, rechargement fictif et persistance après fermeture/réouverture. Les tests PostgreSQL embarqués vérifient aussi la migration, les nouvelles protections RLS et la concurrence de la ressource existante. Les captures Playwright sont produites dans `test-results/` ; conserver celles utiles avant une autre suite, qui utilise également ce répertoire.
