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
};

contextBridge.exposeInMainWorld('api', api);
