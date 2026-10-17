/**
 * Types TypeScript partagés pour l'application ENflash
 */

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export type WordStatus = 'new' | 'learning' | 'mastered';

export interface ReviewHistoryEntry {
  date: string; // ISO 8601
  success: boolean;
  mode: 'flashcard' | 'daily' | 'eval';
  previousBox: LeitnerBox;
  newBox: LeitnerBox;
}

export interface Word {
  id: string; // UUID v4
  french: string;
  english: string;
  example?: string;
  tags: string[];
  note?: string;
  leitnerBox: LeitnerBox;
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewedAt: string | null; // ISO 8601
  reviewHistory: ReviewHistoryEntry[];
  totalReviews: number;
  successCount: number;
  failureCount: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  wordIds: string[];
  isSmart: boolean;
  smartType?: 'difficult' | 'new';
  createdAt: string;
  updatedAt: string;
}

export interface DailyTestResultItem {
  wordId: string;
  success: boolean;
}

export interface DailyTestSession {
  id: string;
  date: string; // YYYY-MM-DD
  wordIds: string[];
  results: DailyTestResultItem[];
  score: number; // e.g. 18
  total: number; // e.g. 20
  xpEarned: number;
  completedAt: string;
}

export type LevenshteinStatus = 'exact' | 'almost' | 'wrong';

export interface WeeklyAnswer {
  wordId: string;
  french: string;
  expected: string;
  given: string;
  status: LevenshteinStatus;
  distance: number;
}

export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface WeeklyEvaluation {
  id: string;
  date: string; // YYYY-MM-DD
  answers: WeeklyAnswer[];
  scorePercentage: number;
  estimatedLevel: EnglishLevel;
  xpEarned: number;
  completedAt: string;
}

export interface StreakState {
  currentStreak: number;
  maxStreak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD
  streakFreezes: number; // Nombre de jokers de gel disponibles
  activityCalendar: Record<string, number>; // YYYY-MM-DD -> intensité (ex: nombre d'actions / score)
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'words' | 'streak' | 'evaluation' | 'special';
}

export interface UnlockedBadge {
  id: string;
  unlockedAt: string;
}

export interface GamificationState {
  xp: number;
  level: number;
  unlockedBadges: UnlockedBadge[];
}

export type ThemeMode = 'dark' | 'light' | 'system';
export type CardDirection = 'fr_to_en' | 'en_to_fr';
export type VoiceAccent = 'en-US' | 'en-GB';

export interface AppSettings {
  theme: ThemeMode;
  cardDirection: CardDirection;
  voiceAccent: VoiceAccent;
  soundEffects: boolean;
  soundVolume: number; // 0 à 1
  dailyReminder: boolean;
  dailyReminderTime: string; // "18:00"
  autoCheckUpdates: boolean;
  lastSeenVersion: string;
}

export interface AppDatabase {
  schemaVersion: number;
  words: Word[];
  playlists: Playlist[];
  dailyTests: DailyTestSession[];
  weeklyEvaluations: WeeklyEvaluation[];
  streak: StreakState;
  gamification: GamificationState;
  settings: AppSettings;
}
