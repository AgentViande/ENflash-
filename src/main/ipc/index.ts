import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import { getDatabaseStore } from '../storage/store';
import { getAppUpdater } from '../updater';
import { sendDesktopNotification, startReminderScheduler } from '../notifications';
import { getVoiceManager } from '../audio/voiceManager';
import { AppDatabase, Word } from '../../shared/types';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const store = getDatabaseStore();
  const updater = getAppUpdater();
  updater.setWindow(mainWindow);

  // Initialisation du rappel selon les réglages enregistrés
  const initialData = store.load();
  if (initialData.settings?.dailyReminder) {
    startReminderScheduler(true, initialData.settings.dailyReminderTime);
  }

  // --- Base de données ---
  ipcMain.handle('db:get', async (): Promise<AppDatabase> => {
    return store.load();
  });

  ipcMain.handle('db:save', async (_event, data: AppDatabase): Promise<boolean> => {
    store.save(data);
    if (data.settings) {
      startReminderScheduler(data.settings.dailyReminder, data.settings.dailyReminderTime);
    }
    return true;
  });

  ipcMain.handle('db:exportBackup', async () => {
    const defaultName = `ENflash_sauvegarde_${new Date().toISOString().split('T')[0]}.json`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter une sauvegarde complète ENflash',
      defaultPath: defaultName,
      filters: [{ name: 'Fichiers JSON (*.json)', extensions: ['json'] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    try {
      store.exportToFile(filePath);
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:importBackup', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer une sauvegarde ENflash',
      properties: ['openFile'],
      filters: [{ name: 'Fichiers JSON (*.json)', extensions: ['json'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    try {
      const data = store.importFromFile(filePaths[0]);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Export / Import CSV de mots ---
  ipcMain.handle('csv:exportWords', async (_event, words: Word[]) => {
    const defaultName = `ENflash_vocabulaire_${new Date().toISOString().split('T')[0]}.csv`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter le vocabulaire en CSV',
      defaultPath: defaultName,
      filters: [{ name: 'Fichiers CSV (*.csv)', extensions: ['csv'] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    try {
      // Formatage CSV : Français,Anglais,Exemple,Tag,Boîte
      const header = 'français,anglais,exemple,tag\n';
      const rows = words.map((w) => {
        const escapeCsv = (str?: string) => `"${(str || '').replace(/"/g, '""')}"`;
        const tags = (w.tags || []).join('; ');
        return `${escapeCsv(w.french)},${escapeCsv(w.english)},${escapeCsv(w.example)},${escapeCsv(tags)}`;
      });

      const csvContent = '\uFEFF' + header + rows.join('\n'); // Ajout du BOM UTF-8 pour Excel
      fs.writeFileSync(filePath, csvContent, 'utf-8');
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('csv:importWords', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer des mots depuis un fichier CSV',
      properties: ['openFile'],
      filters: [{ name: 'Fichiers CSV (*.csv, *.txt)', extensions: ['csv', 'txt'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    try {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        return { success: true, words: [] };
      }

      // Analyse basique du CSV
      const parsedWords: Partial<Word>[] = [];
      const dataLines = lines.slice(1);

      for (const line of dataLines) {
        // Regex pour séparer par virgule tout en respectant les guillemets
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
          if (match.index === regex.lastIndex) regex.lastIndex++;
          let val = match[1] || '';
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1).replace(/""/g, '"');
          }
          matches.push(val.trim());
          if (matches.length >= 4) break;
        }

        const french = matches[0] || '';
        const english = matches[1] || '';
        const example = matches[2] || '';
        const tagRaw = matches[3] || '';

        if (french && english) {
          const tags = tagRaw
            ? tagRaw.split(/[;,]/).map((t) => t.trim()).filter(Boolean)
            : [];

          parsedWords.push({
            french,
            english,
            example,
            tags,
          });
        }
      }

      return { success: true, words: parsedWords };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Notifications de bureau ---
  ipcMain.handle('notify:send', async (_event, options: { title: string; body: string }) => {
    return sendDesktopNotification(options.title, options.body);
  });

  ipcMain.handle('notify:schedule', async (_event, { enabled, time }: { enabled: boolean; time: string }) => {
    startReminderScheduler(enabled, time);
    return true;
  });

  // --- Auto-update & Versions ---
  ipcMain.handle('app:version', async () => {
    return app.getVersion();
  });

  ipcMain.handle('updater:check', async () => {
    return updater.checkForUpdates();
  });

  ipcMain.handle('updater:download', async () => {
    return updater.downloadUpdate();
  });

  ipcMain.handle('updater:install', async () => {
    updater.installUpdate();
  });

  // --- Synthèse vocale & Audio en cascade ---
  const voiceMgr = getVoiceManager();
  voiceMgr.setWindow(mainWindow);

  ipcMain.handle(
    'audio:getAudioDataUrl',
    async (_event, { text, accent, preferredVoiceId }: { text: string; accent: any; preferredVoiceId?: string }) => {
      return voiceMgr.getAudioDataUrl(text, accent, preferredVoiceId);
    }
  );

  ipcMain.handle('audio:getVoicesStatus', async () => {
    return voiceMgr.getVoicesStatus();
  });

  ipcMain.handle('audio:downloadVoice', async (_event, voiceId: string) => {
    return voiceMgr.downloadVoice(voiceId);
  });

  ipcMain.handle('audio:deleteVoice', async (_event, voiceId: string) => {
    return voiceMgr.deleteVoice(voiceId);
  });

  ipcMain.handle('audio:getCacheStats', async () => {
    return voiceMgr.getCacheStats();
  });

  ipcMain.handle('audio:clearCache', async () => {
    return voiceMgr.clearCache();
  });
}
