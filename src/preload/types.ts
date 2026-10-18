import { AppDatabase, Word, PiperVoiceModel, VoiceAccent } from '../shared/types';

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

  // Synthèse vocale & Audio en cascade
  getAudioDataUrl: (params: { text: string; accent: VoiceAccent; preferredVoiceId?: string }) => Promise<{
    success: boolean;
    dataUrl?: string;
    source: 'cache' | 'piper' | 'dictionary' | 'fallback';
    error?: string;
  }>;
  getVoicesStatus: () => Promise<PiperVoiceModel[]>;
  downloadVoice: (voiceId: string) => Promise<{ success: boolean; error?: string }>;
  deleteVoice: (voiceId: string) => Promise<boolean>;
  getCacheStats: () => Promise<{ count: number; totalSizeBytes: number; formattedSize: string }>;
  clearCache: () => Promise<boolean>;
  onVoiceDownloadProgress: (callback: (data: { voiceId: string; progress: number }) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
