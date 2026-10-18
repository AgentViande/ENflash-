import {
  AppDatabase,
  Word,
  PiperVoiceModel,
  VoiceAccent,
  AudioEngineStatus,
  AudioSourceType,
  SentenceQueueStats,
  SentenceQueueItem,
  ExampleSourceType,
  AiApiProvider,
} from '../shared/types';

export type { AudioEngineStatus };

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface ElectronAPI {
  // Base de données & Stockage
  getDatabase: () => Promise<AppDatabase>;
  saveDatabase: (data: AppDatabase) => Promise<boolean>;
  exportBackup: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
  importBackup: () => Promise<{ success: boolean; data?: AppDatabase; canceled?: boolean; error?: string }>;
  
  // Import / Export CSV
  exportWordsCsv: (words: Word[]) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
  importWordsCsv: () => Promise<{ success: boolean; words?: Partial<Word>[]; canceled?: boolean; error?: string }>;

  // Notifications de bureau
  sendNotification: (options: { title: string; body: string }) => Promise<boolean>;
  scheduleReminder: (enabled: boolean, time: string) => Promise<boolean>;

  // Système de mise à jour automatique
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{ available: boolean; info?: UpdateInfo; error?: string }>;
  startUpdateDownload: () => Promise<boolean>;
  installDownloadedUpdate: () => Promise<void>;
  onUpdateDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;

  // Synthèse vocale & Audio en cascade Kokoro
  getAudioDataUrl: (params: {
    text: string;
    accent: VoiceAccent;
    preferredVoiceId?: string;
    speed?: number;
  }) => Promise<{
    success: boolean;
    dataUrl?: string;
    source: AudioSourceType;
    voiceUsed?: string;
    error?: string;
  }>;
  getKokoroStatus: (params?: { accent?: VoiceAccent; preferredVoiceId?: string }) => Promise<AudioEngineStatus>;
  installKokoro: () => Promise<{ success: boolean; error?: string }>;
  getComparisonSample: (params: { accent: VoiceAccent; preferredVoiceId?: string }) => Promise<{
    sampleText: string;
    kokoroDataUrl?: string;
  }>;
  getCacheStats: () => Promise<{ count: number; totalSizeBytes: number; formattedSize: string }>;
  clearCache: () => Promise<{
    success: boolean;
    freedBytes: number;
    freedFormatted: string;
    deletedCount: number;
    failedFiles?: string[];
    error?: string;
  }>;
  openCacheFolder: () => Promise<{ success: boolean; error?: string }>;
  preloadWords: (items: Array<{ text: string; accent?: VoiceAccent; voiceId?: string; speed?: number }>) => Promise<boolean>;
  cancelPreload: () => Promise<boolean>;
  onKokoroProgress: (callback: (data: { progress: number; label: string }) => void) => () => void;
  onPreloadProgress?: (callback: (data: { isPreloading: boolean; completed: number; total: number; currentText?: string }) => void) => () => void;

  // Nettoyage de l'ancien modèle local (1.6 Go)
  checkLocalModelCleanup: () => Promise<{ needsCleanup: boolean; sizeBytes: number; sizeFormatted: string }>;
  deleteLocalModelFiles: () => Promise<{ success: boolean; freedBytes: number; freedFormatted: string }>;
  dismissLocalModelCleanup: () => Promise<boolean>;

  // Phrases d'exemple & Clés API
  testAiApiKey: (params: {
    provider?: AiApiProvider;
    apiKey: string;
    apiEndpoint?: string;
  }) => Promise<{ success: boolean; models?: string[]; error?: string; message?: string }>;
  testAiGeneration: (params: {
    provider?: AiApiProvider;
    apiKey: string;
    apiEndpoint?: string;
    model?: string;
  }) => Promise<{ success: boolean; sentence?: string; durationMs?: number; error?: string }>;
  resolveSentenceCascade: (params: {
    english: string;
    french: string;
    existingExample?: string;
    existingSource?: ExampleSourceType;
    cascadeOrder?: ExampleSourceType[];
    aiApiProvider?: AiApiProvider;
    aiApiKey?: string;
    aiApiEndpoint?: string;
    aiApiModel?: string;
    skipSentence?: string;
    priority?: 'normal' | 'immediate';
  }) => Promise<{
    sentence?: string;
    source?: ExampleSourceType;
    error?: string;
    durationMs?: number;
  } | null>;

  // File d'attente des phrases
  enqueueSentence: (params: {
    wordId: string;
    english: string;
    french: string;
    priority?: number;
    definition?: string;
    partOfSpeech?: string;
  }) => Promise<boolean>;
  enqueueMissingSentences: (words: Array<{ id: string; english: string; french: string; example?: string }>) => Promise<number>;
  getSentenceQueueStats: () => Promise<SentenceQueueStats>;
  getSentenceQueueItems: () => Promise<SentenceQueueItem[]>;
  pauseSentenceQueue: () => Promise<boolean>;
  resumeSentenceQueue: () => Promise<boolean>;
  cancelSentenceQueue: () => Promise<boolean>;
  clearSentenceQueue: () => Promise<boolean>;
  retryFailedSentences: () => Promise<number>;
  setSentenceSessionActive: (isActive: boolean) => Promise<boolean>;

  // Événements Phrases & File d'attente
  onSentenceQueueProgress?: (callback: (stats: SentenceQueueStats) => void) => () => void;
  onSentenceGenerated?: (callback: (data: { wordId: string; english?: string; sentence: string; source: ExampleSourceType }) => void) => () => void;

  // Rétro-compatibilité
  getVoicesStatus?: () => Promise<PiperVoiceModel[]>;
  downloadVoice?: (voiceId: string) => Promise<{ success: boolean; error?: string }>;
  deleteVoice?: (voiceId: string) => Promise<boolean>;
  onVoiceDownloadProgress?: (callback: (data: { voiceId: string; progress: number }) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
