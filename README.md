# ENflash ⚡

Application de bureau d'apprentissage du vocabulaire anglais par flashcards et répétition espacée, conçue avec **Electron, React, TypeScript et Vite**.

---

## 🌟 Présentation

**ENflash** transforme l'apprentissage du vocabulaire anglais en une expérience ludique, stimulante et durable grâce à :
- 🧠 **La répétition espacée (SRS Leitner à 5 boîtes)** : révision optimisée au moment exact où la mémoire commence à flancher.
- ⚡ **Des flashcards 3D interactives** avec inversion de sens immédiate (FR ⇄ EN) et synthèse vocale (accents US / UK).
- 🎯 **Un test quotidien de 20 mots pondérés** pour ancrer la régularité et alimenter votre série de jours (Streak).
- 📝 **Une évaluation hebdomadaire écrite** avec correction intelligente (distance de Levenshtein, tolérance aux fautes de frappe) et estimation de votre niveau CECRL (A1 à C1).
- 🛡️ **Un système de Streak protégé par des Jokers de gel** : gagnez un joker tous les 7 jours de streak pour sécuriser votre série en cas d'imprévu.
- 🎮 **Une gamification enrichissante** : points d'expérience (XP), niveaux de joueur, badges à collectionner, effets sonores immersifs et mascotte originale **Flashy ⚡**.
- 🔒 **Stockage 100 % local hors ligne sécurisé** : vos données résident dans le dossier `userData` de votre machine avec écritures atomiques et migrations automatiques sans aucune perte lors des mises à jour.
- 🔄 **Mises à jour automatiques transparentes** : synchronisées directement avec les GitHub Releases via `electron-updater`.

---

## 🛠️ Stack Technique

- **Moteur Desktop** : Electron 33+
- **Frontend** : React 18+, TypeScript 5+, Vite 6+
- **Packaging** : electron-builder (Cible principale Windows NSIS `.exe`, compatible macOS / Linux)
- **Persistance** : Fichier JSON versionné avec écritures atomiques (fichiers temporaires + renommage) et moteur de migration séquentiel
- **Mises à jour** : electron-updater + GitHub Actions CI/CD
- **Audio & Prononciation** : Web Audio API (synthèse des effets sonores autonome sans fichiers audio externes) & Web Speech API (TTS)
- **Tests unitaires** : Vitest (couverture complète de la logique métier SRS Leitner, Levenshtein, Streak et tirage pondéré)

---

## 🚀 Installation & Développement

### Prérequis
- [Node.js](https://nodejs.org/) (version 20 ou supérieure recommandée)
- `npm` (version 10+)
- Git

### 1. Cloner le projet
```bash
git clone https://github.com/AgentViande/ENflash-.git
cd ENflash
```

### 2. Installer les dépendances
```bash
npm install
```
*(Sous Windows PowerShell, si une restriction de script survient, utilisez `npm.cmd install`)*

### 3. Lancer en mode développement
```bash
npm run dev
```
Cette commande lance le serveur Vite pour le renderer React ainsi que le processus Electron avec rechargement à chaud.

### 4. Lancer les tests unitaires
```bash
npm run test
```
Pour exécuter les tests en continu :
```bash
npm run test:watch
```

---

## 📦 Compilation & Packaging

### Compiler l'application pour Windows (.exe NSIS)
```bash
npm run build:win
```
L'installeur Windows autonome sera généré dans le dossier :
`release/1.0.0/ENflash-Setup-1.0.0.exe` ainsi que les fichiers nécessaires à l'auto-update (`latest.yml`, `.blockmap`).

---

## 🚢 Système de Publication & Mise à Jour Automatique

Le dépôt GitHub officiel est : **[https://github.com/AgentViande/ENflash-.git](https://github.com/AgentViande/ENflash-.git)**

### Fonctionnement côté application
1. Au lancement (ou en cliquant sur "Vérifier les mises à jour" dans les Paramètres), ENflash interroge les GitHub Releases.
2. Si une nouvelle version est disponible, une fenêtre présente les notes de version (patch notes rédigés en français) et propose de télécharger la mise à jour.
3. Le téléchargement affiche une barre de progression en direct.
4. Une fois téléchargé, l'utilisateur peut choisir d'installer immédiatement (redémarrage) ou au prochain lancement.
5. Au redémarrage consécutif à une mise à jour, l'écran "Nouveautés de la version X" récapitule les améliorations.

### Déclencher une publication (Workflow Antigravity "publier")
Pour publier une nouvelle version, donnez simplement l'ordre : **"publie"** ou **"publier"** dans Antigravity.

Le processus automatisé effectue les actions suivantes :
1. Vous demande le type d'incrément de version : `patch`, `minor` ou `major`.
2. Exécute tous les tests unitaires pour garantir la stabilité.
3. Incrémente le numéro de version dans `package.json`.
4. Rédige automatiquement le patch note en français classé en :
   - 🚀 Nouveautés
   - ✨ Améliorations
   - 🐛 Corrections
5. Met à jour `CHANGELOG.md`.
6. Crée le commit Git et le tag annoté `vX.Y.Z`.
7. Pousse la branche `main` et le tag sur GitHub.
8. **GitHub Actions** (`.github/workflows/release.yml`) s'active automatiquement dès la détection du tag `v*` pour compiler l'installeur Windows propre et publier la Release GitHub avec les fichiers nécessaires (`.exe`, `latest.yml`, `.blockmap`).

> [!NOTE]
> **Configuration requise sur GitHub (une seule fois)** :
> Dans les réglages de votre dépôt GitHub (`Settings > Actions > General > Workflow permissions`), assurez-vous que l'option **"Read and write permissions"** est cochée afin que GitHub Actions puisse créer la Release et y déposer les binaires.
> **Aucun token personnel n'est requis dans le code**, GitHub Actions utilise automatiquement le secret sécurisé par défaut `GITHUB_TOKEN`.

---

## ⌨️ Raccourcis Clavier

| Raccourci | Action |
| :--- | :--- |
| <kbd>Espace</kbd> | Retourner la flashcard active (recto / verso) |
| <kbd>→</kbd> (Flèche droite) | Valider la flashcard ("Je maîtrise", avance en boîte supérieure) |
| <kbd>←</kbd> (Flèche gauche) | Répéter la flashcard ("Je ne maîtrise pas encore", retour boîte 1) |
| <kbd>I</kbd> | Inverser le sens de toutes les cartes (FR ⇄ EN) |
| <kbd>Ctrl + N</kbd> | Ouvrir l'ajout rapide de mot depuis n'importe quel écran |
| <kbd>Entrée</kbd> | Valider le formulaire ou enregistrer et enchaîner le mot suivant |
| <kbd>?</kbd> | Ouvrir la fenêtre d'aide mémoire des raccourcis |
| <kbd>Échap</kbd> | Fermer les fenêtres modales |

---

## 📄 Licence

Ce projet est sous licence MIT - Développé avec passion pour l'apprentissage du vocabulaire anglais.
