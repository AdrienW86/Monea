# MONÉA — Opérations d'activation à valider

31 octobre 2026. **Préparation uniquement.** Aucun compte, paramètre distant, import, réservation ou paiement créé/modifié. Aucune migration exécutée. SQLite/mock et les fichiers d'environnement restent inchangés. Aucun code d'exécution Next.js ni composant visuel modifié.

Cette procédure remplace l'ordre proposé dans le plan antérieur : conformément à la demande actuelle, la fermeture des inscriptions intervient **après création et vérification du compte**, sans activer le back-office entre-temps.

## Parcours vérifié dans Next.js

En configuration actuelle `DATA_PROVIDER=local`, la connexion utilise toujours l'authentification SQLite de développement. Créer un compte Supabase ne bascule pas ce mécanisme.

En mode Supabase, le code déjà présent fait : `signInWithPassword` → recherche de son propre `admin_users.user_id` → refus et déconnexion si absence de ligne. Pour chaque nouvelle action privée, `requireAdmin()` appelle `auth.getUser()` puis relit cette appartenance. `requireManagementAdmin()` transmet l'UUID vérifié côté serveur à l'adaptateur. Les RPC privilégiées sont appelées avec service_role uniquement après cette garde.

Le proxy rafraîchit les cookies, sans remplacer l'autorisation des routes. Aucun `user_metadata.role`, email de formulaire ou `p_actor` fourni par le navigateur n'accorde de privilège. [Validation serveur `getUser`](https://supabase.com/docs/reference/javascript/auth-getuser).

Routes examinées : page `/admin/[[...section]]`, API admin `manage` GET/POST, `mutate`, `media`, `export`, `login`, `logout`. Toutes les opérations privées recensées ont une garde serveur ; login est évidemment accessible sans session mais vérifie l'identité et l'appartenance avant de réussir. Les routes publiques et tâches automatiques gardent leurs protections distinctes ; il ne s'agit pas d'actions administrateur ouvertes.

Points de vigilance conservés :

- Le client service_role contourne RLS. Les méthodes internes du repository qui acceptent un acteur font confiance à leur appelant serveur : ne jamais exposer directement cet argument.
- La route logout refuse aussi un compte dont le rôle admin vient d'être retiré. Le prochain accès privé est refusé, mais le nettoyage de ses cookies par cette route n'est alors plus utilisable. Aucune correction de ce comportement n'est incluse ici.
- Le formulaire existant ne gère ni une invitation avec callback, ni un reset du mot de passe, ni un challenge MFA. Prévoir la récupération du compte par le Dashboard avant la remise du compte.

## A — Avant la création, après validation de cette procédure

1. Ouvrir le Dashboard du projet exact `qnmpfswaeexpchietwzf` et relire les utilisateurs Auth, `public.admin_users` et les paramètres de réservation. Le dernier audit voyait zéro compte et zéro appartenance ; ne pas supposer que cet état est toujours identique.
2. Vérifier la contrainte singleton déployée : `singleton boolean NOT NULL DEFAULT true UNIQUE CHECK(singleton)` ainsi que la clé étrangère vers `auth.users(id)`. Elles existent dans le SQL local ; aucune nouvelle migration ne sera réappliquée. Si elles manquent à distance, arrêter et signaler l'écart.
3. Si une administratrice existe déjà, vérifier son identité et arrêter la création d'un doublon. Ne rien supprimer ou remplacer.
4. Confirmer que les réservations distantes sont fermées : `bookingEnabled` doit être absent ou false. Si true, arrêter et faire approuver séparément sa désactivation. Ne pas modifier les réglages SQLite de développement dans cette préparation.

## B — Création dans le Dashboard

L'utilisateur choisira et saisira l'adresse réelle dans **Authentication → Users → Add user / Create user**. Ne pas inscrire le mot de passe dans le chat, le dépôt ou une commande ; le saisir par un canal sûr. Aucun email ou UUID ne sera inventé par le script.

- Utiliser la création administrative et non l'inscription publique.
- Vérifier l'adresse et la propriété du compte avant toute confirmation manuelle de l'email. Garder le fournisseur email/mot de passe actif.
- Ne pas envoyer d'invitation ou de réinitialisation sans autorisation d'envoi ; le formulaire Next.js actuel n'offre pas le parcours callback requis.
- Copier le **véritable UUID Auth** du compte créé, contrôler l'adresse affichée et son état confirmé. Un compte anonyme ou banni ne convient pas.
- Ne pas créer de compte ordinaire sur le projet pour tester les refus : utiliser les fixtures isolées.

La création Auth et le rattachement SQL sont deux opérations distinctes. Si le rattachement échoue, le compte reste sans droit métier ; ne pas le supprimer automatiquement.

## C — Association SQL à relire, non exécutée

Le bloc suivant est un **brouillon de contrôle avec ROLLBACK obligatoire par défaut**. Remplacer les deux marqueurs uniquement par les informations du Dashboard, après validation. Aucune clé ni mot de passe n'est nécessaire dans ce SQL. Pour un rattachement durable approuvé, la dernière instruction devra être changée explicitement en COMMIT ; ne pas exécuter une portion du bloc isolément.

```sql
begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';
select set_config('monea.review_admin_uuid', 'UUID_AUTH_VERIFIE', true);
select set_config('monea.review_admin_email', 'EMAIL_CHOISI_DANS_DASHBOARD', true);

lock table public.admin_users in exclusive mode;
do $review$
declare
  v_id uuid := current_setting('monea.review_admin_uuid')::uuid;
  v_email text := current_setting('monea.review_admin_email');
begin
  if not exists (
    select 1 from auth.users
    where id = v_id and lower(email) = lower(v_email)
      and email_confirmed_at is not null
      and not coalesce(is_anonymous, false)
      and (banned_until is null or banned_until <= now())
  ) then
    raise exception 'Compte Auth non vérifié ou identité incompatible';
  end if;
  if not exists (select 1 from public.site_settings where id = 1)
     or exists (
       select 1 from public.site_settings
       where id = 1 and coalesce((value->>'bookingEnabled')::boolean, false)
     ) then
    raise exception 'Vérifier la fermeture des réservations avant rattachement';
  end if;
  if exists (select 1 from public.admin_users where user_id <> v_id) then
    raise exception 'Une autre administratrice existe déjà';
  end if;
  if not exists (select 1 from public.admin_users where user_id = v_id) then
    insert into public.admin_users(user_id) values (v_id);
  end if;
  if (select count(*) from public.admin_users) <> 1 then
    raise exception 'Une seule appartenance attendue';
  end if;
end
$review$;

select count(*) = 1 as une_seule_administratrice,
       bool_and(user_id = current_setting('monea.review_admin_uuid')::uuid)
         as uuid_attendu
from public.admin_users;
rollback; -- Par défaut : aucune association durable.
```

Ne pas utiliser d'UPSERT remplaçant une identité. Le verrou et la contrainte singleton protègent des rattachements concurrents. Ce SQL opère avec un accès SQL administrateur de maintenance ; il n'est ni une migration ni une route publique à ajouter au site.

## D — Fermeture des inscriptions après vérification

Après création, contrôle du compte et rattachement approuvé : désactiver **Allow new users to sign up**, ce qui doit donner `disable_signup=true`, tout en gardant le fournisseur email/mot de passe actif. Vérifier aussi l'état des inscriptions anonymes et des autres fournisseurs ; tout changement complémentaire doit être explicitement approuvé. Les comptes existants conservent la possibilité de se connecter. [Configuration Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration).

La fermeture n'efface pas un éventuel compte ordinaire créé pendant l'intervalle. Relire la liste des comptes ; aucun de ces comptes ne doit recevoir d'appartenance admin. Signaler les comptes inattendus sans les supprimer automatiquement. Vérifier la configuration effective en lecture seule ; ne pas appeler signUp sur MONÉA pour tester sa fermeture, car une configuration erronée créerait justement un compte durable.

## E — Recette contrôlée de management_snapshot

### Déjà testable sans opération distante

- Auth absent, Auth invalide, compte ordinaire avec metadata admin : gardes serveur et routes privées refusées.
- Administratrice simulée : login accepté, snapshot demandé avec l'UUID issu de `getUser`, paramètre `p_actor` navigateur ignoré.
- Retrait d'appartenance ou erreur de lecture : refus à la requête suivante.
- Sur PGlite : snapshot réel avec acteur membre, sections, pagination, filtres et données renvoyées ; droits anon/authenticated/service_role et absence d'auto-promotion.
- Stripe/mock avec Supabase : aucun appel fournisseur et aucun traitement financier de webhook.

Auth est simulé dans ces tests ; PostgreSQL/PGlite exécutent les fonctions sur des bases isolées. Ils ne constituent pas une connexion réelle de la future gérante à Supabase Auth.

Résultats de cette préparation : **77 tests réussis dans 5 fichiers** (`supabase-admin-auth`, `backend-rpc-migration`, `database`, `supabase-repository`, `payment-provider`). TypeScript et ESLint réussis. Le nouveau fichier d'authentification exécute les véritables gardes Next.js avec les clients Auth substitués ; aucune connexion hébergée n'est effectuée. Le SQL de rattachement ci-dessus n'a pas été exécuté. Le build n'a pas été relancé : aucun code applicatif n'est modifié.

### Après création et validation explicites

Pour vérifier la RPC réellement déployée sans effet métier durable : une connexion SQL dédiée, `BEGIN`, `SET LOCAL ROLE service_role`, sélectionner l'UUID de l'unique appartenance déjà contrôlée, puis appeler `management_snapshot(UUID, '{"section":"lookup","page":0,"search":""}'::jsonb)` et les autres rubriques utiles. Vérifier provider `supabase`, tableaux attendus, pagination et cohérence avec les comptes réels. Ne sortir que des clés et comptes, aucune donnée cliente. Aucun catalogue ne sera importé pour enrichir le résultat : des tableaux vides restent attendus si les tables sont vides.

Terminer systématiquement par **ROLLBACK**, y compris en cas d'erreur, puis relire les états métier depuis une nouvelle transaction. La RPC peut expirer des réservations : un appel HTTP POST ordinaire ne garantit pas l'absence d'écriture durable ; un GET serait bloqué par READ ONLY. Ce test SQL ne prouve pas à lui seul l'authentification navigateur.

Pour une vraie session Next.js, faire approuver un processus de recette distinct sur un autre port, `DATA_PROVIDER=supabase`, `PAYMENT_PROVIDER=mock`, sans modifier `.env.local` ni l'instance SQLite. La protection Stripe corrigée bloque les appels fournisseurs. Les réservations doivent rester fermées ; ne lancer ni mutations métier, ni export CSV (il écrit un audit), ni traitement d'outbox. Une connexion Auth et le rate limit laissent des traces persistantes : cette recette nécessite une validation distincte de ces écritures techniques. Ne pas la présenter comme une recette distante totalement sans écriture.

## Périmètre demandé à la validation

Autoriser seulement : création administrative d'un compte avec l'adresse choisie dans le Dashboard, association de son UUID réel à l'unique ligne `admin_users`, fermeture des inscriptions après contrôle, lectures de vérification. Aucun import, changement des réservations, activation de Stripe, modification de `.env.local`, basculement de l'instance courante ou déploiement.

La recette distante SQL avec rollback et la recette de session Next.js seront annoncées séparément avec leurs effets exacts. Le compte distant n'existe pas encore à l'issue de cette préparation ; son snapshot authentifié distant reste donc à vérifier après validation.
