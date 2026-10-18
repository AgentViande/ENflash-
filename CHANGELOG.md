# Journal des modifications (CHANGELOG) - ENflash

## [v1.1.0] - 2026-10-18

### 🚀 Nouveautés & ✨ Améliorations
- **Moteur vocal neuronal local Kokoro-82M (Qualité naturelle moderne)** :
  - Intégration du modèle Kokoro-82M (quantifié en INT8 q8, ~88 Mo) via `kokoro-js` et ONNX Runtime, remplaçant la voix robotique du narrateur Windows (SAPI).
  - Inférence 100 % hors du thread d'interface via un Worker thread Node.js dédié (`src/main/audio/kokoroWorker.ts`) pour ne jamais figer les animations ni l'interface.
  - Modèle embarqué directement dans l'installeur Windows pour un fonctionnement autonome et 100 % hors ligne dès le premier lancement.
- **Sélection de voix naturelles expressives** :
  - **Voix américaines (US)** : `af_heart` (voix féminine de référence par défaut, grade A), `af_bella`, `af_nicole`, `am_michael` (masculin naturel) et `am_adam`.
  - **Voix britanniques (UK)** : `bf_emma` (voix féminine britannique par défaut, grade B-), `bf_isabella`, `bm_george` (masculin) et `bm_lewis`.
- **Banc d'essai comparatif dans les Paramètres** :
  - Nouveau bouton *"Lancer le test comparatif"* pour écouter la même phrase successivement avec Kokoro puis avec la voix système Windows pour entendre immédiatement le saut qualitatif.
- **Transparence et robustesse de la cascade** :
  - Affichage clair du statut dans Paramètres > Voix (*Voix naturelle Kokoro ✅* ou *Voix de secours ⚠️*), gestion de l'espace disque du cache et bouton *Réparer / réinstaller la voix*.
  - Badge discret `⚠️ Secours` sur les boutons audio des flashcards et de l'évaluation lorsque la voix système de secours est sollicitée.
  - Normalisation automatique du volume des audios WAV générés à -0,5 dB.
  - Journalisation en console de chaque lecture pour faciliter le diagnostic.

## [v1.0.4] - 2026-10-18

### 🚀 Nouveautés & ✨ Améliorations
- **Architecture audio de prononciation en cascade (4 niveaux)** :
  1. *Cache local disque* : rejeu instantané des fichiers audio déjà générés ou téléchargés sans latence ni consommation réseau.
  2. *Voix neuronale hors ligne locale (Piper TTS)* : intégration de 4 modèles de voix de haute qualité (US Lessac féminin, US Ryan masculin, UK Alba féminin, UK Alan masculin) téléchargeables à la demande depuis les Paramètres pour garder l'installateur léger.
  3. *Enregistrements humains réels* : interrogation automatique de l'API gratuite Free Dictionary API pour les mots isolés (accent UK et US) avec mise en cache locale.
  4. *Voix système naturelle en dernier recours* : sélection intelligente de la meilleure voix anglaise installée (filtre exclusif sur les voix "Natural", "Neural", "Premium", interdisant toute voix non anglaise).
- **Contrôles audio enrichis sur les cartes** :
  - Bouton d'écoute audio sur chaque flashcard, dans les tests et dans l'évaluation hebdomadaire (révélé après validation de la réponse).
  - Bouton dédié pour écouter la **phrase d'exemple** en contexte.
  - Mode **ralenti (0.7x)** activable d'un clic sur la carte pour décomposer l'élocution.
  - Raccourci clavier <kbd>P</kbd> pour réécouter instantanément la prononciation.
  - Option de lecture automatique à l'affichage des faces en anglais.
  - Préchargement transparent en tâche de fond des audios des cartes du jour.
- **Badges de niveau évolutifs (8 paliers vectoriels)** :
  - Paliers Débutant (1-4), Bronze (5-9), Argent (10-14), Or (15-19), Platine (20-29), Diamant (30-39), Maître (40-49) et Légende (50+).
  - Designs SVG originaux avec palette, ornements, auras et reflets dédiés.
  - Système de sous-progression de 1 à 4 étoiles au sein de chaque rang.
  - Intégration dans le header compact, grande carte de niveau sur l'accueil, et **Galerie des 8 rangs** sur la page Progression avec silhouettes pour les rangs verrouillés.
  - Modale de félicitations au passage de niveau avec confettis et animation spéciale d'évolution de rang (morphing).
- **Paramètres & Transparence des licences** :
  - Tableau de bord des voix avec prévisualisation, jauges de progression de téléchargement et gestion de l'espace disque du cache.
  - Section *Crédits et licences libres* (Piper MIT, Rhasspy ODbL/Public Domain, Free Dictionary API CC-BY-SA, Web Audio procédurale).

## [v1.0.3] - 2026-10-18

### 🚀 Nouveautés & ✨ Améliorations
- **Mode Entraînement Libre** : possibilité de rejouer le test quotidien le même jour avec exactement les mêmes cartes, sans attribution d'XP, sans impact sur le streak et sans déplacement des boîtes Leitner pour éviter les montées artificielles.
- **Compte à rebours minuit Paris** : affichage sur l'accueil de l'état du jour (`Test du jour : à faire` ou `Test du jour : fait ✅`) avec compte à rebours dynamique jusqu'à 00h00 heure de Paris.
- **Rafraîchissement automatique à minuit** : mise à jour instantanée de l'état du jour à 00h00 et détection automatique au retour de veille ou au focus de la fenêtre.

### 🐛 Corrections
- **Attribution d'XP du test quotidien** : correction de la boucle d'XP infinie ; l'XP, les badges et la validation sont désormais attribués strictement une seule fois par jour calendaire dans le fuseau `Europe/Paris`.
- **Calcul du streak par jour calendaire** : suppression du délai glissant de 24 h. Le streak augmente de 1 dès le passage à 00h00 heure de Paris (ex: validation à 23h59 puis à 00h01, ou à 08h00 puis le lendemain à 07h00).
- **Protection anti-triche** : détection et neutralisation des reculs anormaux de l'horloge système sans gain de récompense indue.
- **Évaluation hebdomadaire** : limitation de l'attribution d'XP à une seule fois par semaine calendaire (lundi 00h00 heure de Paris).

Toutes les modifications notables apportées au projet ENflash sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et respecte la norme [Semantic Versioning](https://semver.org/lang/fr/).

---

## [v1.0.2] - 2026-10-18

### 🐛 Corrections
- **Saisie de mots et formulaires** : correction complète des champs de texte non cliquables dans la modale d'ajout rapide et les modales de modification. Rétablissement du focus souris/clavier, réactivation de la sélection de texte et suppression des interférences de transformation CSS sur les fenêtres surgissantes.

---

## [v1.0.1] - 2026-10-18

### 🐛 Corrections
- Résolution du problème d'écran bleu au démarrage : correction du chemin d'accès absolu vers `dist/index.html` dans le conteneur asar de production.

---

## [v1.0.0] - 2026-10-17

### 🚀 Nouveautés
- **Gestion complète du vocabulaire** : ajout, modification, suppression, recherche instantanée et filtres par statut, tag et playlist.
- **Ajout rapide en chaîne** : modal ultra accessible avec raccourci `Ctrl+N` et enchaînement clavier avec `Entrée`.
- **Détection temps réel des doublons** : avertissement préventif lors de l'ajout d'un mot déjà existant.
- **Flashcards 3D avec répétition espacée Leitner (5 boîtes)** : intervalles optimisés (1j, 2j, 4j, 7j, 14j).
- **Inversion globale FR ⇄ EN** : bouton unique pour basculer le sens d'apprentissage mémorisé entre les sessions.
- **Synthèse vocale intégrée** : écoute de la prononciation avec accent américain (US) ou britannique (UK).
- **Raccourcis clavier complets** : `Espace` (retourner), `Flèche droite` (maîtrisé), `Flèche gauche` (pas encore), `I` (inverser sens).
- **Playlists thématiques et automatiques** : création de playlists manuelles + playlists intelligentes ("Mots difficiles", "Nouveaux mots").
- **Test quotidien de 20 flashcards** : tirage aléatoire pondéré selon la boîte Leitner et le retard de révision, mis en valeur sur l'écran d'accueil.
- **Évaluation hebdomadaire écrite** : saisie au clavier avec correction intelligente (distance de Levenshtein, tolérance aux fautes de frappe), estimation du niveau CECRL (A1 à C1) et comparatif d'évolution.
- **Système de Streak & Jokers de gel** : flamme animée, protection automatique du streak grâce aux jokers gagnés tous les 7 jours consécutifs.
- **Gamification complète** : niveaux de joueur, barre d'XP, galerie de badges débloquables, sons rétro Web Audio et confettis de célébration.
- **Mascotte originale Flashy ⚡** : compagnon vectoriel SVG aux expressions dynamiques.
- **Tableau de bord de progression** : heatmap d'activité 30 jours (style GitHub/Duolingo), camembert Leitner et statistiques détaillées.
- **Import / Export de données** : sauvegarde intégrale JSON et import/export CSV de mots avec préservation des tags.
- **Mises à jour automatiques** : intégration electron-updater avec GitHub Releases, écran des nouveautés et vérification en 1 clic.
