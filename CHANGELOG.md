# Journal des modifications (CHANGELOG) - ENflash ⚡

Toutes les modifications notables apportées au projet ENflash sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et respecte la norme [Semantic Versioning](https://semver.org/lang/fr/).

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
