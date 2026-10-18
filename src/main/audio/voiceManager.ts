import { app, BrowserWindow, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { VoiceAccent, AudioEngineStatus, AudioVoiceStatus } from '../../shared/types';
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

export interface CacheIndexEntry {
  text: string;
  voiceId: string;
  speed: number;
  format: 'wav' | 'mp3';
  sizeBytes: number;
  createdAt: string;
  fileName: string;
}

export interface ClearCacheResult {
  success: boolean;
  freedBytes: number;
  freedFormatted: string;
  deletedCount: number;
  failedFiles?: string[];
  error?: string;
}

export interface PreloadItem {
  text: string;
  accent?: VoiceAccent;
  voiceId?: string;
  speed?: number;
}

export class VoiceManager {
  public static readonly CACHE_VERSION = 'v2';
  private cacheDir: string;
  private userModelsDir: string;
  private window: BrowserWindow | null = null;
  private worker: Worker | null = null;
  private workerRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private isDownloading: boolean = false;
  private lastWorkerInitPromise: Promise<boolean> | null = null;

  // Index de cache en mémoire
  private cacheIndex: Map<string, CacheIndexEntry> = new Map();
  private indexFilePath: string;

  // File d'attente de pré-génération anticipée en arrière-plan
  private preloadQueue: PreloadItem[] = [];
  private isPreloading: boolean = false;
  private preloadTotal: number = 0;
  private preloadCompleted: number = 0;

  constructor() {
    const userData = app.getPath('userData');
    this.cacheDir = path.join(userData, 'audio_cache');
    this.userModelsDir = path.join(userData, 'models');
    this.indexFilePath = path.join(this.cacheDir, 'cache_index.json');

    this.ensureDirs();
    this.loadCacheIndex();
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
   * Charge l'index de cache persistant (JSON) et assainit le dossier :
   * - Vérification de version (v2) : purge automatique des anciens fichiers obsolètes
   * - Suppression des fichiers temporaires (.tmp) ou corrompus (taille 0 ou incomplète)
   * - Restauration de l'index en mémoire pour accès instantané O(1)
   */
  private loadCacheIndex(): void {
    try {
      this.ensureDirs();
      let indexData: { version?: string; entries?: Record<string, CacheIndexEntry> } | null = null;

      if (fs.existsSync(this.indexFilePath)) {
        try {
          const raw = fs.readFileSync(this.indexFilePath, 'utf-8');
          indexData = JSON.parse(raw);
        } catch (readErr) {
          console.warn('[VoiceManager] Index de cache JSON illisible ou corrompu, réinitialisation :', readErr);
        }
      }

      const files = fs.readdirSync(this.cacheDir);
      const isVersionMismatch = !indexData || indexData.version !== VoiceManager.CACHE_VERSION;

      if (isVersionMismatch) {
        console.log(`[VoiceManager] Version de cache différente (cible ${VoiceManager.CACHE_VERSION}). Nettoyage des anciens audios...`);
      }

      // Nettoyage et synchronisation des fichiers réels
      for (const file of files) {
        if (file === 'cache_index.json') continue;
        const filePath = path.join(this.cacheDir, file);

        try {
          const stat = fs.statSync(filePath);

          // Supprimer tout fichier temporaire résiduel ou fichier incomplet / vide (< 44 octets pour un WAV)
          if (file.includes('.tmp') || (stat.isFile() && stat.size < 44)) {
            fs.unlinkSync(filePath);
            continue;
          }

          // Si version incompatible, purger les anciens fichiers pour éviter les artefacts saturés
          if (isVersionMismatch && stat.isFile()) {
            fs.unlinkSync(filePath);
            continue;
          }
        } catch {}
      }

      this.cacheIndex.clear();

      if (!isVersionMismatch && indexData?.entries) {
        for (const [hash, entry] of Object.entries(indexData.entries)) {
          const filePath = path.join(this.cacheDir, entry.fileName || `${hash}.${entry.format}`);
          if (fs.existsSync(filePath)) {
            this.cacheIndex.set(hash, entry);
          }
        }
      }

      this.saveCacheIndex();
    } catch (err) {
      console.warn('[VoiceManager] Erreur initialisation index de cache :', err);
    }
  }

  /**
   * Sauvegarde atomique de l'index de cache sur le disque
   */
  private saveCacheIndex(): void {
    try {
      const obj: Record<string, CacheIndexEntry> = {};
      this.cacheIndex.forEach((entry, hash) => {
        obj[hash] = entry;
      });

      const payload = JSON.stringify(
        {
          version: VoiceManager.CACHE_VERSION,
          updatedAt: new Date().toISOString(),
          entries: obj,
        },
        null,
        2
      );

      const tmpIndex = `${this.indexFilePath}.tmp_${Date.now()}`;
      fs.writeFileSync(tmpIndex, payload, 'utf-8');
      fs.renameSync(tmpIndex, this.indexFilePath);
    } catch (err) {
      console.warn('[VoiceManager] Avertissement enregistrement index cache :', err);
    }
  }

  /**
   * Écriture atomique sécurisée d'un fichier audio dans le cache
   * 1. Écriture dans un fichier temporaire unique
   * 2. Contrôle d'intégrité (taille, en-tête)
   * 3. Renommage atomique vers le nom définitif
   * 4. Enregistrement immédiat dans l'index O(1)
   */
  public saveAudioToCacheAtomically(
    hash: string,
    format: 'wav' | 'mp3',
    buffer: Buffer,
    meta: { text: string; voiceId: string; speed: number }
  ): boolean {
    try {
      this.ensureDirs();
      const finalFileName = `${hash}.${format}`;
      const finalPath = path.join(this.cacheDir, finalFileName);
      const tmpPath = path.join(this.cacheDir, `${hash}.tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${format}`);

      fs.writeFileSync(tmpPath, buffer);

      const stat = fs.statSync(tmpPath);
      if (stat.size !== buffer.length || stat.size < 44) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {}
        console.warn(`[VoiceManager] Échec écriture atomique (taille suspecte: ${stat.size} octets)`);
        return false;
      }

      fs.renameSync(tmpPath, finalPath);

      // Mise à jour de l'index
      this.cacheIndex.set(hash, {
        text: meta.text,
        voiceId: meta.voiceId,
        speed: meta.speed,
        format,
        sizeBytes: buffer.length,
        createdAt: new Date().toISOString(),
        fileName: finalFileName,
      });

      this.saveCacheIndex();
      return true;
    } catch (err) {
      console.error('[VoiceManager] Erreur écriture atomique du cache audio :', err);
      return false;
    }
  }

  /**
   * Vérifie en O(1) si un audio existe dans le cache persistant
   */
  public hasCachedAudio(hash: string): boolean {
    if (this.cacheIndex.has(hash)) {
      return true;
    }
    const wavPath = path.join(this.cacheDir, `${hash}.wav`);
    const mp3Path = path.join(this.cacheDir, `${hash}.mp3`);
    return fs.existsSync(wavPath) || fs.existsSync(mp3Path);
  }

  /**
   * Trouve le dossier contenant Kokoro-82M-v1.0-ONNX
   * Priorité : 1. Packagé (process.resourcesPath) | 2. Dev (resources) | 3. userData | 4. node_modules cache
   */
  public getKokoroModelDirectory(): { modelParentDir: string; modelPath: string; isComplete: boolean } | null {
    const candidates = [
      process.resourcesPath ? path.join(process.resourcesPath, 'models') : null,
      path.join(app.getAppPath(), 'resources', 'models'),
      this.userModelsDir,
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

      // Lancer le pré-chargement et le réchauffement du modèle en tâche de fond dès le démarrage
      this.warmupModel();
    } catch (err) {
      console.error('[VoiceManager] Échec du démarrage du worker Kokoro :', err);
    }
  }

  public sendWorkerMessage(type: string, payload: any): Promise<any> {
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
          reject(new Error('Délai d’attente dépassé pour la synthèse Kokoro (25s)'));
        }
      }, 25000);

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
   * Pré-charge et réchauffe le modèle Kokoro en mémoire dès le démarrage
   * Une passe réelle d'inférence factice est effectuée pour que le premier vrai mot soit instantané
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

  /**
   * Clé de hachage sécurisée avec version de cache v2
   */
  public getHash(text: string, voiceId: string, speed: number = 1.0): string {
    const norm = text.trim().toLowerCase();
    const speedTag = speed.toFixed(1);
    return crypto
      .createHash('md5')
      .update(`${VoiceManager.CACHE_VERSION}_${norm}_${voiceId}_${speedTag}`)
      .digest('hex');
  }

  /**
   * Liste dynamique des voix disponibles vérifiées
   */
  public getAvailableVoices(): AudioVoiceStatus[] {
    const voiceSearchDirs = [
      path.join(app.getAppPath(), 'node_modules', 'kokoro-js', 'voices'),
      path.join(__dirname, '..', '..', 'node_modules', 'kokoro-js', 'voices'),
      process.resourcesPath ? path.join(process.resourcesPath, 'voices') : null,
      path.join(this.userModelsDir, 'voices'),
    ].filter(Boolean) as string[];

    const hasModel = this.getKokoroModelDirectory() !== null;

    return AVAILABLE_KOKORO_VOICES.map((v) => {
      let isAvailable = false;
      const binFileName = `${v.id}.bin`;

      for (const dir of voiceSearchDirs) {
        try {
          if (fs.existsSync(path.join(dir, binFileName))) {
            isAvailable = true;
            break;
          }
        } catch {}
      }

      if (!isAvailable && hasModel) {
        isAvailable = true;
      }

      return {
        ...v,
        isAvailable,
      };
    });
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
    const availableVoices = this.getAvailableVoices();

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
      availableVoices,
    };
  }

  /**
   * Statistiques du cache audio calculées avec précision
   */
  public getCacheStats(): { count: number; totalSizeBytes: number; formattedSize: string } {
    try {
      this.ensureDirs();
      const files = fs.readdirSync(this.cacheDir);
      let totalSizeBytes = 0;
      let count = 0;

      for (const file of files) {
        if (file === 'cache_index.json' || file.includes('.tmp')) continue;
        try {
          const stat = fs.statSync(path.join(this.cacheDir, file));
          if (stat.isFile() && stat.size > 0) {
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
   * Ouvre le dossier audio_cache dans l'Explorateur Windows / macOS Finder
   */
  public async openCacheFolder(): Promise<{ success: boolean; error?: string }> {
    try {
      this.ensureDirs();
      const err = await shell.openPath(this.cacheDir);
      if (err) {
        console.error('[VoiceManager] Impossible d’ouvrir le dossier de cache :', err);
        return { success: false, error: err };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[VoiceManager] Impossible d’ouvrir le dossier de cache :', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Suppression propre et complète du cache audio :
   * - Arrêt immédiat de la file d'attente de pré-génération
   * - Suppression sécurisée de tous les fichiers audio et de l'index
   * - Gestion des verrous Windows (retries sur EBUSY / EPERM)
   * - Ne touche JAMAIS aux modèles Kokoro, voix ou données applicatives
   */
  public async clearCache(): Promise<ClearCacheResult> {
    this.cancelPreload();

    let freedBytes = 0;
    let deletedCount = 0;
    const failedFiles: string[] = [];

    try {
      this.ensureDirs();
      const files = fs.readdirSync(this.cacheDir);

      for (const file of files) {
        const fullPath = path.join(this.cacheDir, file);

        try {
          const stat = fs.statSync(fullPath);
          const size = stat.size;

          // Tentative de suppression avec jusqu'à 3 essais en cas de verrou Windows
          let removed = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              fs.unlinkSync(fullPath);
              removed = true;
              break;
            } catch (unlinkErr: any) {
              if (unlinkErr.code === 'EBUSY' || unlinkErr.code === 'EPERM') {
                await new Promise((r) => setTimeout(r, 80));
              } else {
                throw unlinkErr;
              }
            }
          }

          if (removed) {
            if (file !== 'cache_index.json') {
              freedBytes += size;
              deletedCount++;
            }
          } else {
            failedFiles.push(file);
          }
        } catch (err) {
          failedFiles.push(file);
        }
      }

      // Réinitialiser l'index
      this.cacheIndex.clear();
      this.saveCacheIndex();

      const mb = (freedBytes / (1024 * 1024)).toFixed(1);
      return {
        success: failedFiles.length === 0,
        freedBytes,
        freedFormatted: `${mb} Mo`,
        deletedCount,
        failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
      };
    } catch (err: any) {
      console.error('[VoiceManager] Erreur critique vidage du cache audio :', err);
      return {
        success: false,
        freedBytes,
        freedFormatted: '0 Mo',
        deletedCount,
        error: err?.message || String(err),
      };
    }
  }


  /**
   * File de pré-génération en arrière-plan (Background Audio Queue) :
   * Prépare les fichiers audio des mots du dictionnaire sans faire ramer l'application
   */
  public preloadWords(items: PreloadItem[]): void {
    if (!items || items.length === 0) return;

    // Filtrer pour n'ajouter que les éléments qui ne sont pas déjà en cache
    const toQueue: PreloadItem[] = [];
    for (const item of items) {
      if (!item.text || !item.text.trim()) continue;
      const clean = item.text.trim();
      const voiceId = item.voiceId || getDefaultVoiceForAccent(item.accent || 'en-US');
      const speed = item.speed || 1.0;
      const hash = this.getHash(clean, voiceId, speed);

      if (!this.hasCachedAudio(hash)) {
        toQueue.push({
          text: clean,
          accent: item.accent || 'en-US',
          voiceId,
          speed,
        });
      }
    }

    if (toQueue.length === 0) return;

    this.preloadQueue.push(...toQueue);
    this.preloadTotal = this.preloadQueue.length + this.preloadCompleted;

    this.notifyPreloadProgress();

    if (!this.isPreloading) {
      this.processPreloadQueue();
    }
  }

  public cancelPreload(): void {
    this.preloadQueue = [];
    this.isPreloading = false;
    this.preloadCompleted = 0;
    this.preloadTotal = 0;
    this.notifyPreloadProgress();
  }

  private notifyPreloadProgress(currentText?: string): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('audio:preloadProgress', {
        isPreloading: this.isPreloading,
        completed: this.preloadCompleted,
        total: this.preloadTotal,
        currentText,
      });
    }
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) return;
    this.isPreloading = true;

    while (this.preloadQueue.length > 0) {
      const item = this.preloadQueue.shift();
      if (!item) break;

      const voiceId = item.voiceId || getDefaultVoiceForAccent(item.accent || 'en-US');
      const speed = item.speed || 1.0;
      const hash = this.getHash(item.text, voiceId, speed);

      // Si déjà généré entre-temps, passer
      if (this.hasCachedAudio(hash)) {
        this.preloadCompleted++;
        this.notifyPreloadProgress(item.text);
        continue;
      }

      this.notifyPreloadProgress(item.text);

      try {
        await this.getAudioDataUrl(item.text, item.accent, voiceId, speed);
      } catch (err) {
        console.warn(`[VoiceManager] Avertissement pré-génération pour "${item.text}" :`, err);
      }

      this.preloadCompleted++;
      this.notifyPreloadProgress();

      // Pause douce (200ms) pour libérer le processeur et laisser l'interface fluide
      await new Promise((r) => setTimeout(r, 200));
    }

    this.isPreloading = false;
    this.notifyPreloadProgress();
  }

  /**
   * Synthèse via Kokoro dans le Worker avec écriture atomique
   */
  public async synthesizeWithKokoro(
    text: string,
    voiceId: string,
    speed: number,
    hash: string
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
        const buf = Buffer.from(res.wavBase64, 'base64');
        this.saveAudioToCacheAtomically(hash, 'wav', buf, { text, voiceId, speed });

        return {
          success: true,
          dataUrl: `data:audio/wav;base64,${res.wavBase64}`,
        };
      }

      return {
        success: false,
        error: res?.error || `Échec de la génération Kokoro pour la voix ${voiceId}`,
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
    hash: string
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
      return this.saveAudioToCacheAtomically(hash, 'mp3', buffer, { text: cleanWord, voiceId: 'dictionary', speed: 1.0 });
    } catch {
      return false;
    }
  }

  /**
   * Cascade audio principale avec cache persistant O(1) et écriture atomique :
   * 1. Cache local disque v2 (accès instantané)
   * 2. Kokoro-82M (avec modèle chaud et repli entre voix)
   * 3. DictionaryAPI (enregistrements humains mots seuls)
   * 4. Fallback système (SAPI)
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

    // 1. PALIER 1 : CACHE LOCAL PERSISTANT DISQUE (v2)
    if (this.cacheIndex.has(hash) || fs.existsSync(cachedWav)) {
      try {
        if (fs.existsSync(cachedWav)) {
          const data = fs.readFileSync(cachedWav).toString('base64');
          return {
            success: true,
            dataUrl: `data:audio/wav;base64,${data}`,
            source: 'cache',
            voiceUsed: effectiveVoiceId,
          };
        }
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

    // 2. PALIER 2 : MOTEUR NEURONAL LOCAL KOKORO-82M (avec modèle chaud)
    const modelInfo = this.getKokoroModelDirectory();
    if (modelInfo) {
      // 2.1 Tentative avec la voix demandée
      let kokoroRes = await this.synthesizeWithKokoro(cleanText, effectiveVoiceId, speed, hash);
      if (kokoroRes.success && kokoroRes.dataUrl) {
        return {
          success: true,
          dataUrl: kokoroRes.dataUrl,
          source: 'kokoro',
          voiceUsed: effectiveVoiceId,
        };
      }

      console.warn(
        `[VoiceManager] Échec Kokoro pour la voix "${effectiveVoiceId}" (${kokoroRes.error}). Tentative de repli sur la voix standard de l'accent...`
      );

      // 2.2 Repli sur la voix par défaut de cet accent
      const accentDefaultVoice = getDefaultVoiceForAccent(accent);
      if (effectiveVoiceId !== accentDefaultVoice) {
        const fallbackHash = this.getHash(cleanText, accentDefaultVoice, speed);
        const fallbackWav = path.join(this.cacheDir, `${fallbackHash}.wav`);

        if (this.hasCachedAudio(fallbackHash) && fs.existsSync(fallbackWav)) {
          try {
            const data = fs.readFileSync(fallbackWav).toString('base64');
            return {
              success: true,
              dataUrl: `data:audio/wav;base64,${data}`,
              source: 'kokoro',
              voiceUsed: accentDefaultVoice,
            };
          } catch {}
        }

        kokoroRes = await this.synthesizeWithKokoro(cleanText, accentDefaultVoice, speed, fallbackHash);
        if (kokoroRes.success && kokoroRes.dataUrl) {
          return {
            success: true,
            dataUrl: kokoroRes.dataUrl,
            source: 'kokoro',
            voiceUsed: accentDefaultVoice,
          };
        }
      }

      // 2.3 Repli sur la voix par défaut de l'autre accent
      const secondaryVoice = accent === 'en-GB' ? 'af_heart' : 'bf_emma';
      if (effectiveVoiceId !== secondaryVoice && accentDefaultVoice !== secondaryVoice) {
        const secondaryHash = this.getHash(cleanText, secondaryVoice, speed);
        const secondaryWav = path.join(this.cacheDir, `${secondaryHash}.wav`);

        if (this.hasCachedAudio(secondaryHash) && fs.existsSync(secondaryWav)) {
          try {
            const data = fs.readFileSync(secondaryWav).toString('base64');
            return {
              success: true,
              dataUrl: `data:audio/wav;base64,${data}`,
              source: 'kokoro',
              voiceUsed: secondaryVoice,
            };
          } catch {}
        }

        kokoroRes = await this.synthesizeWithKokoro(cleanText, secondaryVoice, speed, secondaryHash);
        if (kokoroRes.success && kokoroRes.dataUrl) {
          return {
            success: true,
            dataUrl: kokoroRes.dataUrl,
            source: 'kokoro',
            voiceUsed: secondaryVoice,
          };
        }
      }
    } else {
      console.warn('[VoiceManager] Modèle Kokoro absent, tentative de téléchargement silencieux en arrière-plan...');
      this.installKokoroModel().catch(() => {});
    }

    // 3. PALIER 3 : ENREGISTREMENTS HUMAINS (dictionaryapi.dev pour les mots seuls)
    const isSingleWord = !cleanText.includes(' ') && cleanText.length < 35;
    if (isSingleWord) {
      const ok = await this.fetchDictionaryApiAudio(cleanText, accent, hash);
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
   * Génère une phrase de test concise pour comparaison Kokoro vs Voix Système
   */
  public async getComparisonSample(
    accent: VoiceAccent,
    preferredVoiceId?: string
  ): Promise<{ kokoroDataUrl?: string; sampleText: string }> {
    const sampleText = 'Welcome to ENflash, your smart English flashcards app.';
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
