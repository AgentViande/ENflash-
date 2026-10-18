import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SentenceQueueItem,
  SentenceQueueStats,
  ExampleSourceType,
} from '../../shared/types';
import { getLlmManager, isHeavyTaskActive } from './llmManager';
import { getDatabaseStore } from '../storage/store';

export class SentenceQueue {
  private static instance: SentenceQueue;
  private queueFilePath: string;
  private items: SentenceQueueItem[] = [];
  private isProcessing = false;
  private isPaused = false;
  private isSessionPaused = false; // Pause automatique pendant un test ou une session d'étude
  private currentProcessingWord: string | undefined = undefined;

  private constructor() {
    this.queueFilePath = path.join(app.getPath('userData'), 'sentence_queue.json');
    this.loadQueue();
  }

  public static getInstance(): SentenceQueue {
    if (!SentenceQueue.instance) {
      SentenceQueue.instance = new SentenceQueue();
    }
    return SentenceQueue.instance;
  }

  private loadQueue(): void {
    try {
      if (fs.existsSync(this.queueFilePath)) {
        const raw = fs.readFileSync(this.queueFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Réinitialiser les items qui étaient en cours lors de la fermeture
          this.items = parsed.map((item) => ({
            ...item,
            status: item.status === 'processing' ? 'pending' : item.status,
          }));
        }
      }
    } catch (err) {
      console.warn('[SentenceQueue] Erreur chargement file persistante:', err);
      this.items = [];
    }
  }

  private saveQueue(): void {
    try {
      // Filtrer pour ne garder que les 100 derniers éléments 'done' et tous les 'pending'
      const pending = this.items.filter((i) => i.status === 'pending' || i.status === 'processing');
      const finished = this.items
        .filter((i) => i.status === 'done' || i.status === 'failed')
        .slice(-100);

      const toSave = [...pending, ...finished];
      fs.writeFileSync(this.queueFilePath, JSON.stringify(toSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SentenceQueue] Erreur sauvegarde file:', err);
    }
  }

  private notifyProgress(): void {
    const stats = this.getStats();
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('sentence:queueProgress', stats);
      }
    }
  }

  public getStats(): SentenceQueueStats {
    const total = this.items.length;
    const pending = this.items.filter((i) => i.status === 'pending').length;
    const completed = this.items.filter((i) => i.status === 'done').length;

    // Estimation du temps restant : ~1.2 seconde par phrase en moyenne
    const estimatedRemainingSec = Math.round(pending * 1.2);

    return {
      total,
      pending,
      completed,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused || this.isSessionPaused,
      currentWord: this.currentProcessingWord,
      estimatedRemainingSec,
    };
  }

  /**
   * Ajoute un mot dans la file d'attente (priorité 1 pour ajout manuel, 2 pour import)
   */
  public enqueue(item: {
    wordId: string;
    english: string;
    french: string;
    priority?: number; // 1 = prioritaire (manuel), 2 = normal (masse)
    definition?: string;
    partOfSpeech?: string;
  }): void {
    // Éviter les doublons de traitement pour le même mot s'il est déjà en attente
    const existing = this.items.find(
      (i) => i.wordId === item.wordId && (i.status === 'pending' || i.status === 'processing')
    );
    if (existing) {
      // Mettre à jour la priorité si plus urgente
      if (item.priority && item.priority < existing.priority) {
        existing.priority = item.priority;
        this.saveQueue();
      }
      return;
    }

    const newItem: SentenceQueueItem = {
      id: crypto.randomUUID(),
      wordId: item.wordId,
      english: item.english.trim(),
      french: item.french.trim(),
      definition: item.definition,
      partOfSpeech: item.partOfSpeech,
      priority: item.priority || 1,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    this.items.push(newItem);
    this.saveQueue();
    this.notifyProgress();

    // Déclencher le traitement
    this.triggerProcessing();
  }

  /**
   * Enfile tous les mots manquants d'exemples dans la base
   */
  public enqueueMissingWords(
    words: Array<{ id: string; english: string; french: string; example?: string }>
  ): number {
    let queuedCount = 0;
    for (const w of words) {
      if (!w.example || !w.example.trim()) {
        this.enqueue({
          wordId: w.id,
          english: w.english,
          french: w.french,
          priority: 2, // Priorité basse pour la génération en masse
        });
        queuedCount++;
      }
    }
    return queuedCount;
  }

  public pause(): void {
    this.isPaused = true;
    this.notifyProgress();
  }

  public resume(): void {
    this.isPaused = false;
    this.notifyProgress();
    this.triggerProcessing();
  }

  /**
   * Pause/Reprise automatique liée à l'activité de l'utilisateur (Flashcards / Test)
   */
  public setSessionActive(isActive: boolean): void {
    this.isSessionPaused = isActive;
    this.notifyProgress();
    if (!isActive) {
      this.triggerProcessing();
    }
  }

  public cancel(): void {
    // Annuler tous les items en attente
    this.items = this.items.filter((i) => i.status !== 'pending');
    this.currentProcessingWord = undefined;
    this.isProcessing = false;
    this.saveQueue();
    this.notifyProgress();
  }

  public triggerProcessing(): void {
    if (this.isProcessing || this.isPaused || this.isSessionPaused) {
      return;
    }

    this.processNextItem();
  }

  private async processNextItem(): Promise<void> {
    if (this.isPaused || this.isSessionPaused) {
      this.isProcessing = false;
      this.currentProcessingWord = undefined;
      return;
    }

    // Si une autre tâche lourde (ex: synthèse vocale Kokoro) tourne actuellement, patienter
    if (isHeavyTaskActive()) {
      setTimeout(() => this.processNextItem(), 300);
      return;
    }

    // Récupérer le prochain élément : priorité 1 d'abord, puis plus ancien d'abord
    const nextItem = this.items
      .filter((i) => i.status === 'pending')
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })[0];

    if (!nextItem) {
      this.isProcessing = false;
      this.currentProcessingWord = undefined;
      this.saveQueue();
      this.notifyProgress();
      return;
    }

    this.isProcessing = true;
    nextItem.status = 'processing';
    this.currentProcessingWord = nextItem.english;
    this.saveQueue();
    this.notifyProgress();

    const store = getDatabaseStore();
    const db = store.load();
    const settings = db.settings;

    try {
      // Vérifier si le mot existe toujours dans la DB et s'il a déjà une phrase utilisateur
      const wordInDb = db.words.find((w) => w.id === nextItem.wordId);
      if (!wordInDb) {
        nextItem.status = 'done';
        this.saveQueue();
        this.processNextItem();
        return;
      }

      // Règle d'or : Ne JAMAIS écraser une phrase utilisateur
      if (wordInDb.example && wordInDb.exampleSource === 'user') {
        nextItem.status = 'done';
        this.saveQueue();
        this.processNextItem();
        return;
      }

      const llmManager = getLlmManager();
      const result = await llmManager.resolveSentenceCascade({
        english: nextItem.english,
        french: nextItem.french,
        existingExample: wordInDb.example,
        existingSource: wordInDb.exampleSource,
        cascadeOrder: settings.exampleCascadeOrder,
        localLlmEnabled: settings.localLlmEnabled,
        localLlmModel: settings.localLlmModel,
        aiApiKey: settings.aiApiKey,
        aiApiEndpoint: settings.aiApiEndpoint,
      });

      if (result && result.sentence) {
        // Mettre à jour le mot dans la base de données
        wordInDb.example = result.sentence;
        wordInDb.exampleSource = result.source;
        wordInDb.updatedAt = new Date().toISOString();
        store.save(db);

        nextItem.status = 'done';

        // Diffuser aux fenêtres Electron pour mise à jour immédiate
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send('sentence:generated', {
              wordId: wordInDb.id,
              sentence: result.sentence,
              source: result.source,
            });
          }
        }
      } else {
        nextItem.attempts += 1;
        if (nextItem.attempts >= 2) {
          nextItem.status = 'failed';
          nextItem.error = 'Aucune phrase valide trouvée dans la cascade';
        } else {
          nextItem.status = 'pending';
        }
      }
    } catch (err: any) {
      console.error('[SentenceQueue] Erreur lors du traitement de l’item:', err);
      nextItem.attempts += 1;
      nextItem.status = nextItem.attempts >= 2 ? 'failed' : 'pending';
      nextItem.error = err.message;
    }

    this.saveQueue();
    this.notifyProgress();

    // Pause courtoise de 200 ms entre les items pour laisser respirer le processeur
    setTimeout(() => {
      this.processNextItem();
    }, 200);
  }
}

export function getSentenceQueue(): SentenceQueue {
  return SentenceQueue.getInstance();
}
