# Checklist avant toute mise en production

Cette livraison est locale. Aucun dépôt Git distant, commit, paiement réel, message externe, ordonnanceur distant ou déploiement n’a été créé.

## Bloquants métier

- [ ] Identité commerciale définitive, logo, droits des images et visuel réel de remplacement.
- [ ] Raison sociale, forme/statut, immatriculation/SIRET, responsable de publication, adresse, contact, hébergeur et médiateur réels.
- [ ] Horaires, pauses, jours fériés, congés, adresse d’accueil et éventuelles modalités à domicile validés.
- [ ] Tarifs TTC et durées confirmés ; politique d’annulation, remboursement, absence et retard validée et communiquée avant paiement.
- [ ] Savoir-faire, sécurité et assurance vérifiés pour les services A.
- [ ] Preuves de qualification pour chaque service B avant attestation et activation ; procédé spray tan vérifié séparément.
- [ ] UV et luminothérapie maintenus à l’étude : une simple qualification esthétique ne doit jamais les activer.
- [ ] Cartes cadeaux maintenues sans achat tant que leurs modalités ne sont pas arrêtées.

## Données et sécurité

- [ ] Projet Supabase de recette, migrations et seed testés via `supabase db reset --local` ou base de test dédiée.
- [ ] Un seul compte Auth et un seul UUID dans `admin_users` ; inscriptions et accès anonymes Auth désactivés ; mot de passe fort, MFA à envisager.
- [ ] Vérification réelle SSR login/refresh/logout, autre utilisateur refusé, RLS et RPC testées sur la pile Supabase/PostgREST cible.
- [ ] Secrets serveur distincts, variables publiques limitées à URL/clé publique ; aucune clé service_role dans le bundle navigateur.
- [ ] Sauvegardes et restauration testées ; durées RGPD validées, responsables/sous-traitants et transferts documentés ; procédure de demandes et purge des contacts/sauvegardes définie.
- [ ] Politique de confidentialité et mentions légales revues ; activer leurs validations dans Paramètres seulement ensuite.
- [ ] Reverse proxy fiable : `x-real-ip` réécrit, origine inaccessible directement, HTTPS, tailles des corps limitées ; tester les quotas avec plusieurs IP.
- [ ] Masquage des query strings privées dans les journaux d’accès, rétention des logs, monitoring des erreurs/outbox/réconciliation.

## Paiements et notifications

- [ ] Clés **Stripe test**, URL exacte, webhook signé et événements souscrits ; vérifier succès, refus carte, abandon, expiration, double clic, deux clientes simultanées, remboursement et webhook tardif sur environnement de recette.
- [ ] Test Stripe CLI avec un vrai Checkout de test créé par l’application ; une commande `stripe trigger` isolée n’associe pas forcément un booking local.
- [ ] Frais, fiscalité/prix TTC, compte Stripe et conditions de vente validés avec le propriétaire.
- [ ] Pour le lancement uniquement, après validation propriétaire : clés live et secret du webhook live, `NODE_ENV=production` et `ALLOW_LIVE_PAYMENTS=true`. Ne pas activer pendant la recette locale.
- [ ] Numéro public WhatsApp réel ; Cloud API, destinataire autorisé, template utility approuvé à quatre paramètres, langue et version Graph API vérifiées.
- [ ] Domaine expéditeur Resend vérifié et destinataire admin réel ; vérifier les emails de confirmation et contact avec autorisation explicite d’envoi.
- [ ] `ENABLE_EXTERNAL_NOTIFICATIONS=true` uniquement après validation des destinataires. Tester retries, timeout ambigu, erreurs et reprise sans doublon.
- [ ] Programmer l’appel sécurisé à `/api/cron` chaque minute ; superviser les HTTP 500 Stripe, jobs `uncertain`, `failed`, `unconfigured`, paiements `reconciliation` et remboursements `refund_pending`.
- [ ] Procédure manuelle de réconciliation des sessions Checkout orphelines et des remboursements échoués (vérification Stripe, trace d’audit, correction contrôlée).

## Publication (à faire par le propriétaire)

- [ ] `npm ci`, lint, TypeScript, tests, Playwright et build sur la machine cible ; audit dépendances.
- [ ] Recette du back-office connecté et du tunnel Checkout test complet, navigation clavier et appareils réels.
- [ ] Remplacer les contenus de démonstration, valider contraste après toute modification de palette.
- [ ] Domaine réel et `NEXT_PUBLIC_APP_URL`, SEO local exact, métadonnées et sitemap ; retirer le `noindex` et `robots disallow /` seulement après validation de l’ouverture publique.
- [ ] Aucune donnée structurée d’établissement avant adresse/activité attestées ; aucun analytics non essentiel activé sans cadre de consentement.
- [ ] Créer le dépôt GitHub et déployer selon le processus du propriétaire. Aucune action de ce type n’est incluse dans cette réalisation.
