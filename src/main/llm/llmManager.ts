import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import {
  LocalLlmStatus,
  LocalLlmModelType,
  SystemHardwareInfo,
  SpeedTestResult,
  ExampleSourceType,
} from '../../shared/types';
import { validateSentenceQuality } from './qualityControl';
import { getSentenceQueue } from './sentenceQueue';

export interface ModelMetadata {
  id: LocalLlmModelType;
  name: string;
  fileName: string;
  url: string;
  expectedSize: number;
  expectedSha256: string;
  sizeFormatted: string;
}

export const LLM_MODELS: Record<LocalLlmModelType, ModelMetadata> = {
  standard: {
    id: 'standard',
    name: 'Qwen2.5-1.5B-Instruct (Recommandé)',
    fileName: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    expectedSize: 1117320736,
    expectedSha256: '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e',
    sizeFormatted: '1,04 Go',
  },
  light: {
    id: 'light',
    name: 'Qwen2.5-0.5B-Instruct (Léger)',
    fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    expectedSize: 491400032,
    expectedSha256: '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db',
    sizeFormatted: '468 Mo',
  },
};

// Verrou global inter-processus pour coordonner les tâches lourdes (LLM + Kokoro)
let isHeavyTaskRunning = false;
export function isHeavyTaskActive(): boolean {
  return isHeavyTaskRunning;
}
export function setHeavyTaskActive(active: boolean): void {
  isHeavyTaskRunning = active;
}

export class LlmManager {
  private static instance: LlmManager;
  private modelsDir: string;
  private worker: Worker | null = null;
  private workerRequests = new Map<
    string,
    { resolve: (val: any) => void; reject: (err: any) => void }
  >();
  private activeDownloadController: AbortController | null = null;
  private currentDownloadingModel: LocalLlmModelType | null = null;
  private isGenerating = false;
  private unloadTimeout: NodeJS.Timeout | null = null;
  private isLoaded = false;
  private currentLoadedModelType: LocalLlmModelType | null = null;

  // Mesures de performance pour auto-adaptation
  private lastGenerationDurationMs: number = 0;
  private generationDurations: number[] = [];

  private constructor() {
    this.modelsDir = path.join(app.getPath('userData'), 'models', 'llm');
    this.ensureDirs();
  }

  public static getInstance(): LlmManager {
    if (!LlmManager.instance) {
      LlmManager.instance = new LlmManager();
    }
    return LlmManager.instance;
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  public getModelPath(modelType: LocalLlmModelType): string {
    const meta = LLM_MODELS[modelType];
    return path.join(this.modelsDir, meta.fileName);
  }

  public isModelInstalled(modelType: LocalLlmModelType): boolean {
    const filePath = this.getModelPath(modelType);
    if (!fs.existsSync(filePath)) return false;
    try {
      const stat = fs.statSync(filePath);
      // Fichier d'au moins 95% de la taille attendue
      return stat.size >= LLM_MODELS[modelType].expectedSize * 0.95;
    } catch {
      return false;
    }
  }

  public getLastGenerationDuration(): number {
    return this.lastGenerationDurationMs;
  }

  public getAverageGenerationDuration(): number {
    if (this.generationDurations.length === 0) return 0;
    const sum = this.generationDurations.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.generationDurations.length);
  }

  public getRecommendedModel(): LocalLlmModelType {
    const avg = this.getAverageGenerationDuration();
    if (avg > 3000 || this.lastGenerationDurationMs > 3500) {
      return 'light';
    }
    return 'standard';
  }

  public getHardwareInfo(): SystemHardwareInfo {
    const totalRamGB = Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10;
    const freeRamGB = Math.round((os.freemem() / (1024 ** 3)) * 10) / 10;
    const cpuCores = os.cpus()?.length || 4;
    const cpuModel = os.cpus()?.[0]?.model || 'CPU standard';

    let ramTier: 'optimal' | 'warning' | 'insufficient' = 'optimal';
    let recommendation =
      'Votre système dispose d’une mémoire amplement suffisante pour exécuter le modèle standard (1,5B).';

    if (totalRamGB < 3.0) {
      ramTier = 'insufficient';
      recommendation =
        'Moins de 3 Go de RAM détectés : l’utilisation d’un modèle de langage local est déconseillée sur cette machine.';
    } else if (totalRamGB < 4.0) {
      ramTier = 'warning';
      recommendation =
        'Entre 3 et 4 Go de RAM : nous vous recommandons fortement d’utiliser le modèle Léger (0,5B).';
    }

    return {
      totalRamGB,
      freeRamGB,
      cpuCores,
      cpuModel,
      ramTier,
      recommendation,
    };
  }

  public getStatus(modelType: LocalLlmModelType = 'standard'): LocalLlmStatus {
    const isInstalled = this.isModelInstalled(modelType);
    const meta = LLM_MODELS[modelType];
    let modelSizeBytes = 0;

    const filePath = this.getModelPath(modelType);
    if (fs.existsSync(filePath)) {
      try {
        modelSizeBytes = fs.statSync(filePath).size;
      } catch {}
    }

    const mb = Math.round(modelSizeBytes / (1024 * 1024));
    const sizeFormatted = mb > 1000 ? `${(mb / 1024).toFixed(2)} Go` : `${mb} Mo`;
    const avg = this.getAverageGenerationDuration();

    return {
      isEnabled: isInstalled,
      modelType,
      isInstalled,
      isDownloading: this.currentDownloadingModel === modelType,
      downloadProgress: 0,
      isLoaded: this.isLoaded && this.currentLoadedModelType === modelType,
      isGenerating: this.isGenerating,
      modelSizeBytes,
      modelSizeFormatted: isInstalled ? sizeFormatted : meta.sizeFormatted,
      lastGenerationDurationMs: this.lastGenerationDurationMs,
      averageGenerationDurationMs: avg,
      recommendedModel: this.getRecommendedModel(),
    };
  }

  // --- Initialisation et cycle de vie du Worker ---
  private async getWorker(): Promise<Worker> {
    if (this.worker) return this.worker;

    let workerPath = path.join(__dirname, 'llmWorker.js');
    if (!fs.existsSync(workerPath)) {
      // Fallback mode dev
      workerPath = path.join(__dirname, '../llm/llmWorker.js');
    }

    this.worker = new Worker(workerPath);

    this.worker.on('message', (msg: any) => {
      // 1. Relais des événements de statut en direct vers toutes les fenêtres
      if (msg.type === 'status_update') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send('llm:statusUpdate', {
              state: msg.state,
              message: msg.message,
            });
          }
        }
        return;
      }

      // 2. Relais des tokens générés en temps réel (streaming)
      if (msg.type === 'token_chunk') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send('llm:tokenChunk', {
              chunk: msg.chunk,
              fullText: msg.fullText,
            });
          }
        }
        return;
      }

      const req = this.workerRequests.get(msg.id);
      if (!req) return;

      this.workerRequests.delete(msg.id);
      if (msg.error) {
        req.reject(new Error(msg.error));
      } else {
        req.resolve(msg);
      }
    });

    this.worker.on('error', (err) => {
      console.error('[LlmManager] Erreur fatale dans le worker LLM:', err);
      this.worker = null;
      this.isLoaded = false;
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`[LlmManager] Le worker LLM s’est arrêté avec le code ${code}`);
      }
      this.worker = null;
      this.isLoaded = false;
    });

    return this.worker;
  }

  private resetIdleTimeout(): void {
    if (this.unloadTimeout) {
      clearTimeout(this.unloadTimeout);
    }

    // Déchargement automatique après 3 minutes d'inactivité (180 000 ms)
    this.unloadTimeout = setTimeout(() => {
      this.unloadModel().catch(() => {});
    }, 180000);
  }

  public async unloadModel(): Promise<void> {
    if (!this.worker || !this.isLoaded) return;
    try {
      const id = crypto.randomUUID();
      await new Promise<void>((resolve, reject) => {
        this.workerRequests.set(id, {
          resolve: () => resolve(),
          reject,
        });
        this.worker?.postMessage({ type: 'unload', id });
      });
      this.isLoaded = false;
      this.currentLoadedModelType = null;
      console.log('[LlmManager] Modèle LLM déchargé de la mémoire (RAM libérée).');
    } catch (err) {
      console.warn('[LlmManager] Erreur lors du déchargement du modèle:', err);
    }
  }

  // --- Préchauffage du modèle en arrière-plan ---
  public async preloadModel(modelType: LocalLlmModelType = 'standard'): Promise<boolean> {
    if (!this.isModelInstalled(modelType)) {
      return false;
    }
    if (this.isLoaded && this.currentLoadedModelType === modelType) {
      this.resetIdleTimeout();
      return true;
    }

    try {
      console.log(`[LlmManager] Préchauffage du modèle local ${modelType}...`);
      const worker = await this.getWorker();
      const modelPath = this.getModelPath(modelType);
      const id = crypto.randomUUID();

      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('llm:statusUpdate', {
            state: 'loading_model',
            modelType,
            message: 'Préchauffage du modèle en arrière-plan...',
          });
        }
      }

      const res = await new Promise<any>((resolve, reject) => {
        this.workerRequests.set(id, { resolve, reject });
        worker.postMessage({
          type: 'preload',
          id,
          modelPath,
        });
      });

      this.isLoaded = true;
      this.currentLoadedModelType = modelType;
      this.resetIdleTimeout();

      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('llm:statusUpdate', {
            state: 'idle',
            modelType,
          });
        }
      }

      console.log(`[LlmManager] Modèle ${modelType} préchauffé avec succès (${res?.loadDurationMs || 0} ms).`);
      return true;
    } catch (err) {
      console.warn(`[LlmManager] Erreur préchauffage modèle ${modelType}:`, err);
      return false;
    }
  }

  // --- Téléchargement résilient avec reprise HTTP (Range) ---
  public async downloadModel(
    modelType: LocalLlmModelType = 'standard'
  ): Promise<{ success: boolean; error?: string }> {
    if (this.currentDownloadingModel) {
      return { success: false, error: 'Un téléchargement est déjà en cours' };
    }

    const meta = LLM_MODELS[modelType];
    this.ensureDirs();
    const targetPath = this.getModelPath(modelType);
    const tempPath = `${targetPath}.tmp`;

    this.currentDownloadingModel = modelType;
    this.activeDownloadController = new AbortController();

    const notifyProgress = (data: {
      progress: number;
      loadedBytes: number;
      totalBytes: number;
      speedFormatted?: string;
    }) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('llm:downloadProgress', {
            modelType,
            ...data,
          });
        }
      }
    };

    try {
      let existingBytes = 0;
      if (fs.existsSync(tempPath)) {
        try {
          existingBytes = fs.statSync(tempPath).size;
        } catch {
          existingBytes = 0;
        }
      }

      const headers: Record<string, string> = {};
      if (existingBytes > 0 && existingBytes < meta.expectedSize) {
        headers['Range'] = `bytes=${existingBytes}-`;
        console.log(`[LlmManager] Reprise du téléchargement à ${existingBytes} octets...`);
      } else if (existingBytes >= meta.expectedSize) {
        existingBytes = 0;
        fs.unlinkSync(tempPath);
      }

      const response = await fetch(meta.url, {
        headers,
        signal: this.activeDownloadController.signal,
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status} : ${response.statusText}`);
      }

      const isRange = response.status === 206;
      let totalBytes = meta.expectedSize;
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const len = parseInt(contentLengthHeader, 10);
        totalBytes = isRange ? existingBytes + len : len;
      }

      const fileStream = fs.createWriteStream(tempPath, {
        flags: isRange ? 'a' : 'w',
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Flux de réponse inaccessible');

      let receivedBytes = existingBytes;
      let lastReportTime = Date.now();
      let lastReportBytes = receivedBytes;
      let speedFormatted = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(Buffer.from(value));
        receivedBytes += value.length;

        const now = Date.now();
        if (now - lastReportTime >= 500) {
          const deltaBytes = receivedBytes - lastReportBytes;
          const deltaTime = (now - lastReportTime) / 1000;
          const bytesPerSec = deltaBytes / deltaTime;
          const mbPerSec = bytesPerSec / (1024 * 1024);
          speedFormatted = `${mbPerSec.toFixed(1)} Mo/s`;

          const progress = Math.round((receivedBytes / totalBytes) * 100);
          notifyProgress({
            progress,
            loadedBytes: receivedBytes,
            totalBytes,
            speedFormatted,
          });

          lastReportTime = now;
          lastReportBytes = receivedBytes;
        }
      }

      fileStream.end();

      // Renommer le fichier temporaire en fichier final
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      fs.renameSync(tempPath, targetPath);

      notifyProgress({
        progress: 100,
        loadedBytes: totalBytes,
        totalBytes,
      });

      console.log(`[LlmManager] Modèle ${meta.name} installé avec succès !`);
      return { success: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LlmManager] Téléchargement annulé par l’utilisateur.');
        return { success: false, error: 'Téléchargement annulé' };
      }
      console.error('[LlmManager] Erreur téléchargement modèle:', err);
      return { success: false, error: err.message };
    } finally {
      this.currentDownloadingModel = null;
      this.activeDownloadController = null;
    }
  }

  public cancelDownload(): boolean {
    if (this.activeDownloadController) {
      this.activeDownloadController.abort();
      this.activeDownloadController = null;
      this.currentDownloadingModel = null;
      return true;
    }
    return false;
  }

  public deleteModel(modelType: LocalLlmModelType = 'standard'): boolean {
    this.cancelDownload();
    const filePath = this.getModelPath(modelType);
    const tempPath = `${filePath}.tmp`;

    try {
      if (this.isLoaded && this.currentLoadedModelType === modelType) {
        this.unloadModel();
      }
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      return true;
    } catch (err) {
      console.error('[LlmManager] Erreur suppression modèle:', err);
      return false;
    }
  }

  // --- Test de vitesse / Benchmark ---
  public async testSpeed(modelType: LocalLlmModelType = 'standard'): Promise<SpeedTestResult> {
    if (!this.isModelInstalled(modelType)) {
      throw new Error('Le modèle sélectionné n’est pas encore installé');
    }

    const worker = await this.getWorker();
    const modelPath = this.getModelPath(modelType);
    const id = crypto.randomUUID();

    this.isGenerating = true;
    setHeavyTaskActive(true);

    try {
      const response = await new Promise<any>((resolve, reject) => {
        this.workerRequests.set(id, { resolve, reject });
        worker.postMessage({
          type: 'benchmark',
          id,
          modelPath,
        });
      });

      this.isLoaded = true;
      this.currentLoadedModelType = modelType;
      this.resetIdleTimeout();

      return response.data as SpeedTestResult;
    } finally {
      this.isGenerating = false;
      setHeavyTaskActive(false);
    }
  }

  // --- Génération locale d'une phrase avec contrôle qualité ---
  public async generateSentenceWithLocalLlm(params: {
    english: string;
    french: string;
    definition?: string;
    partOfSpeech?: string;
    modelType?: LocalLlmModelType;
  }): Promise<{
    success: boolean;
    sentence?: string;
    error?: string;
    durationMs?: number;
    loadDurationMs?: number;
    generationDurationMs?: number;
    tokensPerSec?: number;
  }> {
    const modelType = params.modelType || 'standard';
    if (!this.isModelInstalled(modelType)) {
      return { success: false, error: 'Modèle LLM non installé' };
    }

    const worker = await this.getWorker();
    const modelPath = this.getModelPath(modelType);
    const id = crypto.randomUUID();

    this.isGenerating = true;
    setHeavyTaskActive(true);

    // Timeouts séparés : 90 s allouées au chargement disque vers RAM si démarrage à froid, 25 s pour la génération
    const isModelWarm = this.isLoaded && this.currentLoadedModelType === modelType;
    const timeoutMs = isModelWarm ? 25000 : 115000;

    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            isModelWarm
              ? 'Délai maximal de génération dépassé (25s)'
              : 'Délai maximal de chargement du modèle dépassé (90s)'
          )
        );
      }, timeoutMs);
    });

    try {
      const genPromise = new Promise<any>((resolve, reject) => {
        this.workerRequests.set(id, { resolve, reject });
        worker.postMessage({
          type: 'generate',
          id,
          modelPath,
          english: params.english,
          french: params.french,
          definition: params.definition,
          partOfSpeech: params.partOfSpeech,
          maxAttempts: 2,
        });
      });

      const response = await Promise.race([genPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      this.isLoaded = true;
      this.currentLoadedModelType = modelType;
      this.resetIdleTimeout();

      if (response.generationDurationMs) {
        this.lastGenerationDurationMs = response.generationDurationMs;
        this.generationDurations.push(response.generationDurationMs);
        if (this.generationDurations.length > 20) {
          this.generationDurations.shift();
        }
      }

      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('llm:statusUpdate', {
            state: 'idle',
            modelType,
          });
        }
      }

      if (response.success && response.sentence) {
        return {
          success: true,
          sentence: response.sentence,
          durationMs: response.durationMs,
          loadDurationMs: response.loadDurationMs,
          generationDurationMs: response.generationDurationMs,
          tokensPerSec: response.tokensPerSec,
        };
      }
      return { success: false, error: response.error || 'Qualité non conforme' };
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('llm:statusUpdate', {
            state: 'idle',
            modelType,
          });
        }
      }
      return { success: false, error: err.message };
    } finally {
      this.isGenerating = false;
      setHeavyTaskActive(false);
    }
  }

  // --- Recherche dans le dictionnaire en ligne avec repli intelligent sur les pluriels ---
  public async fetchDictionaryExample(
    englishWord: string,
    skipSentence?: string
  ): Promise<{ sentence?: string; allExamples?: string[]; definition?: string; partOfSpeech?: string } | null> {
    const tryQuery = async (word: string): Promise<{ data: any[]; clean: string } | null> => {
      try {
        const clean = word.trim().toLowerCase();
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        return { data, clean };
      } catch {
        return null;
      }
    };

    const clean = englishWord.trim().toLowerCase();
    let queryRes = await tryQuery(clean);

    // Repli intelligent : si 404 et mot au pluriel (se termine par 's'), tenter la forme de base (ex: flaps -> flap, runways -> runway)
    if (!queryRes && clean.endsWith('s') && !clean.endsWith('ss')) {
      if (clean.endsWith('ies') && clean.length > 4) {
        queryRes = await tryQuery(clean.slice(0, -3) + 'y');
      } else if (clean.endsWith('es') && clean.length > 3) {
        queryRes = (await tryQuery(clean.slice(0, -2))) || (await tryQuery(clean.slice(0, -1)));
      } else if (clean.length > 2) {
        queryRes = await tryQuery(clean.slice(0, -1));
      }
    }

    if (!queryRes) return null;
    const { data } = queryRes;

    try {
      const foundExamples: string[] = [];
      let foundDefinition: string | undefined;
      let foundPartOfSpeech: string | undefined;

      for (const entry of data) {
        if (!entry.meanings) continue;
        for (const meaning of entry.meanings) {
          if (!foundPartOfSpeech && meaning.partOfSpeech) {
            foundPartOfSpeech = meaning.partOfSpeech;
          }
          if (meaning.definitions) {
            for (const def of meaning.definitions) {
              if (!foundDefinition && def.definition) {
                foundDefinition = def.definition;
              }
              if (def.example) {
                const qc = validateSentenceQuality(def.example, clean);
                if (qc.isValid && qc.cleanSentence && !foundExamples.includes(qc.cleanSentence)) {
                  foundExamples.push(qc.cleanSentence);
                }
              }
            }
          }
        }
      }

      let chosenSentence: string | undefined = undefined;
      if (foundExamples.length > 0) {
        const different = skipSentence
          ? foundExamples.filter((s) => s.toLowerCase() !== skipSentence.trim().toLowerCase())
          : foundExamples;
        chosenSentence = different.length > 0 ? different[0] : foundExamples[0];
      }

      return {
        sentence: chosenSentence,
        allExamples: foundExamples,
        definition: foundDefinition,
        partOfSpeech: foundPartOfSpeech,
      };
    } catch {
      return null;
    }
  }

  // --- Génération par API distante facultative (Qualité+ / OpenAI / Groq) ---
  public async generateSentenceWithApi(params: {
    english: string;
    french: string;
    apiKey: string;
    apiEndpoint?: string;
  }): Promise<{ success: boolean; sentence?: string; error?: string }> {
    try {
      const endpoint = params.apiEndpoint || 'https://api.openai.com/v1';
      const url = `${endpoint.replace(/\/+$/, '')}/chat/completions`;

      const systemPrompt =
        'You are an English teacher. Output ONLY one natural English example sentence (A2-B1 level, 8-15 words) using the specified word in the intended French sense. No quotes, no intro.';
      const userPrompt = `Word: ${params.english} (French: ${params.french})`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 40,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        return { success: false, error: `Erreur API: HTTP ${res.status}` };
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content || '';
      const qc = validateSentenceQuality(content, params.english);

      if (qc.isValid && qc.cleanSentence) {
        return { success: true, sentence: qc.cleanSentence };
      }
      return { success: false, error: 'Réponse API non conforme au contrôle qualité' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // --- Exécution de la cascade complète avec priorité absolue et repli intelligent ---
  public async resolveSentenceCascade(params: {
    english: string;
    french: string;
    existingExample?: string;
    existingSource?: ExampleSourceType;
    cascadeOrder?: ExampleSourceType[];
    localLlmEnabled?: boolean;
    localLlmModel?: LocalLlmModelType;
    aiApiKey?: string;
    aiApiEndpoint?: string;
    skipSentence?: string;
    priority?: 'normal' | 'immediate';
  }): Promise<{
    sentence?: string;
    source?: ExampleSourceType;
    error?: string;
    durationMs?: number;
    isSlow?: boolean;
    recommendedModel?: LocalLlmModelType;
    backgroundIaSentence?: string;
  } | null> {
    console.log(
      `[LlmManager] Début résolution cascade pour "${params.english}" (fr: "${params.french}", priorite: ${
        params.priority || 'normal'
      })`
    );

    // Règle 1 : Phrase écrite ou modifiée par l'utilisateur => JAMAIS écrasée (sauf si skipSentence explicitement demandé)
    if (params.existingExample && params.existingSource === 'user' && !params.skipSentence) {
      console.log(`[LlmManager] Phrase existante utilisateur conservée pour "${params.english}".`);
      return { sentence: params.existingExample, source: 'user' };
    }

    const isImmediate = params.priority === 'immediate';
    const queue = getSentenceQueue();
    if (isImmediate) {
      queue.pauseForImmediateRequest();
    }

    try {
      const order: ExampleSourceType[] = params.cascadeOrder || [
        'user',
        'dictionary',
        'local_llm',
        'api',
      ];

      const modelType = params.localLlmModel || 'standard';
      const isLocalInstalled = this.isModelInstalled(modelType);
      const shouldRunParallel = isImmediate && params.localLlmEnabled && isLocalInstalled;

      // Recherche dictionnaire lancée immédiatement
      const dictPromise = this.fetchDictionaryExample(params.english, params.skipSentence);

      // Si mode immédiat et modèle local activé : parallélisation dictionnaire et modèle local
      if (shouldRunParallel) {
        console.log(`[LlmManager] Mode instantané parallèle activé pour "${params.english}"`);

        // Test ultra-rapide (< 450ms) du dictionnaire
        const quickDict = await Promise.race([
          dictPromise,
          new Promise<null>((r) => setTimeout(() => r(null), 450)),
        ]);

        if (quickDict && quickDict.sentence) {
          const qc = validateSentenceQuality(quickDict.sentence, params.english);
          if (qc.isValid && qc.cleanSentence) {
            console.log(
              `[LlmManager] Succès Dictionnaire ultra-rapide pour "${params.english}": « ${qc.cleanSentence} »`
            );

            // Continuer la génération locale en tâche de fond pour proposer le remplacement si meilleure phrase IA
            this.generateSentenceWithLocalLlm({
              english: params.english,
              french: params.french,
              definition: quickDict.definition,
              partOfSpeech: quickDict.partOfSpeech,
              modelType,
            })
              .then((bgRes) => {
                if (bgRes.success && bgRes.sentence) {
                  console.log(
                    `[LlmManager] Phrase IA en arrière-plan prête pour "${params.english}" : « ${bgRes.sentence} »`
                  );
                  const windows = BrowserWindow.getAllWindows();
                  for (const win of windows) {
                    if (!win.isDestroyed()) {
                      win.webContents.send('llm:backgroundSentenceReady', {
                        english: params.english,
                        sentence: bgRes.sentence,
                        source: 'local_llm',
                      });
                    }
                  }
                }
              })
              .catch(() => {});

            return {
              sentence: qc.cleanSentence,
              source: 'dictionary',
            };
          }
        }
      }

      // Évaluation séquentielle de la cascade
      const dictContext = await dictPromise.catch(() => null);
      const failureReasons: string[] = [];

      for (const source of order) {
        if (source === 'user') {
          if (params.existingExample && params.existingSource === 'user' && !params.skipSentence) {
            return { sentence: params.existingExample, source: 'user' };
          }
        } else if (source === 'dictionary') {
          console.log(`[LlmManager] [Étape 1] Test source Dictionnaire pour "${params.english}"...`);
          if (dictContext && dictContext.sentence) {
            const qc = validateSentenceQuality(dictContext.sentence, params.english);
            if (qc.isValid && qc.cleanSentence) {
              console.log(`[LlmManager] Succès Dictionnaire pour "${params.english}": « ${qc.cleanSentence} »`);
              return { sentence: qc.cleanSentence, source: 'dictionary' };
            } else {
              failureReasons.push('Exemple dictionnaire rejeté par le contrôle qualité');
            }
          } else {
            console.log(`[LlmManager] Dictionnaire : aucun exemple d’usage pour "${params.english}".`);
            failureReasons.push('Aucun exemple dans le dictionnaire en ligne');
          }
        } else if (source === 'local_llm') {
          console.log(`[LlmManager] [Étape 2] Test source Modèle local pour "${params.english}"...`);
          if (params.localLlmEnabled) {
            if (isLocalInstalled) {
              console.log(`[LlmManager] Modèle local ${modelType} prêt. Lancement de la génération...`);
              const llmRes = await this.generateSentenceWithLocalLlm({
                english: params.english,
                french: params.french,
                definition: dictContext?.definition,
                partOfSpeech: dictContext?.partOfSpeech,
                modelType,
              });

              if (llmRes.success && llmRes.sentence) {
                console.log(`[LlmManager] Succès Modèle local pour "${params.english}": « ${llmRes.sentence} »`);
                const isSlow = (llmRes.generationDurationMs || 0) > 3500;
                return {
                  sentence: llmRes.sentence,
                  source: 'local_llm',
                  durationMs: llmRes.durationMs,
                  isSlow,
                  recommendedModel: this.getRecommendedModel(),
                };
              } else {
                console.warn(`[LlmManager] Échec génération locale pour "${params.english}":`, llmRes.error);
                failureReasons.push(`Modèle local: ${llmRes.error || 'non conforme'}`);

                // Repli intelligent : si le modèle local échoue mais que le dictionnaire avait un exemple
                if (dictContext && dictContext.sentence) {
                  const qc = validateSentenceQuality(dictContext.sentence, params.english);
                  if (qc.isValid && qc.cleanSentence) {
                    console.log(
                      `[LlmManager] Repli intelligent réussi sur le dictionnaire pour "${params.english}": « ${qc.cleanSentence} »`
                    );
                    return { sentence: qc.cleanSentence, source: 'dictionary' };
                  }
                }
              }
            } else {
              console.log(`[LlmManager] Modèle local activé mais fichier non installé (${modelType}).`);
              failureReasons.push('Modèle local non installé');
            }
          } else {
            console.log(`[LlmManager] Modèle local désactivé dans les paramètres.`);
            failureReasons.push('Modèle local désactivé');
          }
        } else if (source === 'api') {
          console.log(`[LlmManager] [Étape 3] Test source Clé API pour "${params.english}"...`);
          if (params.aiApiKey && params.aiApiKey.trim().length > 0) {
            const apiRes = await this.generateSentenceWithApi({
              english: params.english,
              french: params.french,
              apiKey: params.aiApiKey,
              apiEndpoint: params.aiApiEndpoint,
            });

            if (apiRes.success && apiRes.sentence) {
              console.log(`[LlmManager] Succès Clé API pour "${params.english}": « ${apiRes.sentence} »`);
              return { sentence: apiRes.sentence, source: 'api' };
            } else {
              console.warn(`[LlmManager] Échec API pour "${params.english}":`, apiRes.error);
              failureReasons.push(`API: ${apiRes.error || 'erreur'}`);
            }
          } else {
            console.log(`[LlmManager] Clé API non configurée.`);
            failureReasons.push('Clé API non configurée');
          }
        }
      }

      // Aucune source n'a pu fournir de phrase valide
      let detailedError = 'Aucun résultat trouvé dans la cascade';
      const hasApiKey = Boolean(params.aiApiKey && params.aiApiKey.trim().length > 0);

      if (!isLocalInstalled && !hasApiKey) {
        detailedError = 'Aucun exemple dans le dictionnaire • Modèle local non installé • Clé API non configurée';
      } else if (failureReasons.length > 0) {
        detailedError = failureReasons.join(' | ');
      }

      console.warn(`[LlmManager] Fin cascade pour "${params.english}" : ${detailedError}`);
      return {
        sentence: undefined,
        source: undefined,
        error: detailedError,
        recommendedModel: this.getRecommendedModel(),
      };
    } finally {
      if (isImmediate) {
        queue.resumeAfterImmediateRequest();
      }
    }
  }
}

export function getLlmManager(): LlmManager {
  return LlmManager.getInstance();
}
