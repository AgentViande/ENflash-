---
name: publier
description: Workflow automatisé de publication d'une nouvelle version d'ENflash (Semver, Changelog en français, Tag Git et GitHub Actions)
---

# Workflow de Publication ENflash ⚡

Ce workflow s'active UNIQUEMENT lorsque l'utilisateur donne l'ordre explicite : **"publie"** ou **"publier"**.

> [!IMPORTANT]
> **Règle absolue** : Ne jamais publier sans confirmation ou ordre explicite de l'utilisateur.

---

## Étapes d'exécution du workflow

### 1. Détermination de la version (SemVer)
- Demander à l'utilisateur quel type de montée de version appliquer si ce n'est pas précisé :
  - `patch` (corrections de bugs, ex: 1.0.0 ➔ 1.0.1)
  - `minor` (nouvelles fonctionnalités, ex: 1.0.0 ➔ 1.1.0)
  - `major` (changements majeurs/refonte, ex: 1.0.0 ➔ 2.0.0)

### 2. Exécution des tests unitaires
Vérifier impérativement que tous les tests passent avant toute publication :
```bash
npm.cmd test
```

### 3. Incrémentation et génération des patch notes
Exécuter le script dédié :
```bash
node scripts/publish.mjs <type>
```
Le script se charge automatiquement de :
- Mettre à jour `package.json`
- Analyser les commits récents
- Rédiger les notes de version en français dans `CHANGELOG.md` avec la structure :
  - 🚀 Nouveautés
  - ✨ Améliorations
  - 🐛 Corrections
- Créer le commit Git annoté : `chore(release): vX.Y.Z`
- Créer le tag Git : `vX.Y.Z`

### 4. Push vers GitHub
Pousser la branche principale et le tag vers le dépôt :
```bash
git push origin main && git push origin vX.Y.Z
```

### 5. Compilation et Release GitHub (Automatique)
Dès que le tag `vX.Y.Z` est poussé, le workflow GitHub Actions (`.github/workflows/release.yml`) prend le relais :
- Compilation sur environnement Windows propre (`windows-latest`)
- Génération de l'installeur NSIS `.exe`, de `latest.yml` et de `*.blockmap`
- Publication de la Release officielle sur GitHub avec les patch notes en français.
