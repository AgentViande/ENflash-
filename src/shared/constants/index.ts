import { AppSettings, BadgeDefinition, LeitnerBox } from '../types';

/**
 * Version actuelle du schéma de base de données
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Intervalles Leitner en jours selon la boîte (1 à 5)
 */
export const LEITNER_INTERVALS_DAYS: Record<LeitnerBox, number> = {
  1: 1,   // Boîte 1 : revue le lendemain
  2: 2,   // Boîte 2 : revue 2 jours après
  3: 4,   // Boîte 3 : revue 4 jours après
  4: 7,   // Boîte 4 : revue 1 semaine après
  5: 14,  // Boîte 5 : revue 2 semaines après (ancrage permanent)
};

/**
 * Paramètres initiaux par défaut
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  cardDirection: 'fr_to_en',
  voiceAccent: 'en-US',
  soundEffects: true,
  soundVolume: 0.6,
  dailyReminder: true,
  dailyReminderTime: '18:00',
  autoCheckUpdates: true,
  lastSeenVersion: '1.0.0',
};

/**
 * Définition de tous les badges du jeu
 */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_word',
    title: 'Premier pas',
    description: 'Ajouter votre premier mot de vocabulaire',
    icon: '🌱',
    category: 'words',
  },
  {
    id: 'words_10',
    title: 'Curieux',
    description: 'Ajouter 10 mots au dictionnaire',
    icon: '📖',
    category: 'words',
  },
  {
    id: 'words_50',
    title: 'Polyglotte en herbe',
    description: 'Atteindre 50 mots enregistrés',
    icon: '📚',
    category: 'words',
  },
  {
    id: 'words_100',
    title: 'Dictionnaire vivant',
    description: 'Atteindre 100 mots enregistrés',
    icon: '🎓',
    category: 'words',
  },
  {
    id: 'streak_3',
    title: 'Allumage',
    description: 'Maintenir un streak de 3 jours consécutifs',
    icon: '🕯️',
    category: 'streak',
  },
  {
    id: 'streak_7',
    title: 'Flamme ardente',
    description: 'Maintenir un streak de 7 jours consécutifs',
    icon: '🔥',
    category: 'streak',
  },
  {
    id: 'streak_30',
    title: 'Invincible',
    description: 'Maintenir un streak de 30 jours consécutifs',
    icon: '⚡',
    category: 'streak',
  },
  {
    id: 'first_mastered',
    title: 'Éclair de génie',
    description: 'Maîtriser complètement un premier mot (Boîte 5)',
    icon: '⭐',
    category: 'words',
  },
  {
    id: 'first_eval',
    title: 'Grand saut',
    description: 'Compléter votre première évaluation hebdomadaire',
    icon: '📝',
    category: 'evaluation',
  },
  {
    id: 'perfect_eval',
    title: 'Sans faute',
    description: 'Obtenir 100 % à une évaluation hebdomadaire',
    icon: '👑',
    category: 'evaluation',
  },
  {
    id: 'first_playlist',
    title: 'Organisateur',
    description: 'Créer votre première playlist personnalisée',
    icon: '🎵',
    category: 'special',
  },
  {
    id: 'level_5',
    title: 'Expert en devenir',
    description: 'Atteindre le niveau 5 de joueur',
    icon: '🏆',
    category: 'special',
  },
];

/**
 * Calcul du niveau d'après les XP accumulés
 * Formule progressive : Niveau N requiert N * 100 XP
 */
export function calculateLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number; progressPercent: number } {
  let level = 1;
  let remainingXp = Math.max(0, xp);

  while (true) {
    const xpNeededForNext = level * 120;
    if (remainingXp < xpNeededForNext) {
      const progressPercent = Math.min(100, Math.floor((remainingXp / xpNeededForNext) * 100));
      return {
        level,
        currentXp: remainingXp,
        nextLevelXp: xpNeededForNext,
        progressPercent,
      };
    }
    remainingXp -= xpNeededForNext;
    level += 1;
  }
}

/**
 * Titres honorifiques par niveau
 */
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Apprenti',
  2: 'Explorateur',
  3: 'Initié',
  4: 'Aventurier',
  5: 'Spécialiste',
  6: 'Érudit',
  7: 'Expert',
  8: 'Maître',
  9: 'Grand Sage',
  10: 'Légende ENflash',
};

export function getLevelTitle(level: number): string {
  if (level >= 10) return LEVEL_TITLES[10];
  return LEVEL_TITLES[level] || 'Apprenti';
}
