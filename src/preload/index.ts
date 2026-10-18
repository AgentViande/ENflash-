import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI, UpdateInfo } from './types';
import { AppDatabase, Word } from '../shared/types';

const api: ElectronAPI = {
  getDatabase: (): Promise<AppDatabase> => ipcRenderer.invoke('db:get'),
  saveDatabase: (data: AppDatabase): Promise<boolean> => ipcRenderer.invoke('db:save', data),
  exportBackup: () => ipcRenderer.invoke('db:exportBackup'),
  importBackup: () => ipcRenderer.invoke('db:importBackup'),
  
  exportWordsCsv: (words: Word[]) => ipcRenderer.invoke('csv:exportWords', words),
  importWordsCsv: () => ipcRenderer.invoke('csv:importWords'),

  sendNotification: (options: { title: string; body: string }) => ipcRenderer.invoke('notify:send', options),
  scheduleReminder: (enabled: boolean, time: string) => ipcRenderer.invoke('notify:schedule', { enabled, time }),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  checkForUpdates: (): Promise<{ available: boolean; info?: UpdateInfo; error?: string }> =>
    ipcRenderer.invoke('updater:check'),
  startUpdateDownload: (): Promise<boolean> => ipcRenderer.invoke('updater:download'),
  installDownloadedUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install'),

  onUpdateDownloadProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('updater:progress', handler);
    return () => ipcRenderer.removeListener('updater:progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('updater:downloaded', handler);
    return () => ipcRenderer.removeListener('updater:downloaded', handler);
  },

  // Synthèse vocale & Audio en cascade Kokoro
  getAudioDataUrl: (params) => ipcRenderer.invoke('audio:getAudioDataUrl', params),
  getKokoroStatus: (params) => ipcRenderer.invoke('audio:getKokoroStatus', params),
  installKokoro: () => ipcRenderer.invoke('audio:installKokoro'),
  getComparisonSample: (params) => ipcRenderer.invoke('audio:getComparisonSample', params),
  getCacheStats: () => ipcRenderer.invoke('audio:getCacheStats'),
  clearCache: () => ipcRenderer.invoke('audio:clearCache'),
  openCacheFolder: () => ipcRenderer.invoke('audio:openCacheFolder'),
  preloadWords: (items) => ipcRenderer.invoke('audio:preloadWords', items),
  cancelPreload: () => ipcRenderer.invoke('audio:cancelPreload'),
  onKokoroProgress: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('audio:kokoroProgress', handler);
    return () => ipcRenderer.removeListener('audio:kokoroProgress', handler);
  },
  onPreloadProgress: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('audio:preloadProgress', handler);
    return () => ipcRenderer.removeListener('audio:preloadProgress', handler);
  },

  // Modèle de langage local (LLM) & Phrases d'exemple
  getLlmStatus: (modelType) => ipcRenderer.invoke('llm:getStatus', modelType),
  getHardwareInfo: () => ipcRenderer.invoke('llm:getHardwareInfo'),
  downloadLlmModel: (modelType) => ipcRenderer.invoke('llm:downloadModel', modelType),
  cancelLlmDownload: () => ipcRenderer.invoke('llm:cancelDownload'),
  deleteLlmModel: (modelType) => ipcRenderer.invoke('llm:deleteModel', modelType),
  testLlmSpeed: (modelType) => ipcRenderer.invoke('llm:testSpeed', modelType),
  generateSentence: (params) => ipcRenderer.invoke('llm:generateSentence', params),
  resolveSentenceCascade: (params) => ipcRenderer.invoke('llm:resolveCascade', params),

  // File d'attente des phrases
  enqueueSentence: (params) => ipcRenderer.invoke('sentence:enqueue', params),
  enqueueMissingSentences: (words) => ipcRenderer.invoke('sentence:enqueueMissing', words),
  getSentenceQueueStats: () => ipcRenderer.invoke('sentence:getStats'),
  pauseSentenceQueue: () => ipcRenderer.invoke('sentence:pause'),
  resumeSentenceQueue: () => ipcRenderer.invoke('sentence:resume'),
  cancelSentenceQueue: () => ipcRenderer.invoke('sentence:cancel'),
  setSentenceSessionActive: (isActive) => ipcRenderer.invoke('sentence:setSessionActive', isActive),

  // Événements LLM & Phrases
  onLlmDownloadProgress: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('llm:downloadProgress', handler);
    return () => ipcRenderer.removeListener('llm:downloadProgress', handler);
  },
  onSentenceQueueProgress: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('sentence:queueProgress', handler);
    return () => ipcRenderer.removeListener('sentence:queueProgress', handler);
  },
  onSentenceGenerated: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('sentence:generated', handler);
    return () => ipcRenderer.removeListener('sentence:generated', handler);
  },

  // Rétro-compatibilité
  getVoicesStatus: () => ipcRenderer.invoke('audio:getVoicesStatus'),
  downloadVoice: (voiceId) => ipcRenderer.invoke('audio:downloadVoice', voiceId),
  deleteVoice: (voiceId) => ipcRenderer.invoke('audio:deleteVoice', voiceId),
  onVoiceDownloadProgress: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('audio:downloadProgress', handler);
    return () => ipcRenderer.removeListener('audio:downloadProgress', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
