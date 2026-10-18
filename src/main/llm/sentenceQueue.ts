import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SentenceQueueItem,
  SentenceQueueStats,
  ExampleSourceType,
} from '../../shared/types';
import { getLlmManager, isHeavyTaskActive, setHeavyTaskActive } from './llmManager';
import { getDatabaseStore } from '../storage/store';

export class SentenceQueue {
  private static instance: SentenceQueue;
  private queueFilePath: string;
  private items: SentenceQueueItem[] = [];
  private isProcessing = false;
  private isPaused = false;
  private isSessionPaused = false; // Pause automatique pendant un test ou une session d'étude
  private currentProcessingWord: string | undefined = undefined;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private activeProcessingId: string | null = null;

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

  /**
   * Nettoie et valide la file en cohérence avec la base de données
   */
  public cleanupQueue(): void {
    try {
      const store = getDatabaseStore();
      const db = store.load();
      const wordsMap = new Map(db.words.map((w) => [w.id, w]));

      // 1. Dédoublonnage : ne garder qu'une seule tâche par wordId (la plus récente ou la plus avancée)
      const uniqueByWordId = new Map<string, SentenceQueueItem>();
      for (const item of this.items) {
        const existing = uniqueByWordId.get(item.wordId);
        if (!existing) {
          uniqueByWordId.set(item.wordId, item);
        } else {
          // Préférer une tâche en attente ou en cours plutôt qu'échouée
          if (existing.status === 'failed' && (item.status === 'pending' || item.status === 'processing')) {
            uniqueByWordId.set(item.wordId, item);
          } else if (new Date(item.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
            uniqueByWordId.set(item.wordId, item);
          }
        }
      }

      const deduplicated = Array.from(uniqueByWordId.values());

      // 2. Supprimer les tâches dont le mot n'existe plus ou a déjà une phrase
      const validItems: SentenceQueueItem[] = [];
      for (const item of deduplicated) {
        const wordInDb = wordsMap.get(item.wordId);
        if (!wordInDb) {
          console.log(`[SentenceQueue] Nettoyage : mot ${item.wordId} (« ${item.english} ») n'existe plus en base.`);
          continue;
        }

        // Si le mot a déjà une phrase et que la tâche n'est pas déjà marquée "done", la supprimer
        if (wordInDb.example && wordInDb.example.trim()) {
          console.log(`[SentenceQueue] Nettoyage : mot « ${item.english} » a déjà une phrase d'exemple en base.`);
          continue;
        }

        // Si la tâche était restée coincée en "processing" lors d'un crash/fermeture, la repasser en "pending"
        if (item.status === 'processing') {
          item.status = 'pending';
        }

        validItems.push(item);
      }

      this.items = validItems;
      this.saveQueue();
    } catch (err) {
      console.warn('[SentenceQueue] Erreur lors du nettoyage de la file:', err);
    }
  }

  private loadQueue(): void {
    try {
      if (fs.existsSync(this.queueFilePath)) {
        const raw = fs.readFileSync(this.queueFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
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

    // Nettoyage immédiat au démarrage
    this.cleanupQueue();
  }

  private saveQueue(): void {
    try {
      // Filtrer pour ne garder que les 100 derniers éléments terminés/échoués et tous les 'pending'/'processing'
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
    const pending = this.items.filter((i) => i.status === 'pending').length;
    const completed = this.items.filter((i) => i.status === 'done').length;
    const failed = this.items.filter((i) => i.status === 'failed').length;
    const total = this.items.length;

    // Dernière erreur rencontrée dans les échecs
    const lastFailedItem = [...this.items].reverse().find((i) => i.status === 'failed' && i.error);
    const lastError = lastFailedItem?.error;

    // Estimation du temps restant : ~1.2 seconde par phrase en moyenne
    const estimatedRemainingSec = Math.round(pending * 1.2);

    return {
      total,
      pending,
      completed,
      failed,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused || this.isSessionPaused,
      currentWord: this.currentProcessingWord,
      estimatedRemainingSec,
      lastError,
      items: this.items,
    };
  }

  public getItems(): SentenceQueueItem[] {
    return [...this.items];
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
    const wordId = item.wordId;
    const existingIndex = this.items.findIndex((i) => i.wordId === wordId);

    if (existingIndex >= 0) {
      const existing = this.items[existingIndex];
      // Si la tâche est déjà en attente ou en cours, mettre à jour la priorité
      if (existing.status === 'pending' || existing.status === 'processing') {
        if (item.priority && item.priority < existing.priority) {
          existing.priority = item.priority;
          this.saveQueue();
        }
        return;
      }
      // Si elle était 'failed' ou 'done', la remplacer par une nouvelle tâche pending
      this.items.splice(existingIndex, 1);
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

    console.log(`[SentenceQueue] Enfilement mot: « ${newItem.english} » (Priorité: ${newItem.priority})`);
    this.items.push(newItem);
    this.saveQueue();
    this.notifyProgress();

    this.triggerProcessing();
  }

  /**
   * Enfile tous les mots manquants d'exemples dans la base
   */
  public enqueueMissingWords(
    words: Array<{ id: string; english: string; french: string; example?: string }>
  ): number {
    console.log(`[SentenceQueue] enqueueMissingWords appelé pour ${words.length} mots potentiels.`);

    // 1. D'abord nettoyer les tâches périmées
    this.cleanupQueue();

    // 2. Extraire les mots réellement sans phrase d'exemple
    const missing = words.filter((w) => !w.example || !w.example.trim());
    const missingIds = new Set(missing.map((w) => w.id));

    // Supprimer les anciennes tâches échouées pour ces mots pour repartir sur une file propre
    this.items = this.items.filter((i) => !missingIds.has(i.wordId) || i.status === 'processing');

    let queuedCount = 0;
    for (const w of missing) {
      this.enqueue({
        wordId: w.id,
        english: w.english,
        french: w.french,
        priority: 2, // Priorité normale pour génération en masse
      });
      queuedCount++;
    }

    console.log(`[SentenceQueue] ${queuedCount} mot(s) sans phrase enfilés proprement. Total tâches: ${this.items.length}`);
    return queuedCount;
  }

  public pause(): void {
    console.log('[SentenceQueue] File mise en pause');
    this.isPaused = true;
    this.notifyProgress();
  }

  public resume(): void {
    console.log('[SentenceQueue] File reprise');
    this.isPaused = false;
    this.notifyProgress();
    this.triggerProcessing();
  }

  private immediatePauseCount = 0;

  public pauseForImmediateRequest(): void {
    this.immediatePauseCount++;
    console.log('[SentenceQueue] ⏸️ File suspendue pour donner la priorité absolue à la requête utilisateur');
  }

  public resumeAfterImmediateRequest(): void {
    this.immediatePauseCount = Math.max(0, this.immediatePauseCount - 1);
    if (this.immediatePauseCount === 0) {
      console.log('[SentenceQueue] ▶️ Reprise de la file après requête utilisateur');
      this.triggerProcessing();
    }
  }

  public isPausedForImmediate(): boolean {
    return this.immediatePauseCount > 0;
  }

  public setSessionActive(isActive: boolean): void {
    this.isSessionPaused = isActive;
    this.notifyProgress();
    if (!isActive) {
      this.triggerProcessing();
    }
  }

  public cancel(): void {
    this.items = this.items.filter((i) => i.status !== 'pending');
    this.clearWatchdog();
    this.currentProcessingWord = undefined;
    this.activeProcessingId = null;
    this.isProcessing = false;
    setHeavyTaskActive(false);
    this.saveQueue();
    this.notifyProgress();
  }

  public clearQueue(): void {
    console.log('[SentenceQueue] Vidage complet de la file demandé');
    this.items = [];
    this.clearWatchdog();
    this.currentProcessingWord = undefined;
    this.activeProcessingId = null;
    this.isProcessing = false;
    setHeavyTaskActive(false);
    this.saveQueue();
    this.notifyProgress();
  }

  public retryFailed(): number {
    console.log('[SentenceQueue] Relance des tâches échouées demandée');
    let count = 0;
    for (const item of this.items) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.attempts = 0;
        item.error = undefined;
        count++;
      }
    }
    if (count > 0) {
      this.saveQueue();
      this.notifyProgress();
      this.triggerProcessing();
    }
    return count;
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  public triggerProcessing(): void {
    if (this.isProcessing || this.isPaused || this.isSessionPaused) {
      return;
    }
    this.processNextItem();
  }

  private async processNextItem(): Promise<void> {
    if (this.isPaused || this.isSessionPaused || this.isPausedForImmediate()) {
      this.isProcessing = false;
      this.currentProcessingWord = undefined;
      return;
    }

    // Si une autre tâche lourde (ex: synthèse vocale Kokoro) tourne actuellement, patienter
    if (isHeavyTaskActive()) {
      setTimeout(() => this.processNextItem(), 300);
      return;
    }

    // Récupérer le prochain élément en attente : priorité 1 d'abord, puis plus ancien
    const nextItem = this.items
      .filter((i) => i.status === 'pending')
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })[0];

    if (!nextItem) {
      this.isProcessing = false;
      this.currentProcessingWord = undefined;
      this.activeProcessingId = null;
      this.clearWatchdog();
      this.saveQueue();
      this.notifyProgress();
      return;
    }

    this.isProcessing = true;
    nextItem.status = 'processing';
    this.currentProcessingWord = nextItem.english;
    this.activeProcessingId = nextItem.id;
    this.saveQueue();
    this.notifyProgress();

    // Démarrage du Watchdog anti-blocage (60 secondes max)
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      console.warn(`[SentenceQueue Watchdog] ⚠️ Tâche expirée après 60s pour « ${nextItem.english} ». Annulation forcée.`);
      nextItem.status = 'failed';
      nextItem.error = 'Délai maximal dépassé (> 60s sans réponse)';
      setHeavyTaskActive(false);
      this.isProcessing = false;
      this.currentProcessingWord = undefined;
      this.activeProcessingId = null;
      this.saveQueue();
      this.notifyProgress();
      setTimeout(() => this.processNextItem(), 300);
    }, 60000);

    const store = getDatabaseStore();
    const db = store.load();
    const settings = db.settings;

    try {
      console.log(`[SentenceQueue] Traitement en cours de « ${nextItem.english} » (tentative ${nextItem.attempts + 1})...`);

      // Vérifier si le mot existe toujours dans la DB
      const wordInDb = db.words.find((w) => w.id === nextItem.wordId);
      if (!wordInDb) {
        console.log(`[SentenceQueue] Mot non trouvé en base pour ${nextItem.wordId}, marqué terminé.`);
        nextItem.status = 'done';
        this.clearWatchdog();
        this.saveQueue();
        this.processNextItem();
        return;
      }

      // Règle d'or : Ne JAMAIS écraser une phrase utilisateur
      if (wordInDb.example && wordInDb.exampleSource === 'user') {
        console.log(`[SentenceQueue] Mot « ${nextItem.english} » possède déjà une phrase utilisateur, préservée.`);
        nextItem.status = 'done';
        this.clearWatchdog();
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

      this.clearWatchdog();

      if (result && result.sentence) {
        console.log(`[SentenceQueue] Phrase générée avec succès pour « ${nextItem.english} » via [${result.source}]`);
        wordInDb.example = result.sentence;
        wordInDb.exampleSource = result.source;
        wordInDb.updatedAt = new Date().toISOString();
        store.save(db);

        nextItem.status = 'done';
        nextItem.source = result.source;
        nextItem.generatedSentence = result.sentence;
        nextItem.error = undefined;

        // Diffuser aux fenêtres Electron
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
        const errorReason = (result && result.error) || 'Aucun exemple valide trouvé dans la cascade';
        console.warn(`[SentenceQueue] Aucune phrase générée pour « ${nextItem.english} »: ${errorReason}`);

        nextItem.attempts += 1;
        // Si aucune source n'est installée ou si le modèle/clé manque, ne pas réessayer en boucle
        const shouldRetry =
          nextItem.attempts < 2 &&
          !errorReason.includes('non installé') &&
          !errorReason.includes('non configurée');

        if (!shouldRetry) {
          nextItem.status = 'failed';
          nextItem.error = errorReason;
        } else {
          nextItem.status = 'pending';
        }
      }
    } catch (err: any) {
      this.clearWatchdog();
      console.error(`[SentenceQueue] Exception lors du traitement de « ${nextItem.english} »:`, err);
      nextItem.attempts += 1;
      nextItem.status = nextItem.attempts >= 2 ? 'failed' : 'pending';
      nextItem.error = err.message || 'Erreur inattendue';
    } finally {
      this.clearWatchdog();
    }

    this.saveQueue();
    this.notifyProgress();

    // Respect du débit configuré (requêtes par minute)
    const rpm = settings.sentenceRequestsPerMinute || 60;
    const delayBetweenItems = Math.max(200, Math.round(60000 / rpm));

    setTimeout(() => {
      this.processNextItem();
    }, delayBetweenItems);
  }
}

export function getSentenceQueue(): SentenceQueue {
  return SentenceQueue.getInstance();
}
