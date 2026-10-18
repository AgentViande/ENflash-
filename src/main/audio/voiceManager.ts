import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { VoiceAccent, AudioEngineStatus } from '../../shared/types';
import { AVAILABLE_KOKORO_VOICES, getDefaultVoiceForAccent } from '../../shared/audio/kokoroVoices';

const KOKORO_REPO_BASE = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main';
const KOKORO_MODEL_FILES = [
  { name: 'config.json', url: `${KOKORO_REPO_BASE}/config.json`, expectedSize: 44 },
  { name: 'tokenizer.json', url: `${KOKORO_REPO_BASE}/tokenizer.json`, expectedSize: 3497 },
  { name: 'tokenizer_config.json', url: `${KOKORO_REPO_BASE}/tokenizer_config.json`, expectedSize: 113 },
  {
    name: 'onnx/model_quantized.onnx',
    url: `${KOKORO_REPO_BASE}/onnx/model_quantized.onnx`,
    expectedSize: 92361116,
  },
];

export class VoiceManager {
  private cacheDir: string;
  private userModelsDir: string;
  private window: BrowserWindow | null = null;
  private worker: Worker | null = null;
  private workerRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private isDownloading: boolean = false;
  private lastWorkerInitPromise: Promise<boolean> | null = null;

  constructor() {
    const userData = app.getPath('userData');
    this.cacheDir = path.join(userData, 'audio_cache');
    this.userModelsDir = path.join(userData, 'models');

    this.ensureDirs();
    this.initWorker();
  }

  public setWindow(win: BrowserWindow): void {
    this.window = win;
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true });
    if (!fs.existsSync(this.userModelsDir)) fs.mkdirSync(this.userModelsDir, { recursive: true });
  }

  /**
   * Trouve le dossier contenant Kokoro-82M-v1.0-ONNX
   * Priorité : 1. Packagé (process.resourcesPath) | 2. Dev (resources) | 3. userData | 4. node_modules cache
   */
  public getKokoroModelDirectory(): { modelParentDir: string; modelPath: string; isComplete: boolean } | null {
    const candidates = [
      // 1. Packagé via electron-builder extraResources
      process.resourcesPath ? path.join(process.resourcesPath, 'models') : null,
      // 2. Dev local
      path.join(app.getAppPath(), 'resources', 'models'),
      // 3. Dossier utilisateur (si téléchargé ou réparé)
      this.userModelsDir,
      // 4. Cache transformers.js local
      path.join(app.getAppPath(), 'node_modules', '@huggingface', 'transformers', '.cache', 'onnx-community'),
    ].filter(Boolean) as string[];

    for (const parentDir of candidates) {
      const modelDir = path.join(parentDir, 'Kokoro-82M-v1.0-ONNX');
      const onnxFile = path.join(modelDir, 'onnx', 'model_quantized.onnx');
      const configFile = path.join(modelDir, 'config.json');

      if (fs.existsSync(onnxFile) && fs.existsSync(configFile)) {
        try {
          const stat = fs.statSync(onnxFile);
          if (stat.size > 80000000) {
            // Modèle q8 complet présent
            return {
              modelParentDir: parentDir,
              modelPath: modelDir,
              isComplete: true,
            };
          }
        } catch {}
      }
    }

    return null;
  }

  /**
   * Initialise le Worker thread dédié à l'inférence Kokoro
   */
  private initWorker(): void {
    try {
      const workerCandidates = [
        path.join(__dirname, 'kokoroWorker.js'),
        path.join(__dirname, 'kokoroWorker.mjs'),
        path.join(app.getAppPath(), 'dist-electron', 'main', 'kokoroWorker.js'),
      ];

      const workerPath = workerCandidates.find((p) => fs.existsSync(p));
      if (!workerPath) {
        console.warn('[VoiceManager] Fichier kokoroWorker.js introuvable dans :', workerCandidates);
        return;
      }

      this.worker = new Worker(workerPath);

      this.worker.on('message', (msg: any) => {
        const { id } = msg;
        if (id && this.workerRequests.has(id)) {
          const req = this.workerRequests.get(id)!;
          this.workerRequests.delete(id);
          req.resolve(msg);
        }
      });

      this.worker.on('error', (err) => {
        console.error('[VoiceManager] Erreur dans le Worker Kokoro :', err);
      });

      this.worker.on('exit', (code) => {
        console.warn(`[VoiceManager] Worker Kokoro s'est arrêté avec le code ${code}`);
        this.worker = null;
      });

      // Lancer le pré-chargement du modèle en tâche de fond
      this.warmupModel();
    } catch (err) {
      console.error('[VoiceManager] Échec du démarrage du worker Kokoro :', err);
    }
  }

  private sendWorkerMessage(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        this.initWorker();
      }
      if (!this.worker) {
        return reject(new Error('Worker Kokoro non disponible'));
      }

      const id = crypto.randomUUID();
      const timeout = setTimeout(() => {
        if (this.workerRequests.has(id)) {
          this.workerRequests.delete(id);
          reject(new Error('Délai d’attente dépassé pour la synthèse Kokoro (15s)'));
        }
      }, 15000);

      this.workerRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timeout);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      this.worker.postMessage({ id, type, ...payload });
    });
  }

  /**
   * Pré-charge le modèle Kokoro en mémoire
   */
  public async warmupModel(): Promise<boolean> {
    const modelInfo = this.getKokoroModelDirectory();
    if (!modelInfo) return false;

    if (this.lastWorkerInitPromise) return this.lastWorkerInitPromise;

    this.lastWorkerInitPromise = (async () => {
      try {
        const res = await this.sendWorkerMessage('init', {
          modelDir: modelInfo.modelParentDir,
        });
        return Boolean(res && res.success);
      } catch (err) {
        console.warn('[VoiceManager] Warmup Kokoro échoué :', err);
        return false;
      }
    })();

    return this.lastWorkerInitPromise;
  }

  private getHash(text: string, voiceId: string, speed: number = 1.0): string {
    const norm = text.trim().toLowerCase();
    const speedTag = speed.toFixed(1);
    return crypto.createHash('md5').update(`${norm}_${voiceId}_${speedTag}`).digest('hex');
  }

  /**
   * Télécharger ou réparer le modèle Kokoro (avec progression)
   */
  public async installKokoroModel(
    onProgress?: (progress: number, label: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isDownloading) {
      return { success: true };
    }

    this.isDownloading = true;
    const destDir = path.join(this.userModelsDir, 'Kokoro-82M-v1.0-ONNX');
    const onnxSubDir = path.join(destDir, 'onnx');

    try {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      if (!fs.existsSync(onnxSubDir)) fs.mkdirSync(onnxSubDir, { recursive: true });

      const totalBytesToDownload = KOKORO_MODEL_FILES.reduce((sum, f) => sum + f.expectedSize, 0);
      let downloadedBytes = 0;

      for (let i = 0; i < KOKORO_MODEL_FILES.length; i++) {
        const fileDef = KOKORO_MODEL_FILES[i];
        const filePath = path.join(destDir, fileDef.name);

        // Si le fichier existe déjà et fait la taille attendue, on passe
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          if (stat.size >= fileDef.expectedSize * 0.95) {
            downloadedBytes += stat.size;
            continue;
          }
        }

        const label = `Téléchargement de ${path.basename(fileDef.name)}...`;
        if (onProgress) {
          const pct = Math.round((downloadedBytes / totalBytesToDownload) * 100);
          onProgress(pct, label);
        }

        const res = await fetch(fileDef.url, { redirect: 'follow' });
        if (!res.ok || !res.body) {
          throw new Error(`Échec du téléchargement de ${fileDef.name} (${res.status})`);
        }

        const chunks: Buffer[] = [];
        // @ts-ignore
        for await (const chunk of res.body) {
          chunks.push(Buffer.from(chunk));
          downloadedBytes += chunk.length;
          const pct = Math.min(100, Math.round((downloadedBytes / totalBytesToDownload) * 100));
          if (onProgress) onProgress(pct, label);
          if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send('audio:kokoroProgress', { progress: pct, label });
          }
        }

        fs.writeFileSync(filePath, Buffer.concat(chunks));
      }

      if (onProgress) onProgress(100, 'Installation terminée !');
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('audio:kokoroProgress', { progress: 100, label: 'Modèle prêt !' });
      }

      // Réinitialiser le worker avec le nouveau modèle
      this.lastWorkerInitPromise = null;
      await this.warmupModel();

      return { success: true };
    } catch (err: any) {
      console.error('[VoiceManager] Erreur installation modèle Kokoro :', err);
      return { success: false, error: err?.message || String(err) };
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Statut complet du moteur audio pour l'interface
   */
  public getAudioEngineStatus(accent: VoiceAccent = 'en-US', preferredVoiceId?: string): AudioEngineStatus {
    const modelInfo = this.getKokoroModelDirectory();
    const isKokoroReady = Boolean(modelInfo && modelInfo.isComplete);
    const cacheStats = this.getCacheStats();

    const activeVoiceId =
      preferredVoiceId && preferredVoiceId !== 'auto'
        ? preferredVoiceId
        : getDefaultVoiceForAccent(accent);

    return {
      isKokoroReady,
      modelStatus: this.isDownloading ? 'downloading' : isKokoroReady ? 'installed' : 'absent',
      modelLocation: modelInfo?.modelPath,
      activeVoiceId,
      activeAccent: accent,
      activeEngine: isKokoroReady ? 'kokoro' : 'fallback',
      cacheCount: cacheStats.count,
      cacheFormattedSize: cacheStats.formattedSize,
    };
  }

  /**
   * Statistiques du cache audio
   */
  public getCacheStats(): { count: number; totalSizeBytes: number; formattedSize: string } {
    try {
      this.ensureDirs();
      const files = fs.readdirSync(this.cacheDir);
      let totalSizeBytes = 0;
      let count = 0;

      for (const file of files) {
        try {
          const stat = fs.statSync(path.join(this.cacheDir, file));
          if (stat.isFile()) {
            count++;
            totalSizeBytes += stat.size;
          }
        } catch {}
      }

      const mb = (totalSizeBytes / (1024 * 1024)).toFixed(1);
      return {
        count,
        totalSizeBytes,
        formattedSize: `${mb} Mo`,
      };
    } catch {
      return { count: 0, totalSizeBytes: 0, formattedSize: '0 Mo' };
    }
  }

  /**
   * Vider le cache audio
   */
  public clearCache(): boolean {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(this.cacheDir, file));
          } catch {}
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Synthèse via Kokoro dans le Worker
   */
  private async synthesizeWithKokoro(
    text: string,
    voiceId: string,
    speed: number,
    cachedWavPath: string
  ): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
    const modelInfo = this.getKokoroModelDirectory();
    if (!modelInfo) {
      return { success: false, error: 'Modèle Kokoro absent du système' };
    }

    try {
      const res = await this.sendWorkerMessage('synthesize', {
        modelDir: modelInfo.modelParentDir,
        text,
        voice: voiceId,
        speed,
      });

      if (res && res.success && res.wavBase64) {
        // Sauvegarder dans le cache local sur le disque
        try {
          const buf = Buffer.from(res.wavBase64, 'base64');
          fs.writeFileSync(cachedWavPath, buf);
        } catch {}

        return {
          success: true,
          dataUrl: `data:audio/wav;base64,${res.wavBase64}`,
        };
      }

      return {
        success: false,
        error: res?.error || 'Échec de la génération Kokoro',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || String(err),
      };
    }
  }

  /**
   * Récupérer un enregistrement humain gratuit via Free Dictionary API (mots seuls)
   */
  private async fetchDictionaryApiAudio(
    word: string,
    accent: VoiceAccent,
    outputMp3Path: string
  ): Promise<boolean> {
    try {
      const cleanWord = word.trim().toLowerCase();
      if (cleanWord.includes(' ') || cleanWord.length > 40) return false;

      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`;
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) return false;

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return false;

      const phonetics: Array<{ audio?: string }> = data[0]?.phonetics || [];
      const audios = phonetics.map((p) => p.audio).filter((a): a is string => Boolean(a && a.endsWith('.mp3')));

      if (audios.length === 0) return false;

      const accentTag = accent === 'en-GB' ? '-uk.mp3' : '-us.mp3';
      let selectedAudioUrl = audios.find((a) => a.toLowerCase().includes(accentTag));
      if (!selectedAudioUrl) selectedAudioUrl = audios[0];
      if (!selectedAudioUrl) return false;

      const audioRes = await fetch(selectedAudioUrl, { redirect: 'follow' });
      if (!audioRes.ok) return false;

      const buffer = Buffer.from(await audioRes.arrayBuffer());
      fs.writeFileSync(outputMp3Path, buffer);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cascade audio principale :
   * 1. Cache local
   * 2. Kokoro-82M (TTS neuronal haute qualité par défaut)
   * 3. DictionaryAPI (enregistrements humains mots seuls)
   * 4. Fallback système
   */
  public async getAudioDataUrl(
    text: string,
    accent: VoiceAccent = 'en-US',
    preferredVoiceId?: string,
    speed: number = 1.0
  ): Promise<{
    success: boolean;
    dataUrl?: string;
    source: 'cache' | 'kokoro' | 'dictionary' | 'fallback';
    voiceUsed?: string;
    error?: string;
  }> {
    if (!text || !text.trim()) {
      return { success: false, source: 'fallback', error: 'Texte vide' };
    }

    const cleanText = text.trim();
    const effectiveVoiceId =
      preferredVoiceId && preferredVoiceId !== 'auto'
        ? preferredVoiceId
        : getDefaultVoiceForAccent(accent);

    const hash = this.getHash(cleanText, effectiveVoiceId, speed);
    const cachedWav = path.join(this.cacheDir, `${hash}.wav`);
    const cachedMp3 = path.join(this.cacheDir, `${hash}.mp3`);

    // 1. PALIER 1 : CACHE LOCAL DISQUE
    if (fs.existsSync(cachedWav)) {
      try {
        const data = fs.readFileSync(cachedWav).toString('base64');
        return {
          success: true,
          dataUrl: `data:audio/wav;base64,${data}`,
          source: 'cache',
          voiceUsed: effectiveVoiceId,
        };
      } catch {}
    }
    if (fs.existsSync(cachedMp3)) {
      try {
        const data = fs.readFileSync(cachedMp3).toString('base64');
        return {
          success: true,
          dataUrl: `data:audio/mp3;base64,${data}`,
          source: 'cache',
          voiceUsed: effectiveVoiceId,
        };
      } catch {}
    }

    // 2. PALIER 2 : MOTEUR NEURONAL LOCAL KOKORO-82M
    const modelInfo = this.getKokoroModelDirectory();
    if (modelInfo) {
      const kokoroRes = await this.synthesizeWithKokoro(cleanText, effectiveVoiceId, speed, cachedWav);
      if (kokoroRes.success && kokoroRes.dataUrl) {
        return {
          success: true,
          dataUrl: kokoroRes.dataUrl,
          source: 'kokoro',
          voiceUsed: effectiveVoiceId,
        };
      } else {
        console.warn('[VoiceManager] Kokoro a échoué pour ce texte, descente dans la cascade :', kokoroRes.error);
      }
    } else {
      console.warn('[VoiceManager] Modèle Kokoro absent, tentative téléchargement silencieux en arrière-plan...');
      this.installKokoroModel().catch(() => {});
    }

    // 3. PALIER 3 : ENREGISTREMENTS HUMAINS (dictionaryapi.dev pour les mots seuls)
    const isSingleWord = !cleanText.includes(' ') && cleanText.length < 35;
    if (isSingleWord) {
      const ok = await this.fetchDictionaryApiAudio(cleanText, accent, cachedMp3);
      if (ok && fs.existsSync(cachedMp3)) {
        try {
          const data = fs.readFileSync(cachedMp3).toString('base64');
          return {
            success: true,
            dataUrl: `data:audio/mp3;base64,${data}`,
            source: 'dictionary',
            voiceUsed: 'human-dictionary',
          };
        } catch {}
      }
    }

    // 4. PALIER 4 : VOIX SYSTÈME EN DERNIER RECOURS
    return {
      success: false,
      source: 'fallback',
      voiceUsed: 'system',
      error: 'Audio non disponible via Kokoro/Dictionary, bascule vers la voix système de secours',
    };
  }

  /**
   * Génère une phrase de test pour comparaison Kokoro vs Voix Système
   */
  public async getComparisonSample(
    accent: VoiceAccent,
    preferredVoiceId?: string
  ): Promise<{ kokoroDataUrl?: string; sampleText: string }> {
    const sampleText = 'The quick brown fox jumps over the lazy dog and discovers the beauty of natural speech.';
    const voiceId =
      preferredVoiceId && preferredVoiceId !== 'auto'
        ? preferredVoiceId
        : getDefaultVoiceForAccent(accent);

    const res = await this.getAudioDataUrl(sampleText, accent, voiceId, 1.0);
    return {
      sampleText,
      kokoroDataUrl: res.success ? res.dataUrl : undefined,
    };
  }
}

let voiceManagerInstance: VoiceManager | null = null;
export function getVoiceManager(): VoiceManager {
  if (!voiceManagerInstance) {
    voiceManagerInstance = new VoiceManager();
  }
  return voiceManagerInstance;
}
