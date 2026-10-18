import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import { getDatabaseStore } from '../storage/store';
import { getAppUpdater } from '../updater';
import { sendDesktopNotification, startReminderScheduler } from '../notifications';
import { getVoiceManager } from '../audio/voiceManager';
import { getLlmManager } from '../llm/llmManager';
import { getSentenceQueue } from '../llm/sentenceQueue';
import { AppDatabase, Word, LocalLlmModelType, ExampleSourceType } from '../../shared/types';

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

  // --- Synthèse vocale & Audio en cascade Kokoro ---
  const voiceMgr = getVoiceManager();
  voiceMgr.setWindow(mainWindow);

  ipcMain.handle(
    'audio:getAudioDataUrl',
    async (
      _event,
      {
        text,
        accent,
        preferredVoiceId,
        speed,
      }: { text: string; accent: any; preferredVoiceId?: string; speed?: number }
    ) => {
      return voiceMgr.getAudioDataUrl(text, accent, preferredVoiceId, speed);
    }
  );

  ipcMain.handle(
    'audio:getKokoroStatus',
    async (_event, { accent, preferredVoiceId }: { accent?: any; preferredVoiceId?: string } = {}) => {
      return voiceMgr.getAudioEngineStatus(accent, preferredVoiceId);
    }
  );

  ipcMain.handle('audio:installKokoro', async () => {
    return voiceMgr.installKokoroModel();
  });

  ipcMain.handle(
    'audio:getComparisonSample',
    async (_event, { accent, preferredVoiceId }: { accent: any; preferredVoiceId?: string }) => {
      return voiceMgr.getComparisonSample(accent, preferredVoiceId);
    }
  );

  ipcMain.handle('audio:getCacheStats', async () => {
    return voiceMgr.getCacheStats();
  });

  ipcMain.handle('audio:clearCache', async () => {
    return voiceMgr.clearCache();
  });

  ipcMain.handle('audio:openCacheFolder', async () => {
    return voiceMgr.openCacheFolder();
  });

  ipcMain.handle('audio:preloadWords', async (_event, items: any[]) => {
    voiceMgr.preloadWords(items);
    return true;
  });

  ipcMain.handle('audio:cancelPreload', async () => {
    voiceMgr.cancelPreload();
    return true;
  });

  // --- Modèle de langage local (LLM) & Phrases d'exemple ---
  const llmManager = getLlmManager();
  const sentenceQueue = getSentenceQueue();

  ipcMain.handle(
    'llm:getStatus',
    async (_event, modelType: LocalLlmModelType = 'standard') => {
      return llmManager.getStatus(modelType);
    }
  );

  ipcMain.handle('llm:getHardwareInfo', async () => {
    return llmManager.getHardwareInfo();
  });

  ipcMain.handle(
    'llm:downloadModel',
    async (_event, modelType: LocalLlmModelType = 'standard') => {
      return llmManager.downloadModel(modelType);
    }
  );

  ipcMain.handle('llm:cancelDownload', async () => {
    return llmManager.cancelDownload();
  });

  ipcMain.handle(
    'llm:deleteModel',
    async (_event, modelType: LocalLlmModelType = 'standard') => {
      return llmManager.deleteModel(modelType);
    }
  );

  ipcMain.handle(
    'llm:testSpeed',
    async (_event, modelType: LocalLlmModelType = 'standard') => {
      return llmManager.testSpeed(modelType);
    }
  );

  ipcMain.handle(
    'llm:generateSentence',
    async (
      _event,
      params: {
        english: string;
        french: string;
        definition?: string;
        partOfSpeech?: string;
        modelType?: LocalLlmModelType;
      }
    ) => {
      return llmManager.generateSentenceWithLocalLlm(params);
    }
  );

  ipcMain.handle(
    'llm:resolveCascade',
    async (
      _event,
      params: {
        english: string;
        french: string;
        existingExample?: string;
        existingSource?: ExampleSourceType;
        cascadeOrder?: ExampleSourceType[];
        localLlmEnabled?: boolean;
        localLlmModel?: LocalLlmModelType;
        aiApiKey?: string;
        aiApiEndpoint?: string;
      }
    ) => {
      return llmManager.resolveSentenceCascade(params);
    }
  );

  // --- File d'attente des phrases d'exemple ---
  ipcMain.handle(
    'sentence:enqueue',
    async (
      _event,
      params: {
        wordId: string;
        english: string;
        french: string;
        priority?: number;
        definition?: string;
        partOfSpeech?: string;
      }
    ) => {
      sentenceQueue.enqueue(params);
      return true;
    }
  );

  ipcMain.handle(
    'sentence:enqueueMissing',
    async (
      _event,
      words: Array<{ id: string; english: string; french: string; example?: string }>
    ) => {
      return sentenceQueue.enqueueMissingWords(words);
    }
  );

  ipcMain.handle('sentence:getStats', async () => {
    return sentenceQueue.getStats();
  });

  ipcMain.handle('sentence:getItems', async () => {
    return sentenceQueue.getItems();
  });

  ipcMain.handle('sentence:pause', async () => {
    sentenceQueue.pause();
    return true;
  });

  ipcMain.handle('sentence:resume', async () => {
    sentenceQueue.resume();
    return true;
  });

  ipcMain.handle('sentence:cancel', async () => {
    sentenceQueue.cancel();
    return true;
  });

  ipcMain.handle('sentence:clear', async () => {
    sentenceQueue.clearQueue();
    return true;
  });

  ipcMain.handle('sentence:retryFailed', async () => {
    return sentenceQueue.retryFailed();
  });

  ipcMain.handle('sentence:setSessionActive', async (_event, isActive: boolean) => {
    sentenceQueue.setSessionActive(isActive);
    return true;
  });

  // Stubs de rétro-compatibilité
  ipcMain.handle('audio:getVoicesStatus', async () => {
    return [];
  });
  ipcMain.handle('audio:downloadVoice', async () => {
    return { success: true };
  });
  ipcMain.handle('audio:deleteVoice', async () => {
    return true;
  });
}
