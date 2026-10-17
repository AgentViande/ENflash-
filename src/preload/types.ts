import { AppDatabase, Word } from '../shared/types';

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
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
