import {
  AppDatabase,
  Word,
  PiperVoiceModel,
  VoiceAccent,
  AudioEngineStatus,
  AudioSourceType,
  LocalLlmStatus,
  LocalLlmModelType,
  SystemHardwareInfo,
  SpeedTestResult,
  SentenceQueueStats,
  ExampleSourceType,
} from '../shared/types';

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

  // Modèle de langage local (LLM) & Phrases d'exemple
  getLlmStatus: (modelType?: LocalLlmModelType) => Promise<LocalLlmStatus>;
  getHardwareInfo: () => Promise<SystemHardwareInfo>;
  downloadLlmModel: (modelType?: LocalLlmModelType) => Promise<{ success: boolean; error?: string }>;
  cancelLlmDownload: () => Promise<boolean>;
  deleteLlmModel: (modelType?: LocalLlmModelType) => Promise<boolean>;
  testLlmSpeed: (modelType?: LocalLlmModelType) => Promise<SpeedTestResult>;
  generateSentence: (params: {
    english: string;
    french: string;
    definition?: string;
    partOfSpeech?: string;
    modelType?: LocalLlmModelType;
  }) => Promise<{ success: boolean; sentence?: string; error?: string }>;
  resolveSentenceCascade: (params: {
    english: string;
    french: string;
    existingExample?: string;
    existingSource?: ExampleSourceType;
    cascadeOrder?: ExampleSourceType[];
    localLlmEnabled?: boolean;
    localLlmModel?: LocalLlmModelType;
    aiApiKey?: string;
    aiApiEndpoint?: string;
  }) => Promise<{ sentence: string; source: ExampleSourceType } | null>;

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
  pauseSentenceQueue: () => Promise<boolean>;
  resumeSentenceQueue: () => Promise<boolean>;
  cancelSentenceQueue: () => Promise<boolean>;
  setSentenceSessionActive: (isActive: boolean) => Promise<boolean>;

  // Événements LLM & Phrases
  onLlmDownloadProgress?: (callback: (data: { modelType: LocalLlmModelType; progress: number; loadedBytes: number; totalBytes: number; speedFormatted?: string }) => void) => () => void;
  onSentenceQueueProgress?: (callback: (stats: SentenceQueueStats) => void) => () => void;
  onSentenceGenerated?: (callback: (data: { wordId: string; sentence: string; source: ExampleSourceType }) => void) => () => void;

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
