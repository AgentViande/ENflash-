import { AppDatabase, Word, Playlist } from '../../shared/types';
import { CURRENT_SCHEMA_VERSION, DEFAULT_APP_SETTINGS } from '../../shared/constants';
import { getTodayDateString } from '../../shared/srs/leitner';

const today = getTodayDateString();

// Échantillon de mots initiaux pour une prise en main immédiate et agréable
export const INITIAL_WORDS: Word[] = [
  {
    id: 'w-init-1',
    french: 'bonjour',
    english: 'hello',
    example: 'Hello, how are you today?',
    tags: ['Salutations', 'Quotidien'],
    note: 'Formule standard',
    leitnerBox: 1,
    nextReviewDate: today,
    lastReviewedAt: null,
    reviewHistory: [],
    totalReviews: 0,
    successCount: 0,
    failureCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'w-init-2',
    french: 'merci',
    english: 'thank you',
    example: 'Thank you very much for your help.',
    tags: ['Politesse', 'Quotidien'],
    note: 'Ou "thanks" de manière informelle',
    leitnerBox: 1,
    nextReviewDate: today,
    lastReviewedAt: null,
    reviewHistory: [],
    totalReviews: 0,
    successCount: 0,
    failureCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'w-init-3',
    french: 'comprendre',
    english: 'to understand',
    example: 'I understand what you mean.',
    tags: ['Verbes utiles'],
    leitnerBox: 1,
    nextReviewDate: today,
    lastReviewedAt: null,
    reviewHistory: [],
    totalReviews: 0,
    successCount: 0,
    failureCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'w-init-4',
    french: 'apprendre',
    english: 'to learn',
    example: 'She wants to learn English quickly.',
    tags: ['Verbes utiles'],
    leitnerBox: 1,
    nextReviewDate: today,
    lastReviewedAt: null,
    reviewHistory: [],
    totalReviews: 0,
    successCount: 0,
    failureCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'w-init-5',
    french: 'voyage',
    english: 'journey / travel',
    example: 'Have a safe journey!',
    tags: ['Voyage'],
    leitnerBox: 1,
    nextReviewDate: today,
    lastReviewedAt: null,
    reviewHistory: [],
    totalReviews: 0,
    successCount: 0,
    failureCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'p-init-1',
    name: 'Vocabulaire de démarrage',
    description: 'Les premiers mots essentiels pour commencer votre aventure ENflash',
    color: '#6366f1',
    icon: 'Sparkles',
    wordIds: ['w-init-1', 'w-init-2', 'w-init-3', 'w-init-4', 'w-init-5'],
    isSmart: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function createInitialDatabase(): AppDatabase {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    words: INITIAL_WORDS,
    playlists: INITIAL_PLAYLISTS,
    dailyTests: [],
    weeklyEvaluations: [],
    streak: {
      currentStreak: 0,
      maxStreak: 0,
      lastCompletedDate: null,
      streakFreezes: 0,
      activityCalendar: {},
    },
    gamification: {
      xp: 0,
      level: 1,
      unlockedBadges: [],
    },
    settings: {
      ...DEFAULT_APP_SETTINGS,
    },
  };
}
