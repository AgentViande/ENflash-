# Journal des modifications (CHANGELOG) - ENflash

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
