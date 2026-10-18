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
  exampleSource?: ExampleSourceType;
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
  date: string; // YYYY-MM-DD (clé de jour Paris)
  wordIds: string[];
  results: DailyTestResultItem[];
  score: number; // e.g. 18
  total: number; // e.g. 20
  xpEarned: number;
  completedAt: string;
  isFreePractice?: boolean;
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
  isFreePractice?: boolean;
}

export interface StreakState {
  currentStreak: number;
  maxStreak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD (clé de jour Paris)
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

export type AudioSourceType = 'cache' | 'kokoro' | 'dictionary' | 'fallback';

export interface AudioVoiceStatus {
  id: string;
  name: string;
  accent: VoiceAccent;
  gender: 'female' | 'male';
  grade: string;
  label: string;
  description: string;
  isDefault?: boolean;
  isAvailable: boolean;
}

export interface AudioEngineStatus {
  isKokoroReady: boolean;
  modelStatus: 'installed' | 'downloading' | 'error' | 'absent';
  modelLocation?: string;
  activeVoiceId: string;
  activeAccent: VoiceAccent;
  activeEngine: 'kokoro' | 'fallback';
  cacheCount: number;
  cacheFormattedSize: string;
  error?: string;
  availableVoices?: AudioVoiceStatus[];
}

export interface PiperVoiceModel {
  id: string;
  name: string;
  accent: VoiceAccent;
  gender: 'female' | 'male';
  sizeBytes: number;
  sizeFormatted: string;
  modelUrl: string;
  configUrl: string;
  isDownloaded: boolean;
  downloadProgress?: number;
}

export type ExampleSourceType = 'user' | 'dictionary' | 'local_llm' | 'api';
export type LocalLlmModelType = 'standard' | 'light';

export interface LocalLlmStatus {
  isEnabled: boolean;
  modelType: LocalLlmModelType;
  isInstalled: boolean;
  isDownloading: boolean;
  downloadProgress: number; // 0 à 100
  downloadSpeed?: string;
  downloadEta?: string;
  isLoaded: boolean;
  isGenerating: boolean;
  modelSizeBytes: number;
  modelSizeFormatted: string;
  ramUsageMB?: number;
  lastLoadedAt?: string;
  error?: string;
}

export interface SystemHardwareInfo {
  totalRamGB: number;
  freeRamGB: number;
  cpuCores: number;
  cpuModel: string;
  ramTier: 'optimal' | 'warning' | 'insufficient'; // >=4Go optimal, 3-4Go warning, <3Go insufficient
  recommendation: string;
}

export interface SentenceQueueItem {
  id: string;
  wordId: string;
  english: string;
  french: string;
  definition?: string;
  partOfSpeech?: string;
  priority: number; // 1 = manuel (urgent), 2 = fond / en masse
  status: 'pending' | 'processing' | 'done' | 'failed';
  attempts: number;
  createdAt: string;
  error?: string;
}

export interface SentenceQueueStats {
  total: number;
  pending: number;
  completed: number;
  isProcessing: boolean;
  isPaused: boolean;
  currentWord?: string;
  estimatedRemainingSec?: number;
}

export interface SentenceQualityResult {
  isValid: boolean;
  cleanSentence?: string;
  reason?: string;
}

export interface SpeedTestResult {
  durationMs: number;
  tokensPerSec: number;
  ramUsageMB: number;
  sentence: string;
  rating: 'fast' | 'acceptable' | 'slow';
  recommendation: string;
}

export interface AppSettings {
  theme: ThemeMode;
  cardDirection: CardDirection;
  voiceAccent: VoiceAccent;
  voiceSpeed: number; // 0.6 à 1.2
  voiceVolume?: number; // 0.0 à 1.0 (défaut 0.8)
  autoPronounce: boolean;
  preferredVoiceId?: string;
  soundEffects: boolean;
  soundVolume: number; // 0 à 1
  dailyReminder: boolean;
  dailyReminderTime: string; // "18:00"
  autoCheckUpdates: boolean;
  lastSeenVersion: string;

  // Phrases d'exemple & IA locale
  exampleCascadeOrder?: ExampleSourceType[];
  localLlmEnabled?: boolean;
  localLlmModel?: LocalLlmModelType;
  aiApiKey?: string;
  aiApiEndpoint?: string;
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
  lastDailyTestDayKey: string | null;
  lastStreakDayKey: string | null;
  lastEvaluationWeekKey: string | null;
}
