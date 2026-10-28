# Travailler depuis l'ordinateur et le téléphone

**Règle d'or : GitHub est la seule source de vérité.** Un fichier modifié sur votre ordinateur
n'existe pas sur votre téléphone (ni dans Claude Code en ligne) tant qu'il n'a pas été envoyé
sur GitHub (`git push`). Inversement, ce que Claude a fait en ligne doit être récupéré (`git pull`).

---

## Sur l'ordinateur (Windows, macOS ou Linux)

### Installation (une seule fois)
1. **Git** : https://git-scm.com/downloads
2. **Node.js 22 LTS** : https://nodejs.org (vérifiez ensuite dans un terminal : `node -v` → `v22…`)
3. **VS Code** : https://code.visualstudio.com, puis les extensions proposées par le projet
   (ESLint, Tailwind CSS, Claude Code).

### Récupérer le projet (une seule fois)
Dans un terminal (VS Code : menu *Terminal → New Terminal*) :
```bash
git clone https://github.com/lukojisimon00-spec/likelemba-.git
cd likelemba-
npm ci                       # installe exactement les dépendances prévues
cp .env.example .env.local   # Windows (PowerShell) : copy .env.example .env.local
```
Ouvrez `.env.local` et remplacez les valeurs par celles de votre projet Supabase (voir `DEPLOIEMENT.md`, étape A5).

### Travailler (à chaque fois)
```bash
git switch main
git pull                     # 1. récupérer les dernières modifications
npm ci                       #    (seulement si package-lock.json a changé)
npm run dev                  # 2. lancer le site : http://localhost:3000
# … modifications …
npm run check                # 3. vérifier : lint + types + tests
git add -A
git commit -m "Décrire la modification en une phrase"
git push                     # 4. envoyer sur GitHub (Vercel redéploie automatiquement)
```

---

## Sur le téléphone Android

Vous ne pouvez pas facilement lancer le projet sur le téléphone, mais vous pouvez :

1. **Faire travailler Claude Code en ligne** : application Claude ou https://claude.ai/code →
   choisissez le dépôt `likelemba-` → décrivez la tâche. Claude travaille dans un environnement
   en ligne, sur une **branche** dédiée, lance les tests et pousse le résultat sur GitHub.
2. **Relire et fusionner** avec l'application **GitHub** : ouvrez la *Pull request* créée,
   lisez le résumé, puis **Merge** quand tout est vert.
3. **Vérifier le site** : l'adresse de prévisualisation Vercel apparaît dans la Pull request.

Pour reprendre une session : rouvrez la même conversation Claude Code, ou démarrez-en une nouvelle
en disant « Lis CLAUDE.md et docs/PLAN.md, puis continue la phase X ».

---

## Éviter les conflits

1. **Un seul appareil à la fois** sur une même branche.
2. **Toujours `git pull` avant de commencer** et **`git push` en terminant**, même pour un petit changement.
3. Avant de passer du téléphone à l'ordinateur : fusionnez (ou au moins poussez) la branche de Claude,
   puis faites `git pull` sur l'ordinateur.
4. Si Git affiche un conflit, **ne forcez rien** (`--force`) : demandez à Claude Code de vous aider à le résoudre.
5. Ne modifiez jamais une migration déjà appliquée sur Supabase : créez-en une nouvelle.

---

## Sauvegarde et restauration

| Quoi | Où c'est sauvegardé | Comment restaurer |
|---|---|---|
| Code, migrations, documentation | GitHub (historique complet) | `git clone` sur n'importe quel appareil |
| Fichier `.env.local` (vos valeurs) | **Pas sur GitHub.** Notez les valeurs dans un gestionnaire de mots de passe | Recréer depuis `.env.example` + valeurs du tableau de bord Supabase |
| Données de la base | Supabase (sauvegardes automatiques selon l'offre ; limitées en gratuit) | Tableau de bord Supabase → Database → Backups |
| Export manuel de la base | Fichier sur votre ordinateur | Voir ci-dessous |

Export manuel recommandé avant chaque changement important de la base (ordinateur, nécessite Docker Desktop installé et lancé) :
```bash
npx supabase login
npx supabase link --project-ref VOTRE_REF_PROJET
npx supabase db dump --data-only -f sauvegarde-$(date +%Y%m%d).sql
```
Gardez ce fichier **hors de GitHub** (il contient des données personnelles).
La restauration d'une base de production est une opération sensible : faites-la avec l'aide de Claude,
sur un projet de test d'abord.
