# Configurer Supabase et déployer sur Vercel

Ces étapes se font **dans des tableaux de bord en ligne** : Claude ne peut pas les faire à votre place
et ne doit jamais recevoir vos mots de passe ou clés secrètes. Elles fonctionnent depuis un ordinateur
(plus confortable) ou un téléphone.

> Les offres et limites changent souvent : vérifiez-les sur supabase.com/pricing et vercel.com/pricing.
> À la date de rédaction, les offres gratuites suffisent pour un prototype, avec des limites
> (projet Supabase gratuit mis en pause après une période d'inactivité, nombre d'e-mails limité,
> offre Vercel « Hobby » réservée à un usage non commercial).

---

## Partie A — Supabase (base de données + comptes)

### A1. Créer le projet
1. Allez sur https://supabase.com et créez un compte (vous pouvez utiliser « Continue with GitHub »).
2. **New project** → nom : `likelemba` → choisissez un mot de passe de base de données **fort**
   et rangez-le dans un gestionnaire de mots de passe (ne le donnez à personne, pas même à Claude).
3. Région : la plus proche de vos utilisateurs parmi celles proposées.
4. Laissez la **Data API** activée (l'application en a besoin) : elle n'expose que le schéma `public`,
   protégé par RLS.

> Utilisez un projet **neuf et vide**. Si le projet contient déjà des tables (par exemple une table
> `profiles` créée pour un autre essai), les migrations s'arrêteront avec une erreur
> « already exists » sans rien casser : prévenez Claude avant de continuer.

### A2. Appliquer les migrations (créer les tables et la sécurité)
Méthode simple, sans rien installer (fonctionne sur téléphone) :
1. Dans Supabase : **SQL Editor** → **New query** (sur téléphone, le menu est derrière l'icône ☰).
2. Dans un autre onglet du navigateur, ouvrez le fichier
   `supabase/migrations/20261028000100_core_schema.sql` sur GitHub, puis le bouton **Raw**
   (texte brut, plus facile à copier). Appui long → **Tout sélectionner** → **Copier**.
3. Revenez dans Supabase, collez dans l'éditeur, appuyez sur **Run**. Vous devez voir « Success. No rows returned ».
4. Recommencez **dans l'ordre**, avec une **nouvelle requête vide** à chaque fois, pour
   `20261028000200_business_rules.sql` puis `20261028000300_rls_policies.sql`.

En cas d'erreur, ne relancez pas le même fichier : copiez le message d'erreur (il ne contient aucun secret)
et envoyez-le à Claude.

Méthode avec la ligne de commande (ordinateur) :
```bash
npx supabase login
npx supabase link --project-ref VOTRE_REF_PROJET   # la « ref » est dans l'URL du projet
npx supabase db push                               # applique les migrations manquantes
```

### A2 (variante téléphone recommandée). Installer avec une seule commande
Si copier un long fichier ne fonctionne pas sur votre téléphone, utilisez la commande courte
`supabase/manual/installer_depuis_github.sql` (à copier depuis GitHub ou depuis Claude) :
- elle active l'extension `http` de Supabase et télécharge les migrations depuis GitHub,
  à une adresse figée sur un commit précis ;
- elle vérifie l'empreinte (md5) de chaque fichier avant toute exécution ;
- elle refuse de s'exécuter si le projet n'est pas vide : elle ne peut rien abîmer.

C'est la méthode utilisée avec succès pour le premier projet (29 octobre 2026).

### A2 bis. Vérifier l'installation (lecture seule)
Nouvelle requête dans **SQL Editor**, collez le contenu de `supabase/checks/verifier_installation.sql`
(bouton **Raw** sur GitHub), puis **Run**. Ce script ne modifie rien.
Toutes les lignes doivent afficher ✅ dans la colonne `ok`. Sinon, envoyez une capture du tableau à Claude.

### A3. Régler l'authentification
Dans **Authentication → Sign In / Providers → Email** :
- « Confirm email » : **activé**.
- Longueur minimale du mot de passe : **8**.

Dans **Authentication → URL Configuration** :
- **Site URL** : l'adresse de production, par exemple `https://likelemba.vercel.app`
  (en attendant Vercel : `http://localhost:3000`).
- **Redirect URLs** : ajoutez
  - `http://localhost:3000/**`
  - `https://likelemba.vercel.app/**` (votre adresse de production)
  - `https://*-VOTRE-COMPTE-VERCEL.vercel.app/**` (adresses de prévisualisation)

### A4. Modèles d'e-mails (important pour les téléphones)
Pour que le lien fonctionne même s'il est ouvert sur un autre appareil que celui de l'inscription,
dans **Authentication → Emails → Templates** :

- **Confirm signup** : remplacez le lien par
  ```html
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&suite=/tableau-de-bord">Confirmer mon adresse</a>
  ```
- **Reset password** :
  ```html
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&suite=/nouveau-mot-de-passe">Choisir un nouveau mot de passe</a>
  ```
Vous pouvez traduire le reste du texte en français.

> Le serveur d'e-mails intégré à Supabase est limité et réservé aux tests. Avant l'ouverture au public,
> configurez un SMTP (Authentication → Emails → SMTP Settings) avec un service d'envoi d'e-mails.

### A5. Récupérer les clés publiques
**Project Settings → API Keys** (et **Data API** pour l'URL) :
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- clé **publishable** (`sb_publishable_…`), ou l'ancienne clé `anon` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

⚠️ Ne copiez **jamais** la clé `secret` / `service_role` dans l'application : elle n'est pas nécessaire.

### A6. Vous désigner administrateur (après votre première inscription)
Dans **SQL Editor**, en remplaçant l'adresse :
```sql
insert into public.platform_admins (user_id, note)
select id, 'Propriétaire de la plateforme' from auth.users where email = 'votre-adresse@exemple.com';
```
C'est la **seule** façon de devenir administrateur : aucun utilisateur ne peut se l'attribuer depuis le site.

---

## Partie B — Vercel (mise en ligne)

### B1. Importer le dépôt
1. https://vercel.com → **Sign up with GitHub**.
2. **Add New… → Project** → choisissez le dépôt `likelemba-` → **Import**.
3. Framework : **Next.js** (détecté automatiquement). Build command : `npm run build` (par défaut).

### B2. Variables d'environnement
Dans **Settings → Environment Variables** :

| Nom | Valeur | Environnements |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé publishable | Production, Preview, Development |
| `NEXT_PUBLIC_SITE_URL` | `https://likelemba.vercel.app` (votre adresse) | **Production uniquement** |
| `PAYMENTS_MODE` | `simulation` | Production, Preview |

Les prévisualisations utilisent automatiquement leur propre adresse (`VERCEL_URL`).
Après toute modification de variable : **Deployments → … → Redeploy**.

### B3. Vérifier le déploiement
1. Ouvrez l'adresse fournie par Vercel.
2. Créez un compte, ouvrez l'e-mail de confirmation, connectez-vous, modifiez votre profil, déconnectez-vous.
3. Testez « Mot de passe oublié ».
4. Si quelque chose échoue : **Deployments → (le déploiement) → Logs**, et vérifiez les variables et les
   Redirect URLs de Supabase.

Ne considérez le site « en ligne » qu'après ces vérifications.

### B4. Domaine personnalisé (facultatif, payant)
**Settings → Domains** dans Vercel, puis mettez à jour la Site URL et les Redirect URLs de Supabase
ainsi que `NEXT_PUBLIC_SITE_URL`.

---

## Erreurs fréquentes

| Symptôme | Cause probable |
|---|---|
| « Configuration Supabase manquante » sur le site | Variables absentes sur Vercel ou déploiement non relancé |
| Le lien de l'e-mail renvoie « lien invalide ou expiré » | Redirect URL manquante dans Supabase, lien déjà utilisé, ou modèle d'e-mail non modifié (étape A4) |
| « permission denied » dans les journaux | Migration 3 (RLS) non appliquée ou appliquée dans le désordre |
| Le build Vercel échoue | Lancer `npm run build` en local pour voir l'erreur, ou demander à Claude Code d'analyser les logs |
