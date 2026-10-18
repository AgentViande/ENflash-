import { AppDatabase, Word, PiperVoiceModel, VoiceAccent, AudioEngineStatus, AudioSourceType } from '../shared/types';

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
