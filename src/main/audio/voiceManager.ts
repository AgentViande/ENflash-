import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { PiperVoiceModel, VoiceAccent } from '../../shared/types';

// Définitions des 4 voix neuronales Piper proposées
export const AVAILABLE_PIPER_VOICES: Omit<PiperVoiceModel, 'isDownloaded' | 'downloadProgress'>[] = [
  {
    id: 'en_US-lessac-medium',
    name: 'Lessac (US Féminin)',
    accent: 'en-US',
    gender: 'female',
    sizeBytes: 63201294,
    sizeFormatted: '60 Mo',
    modelUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
    configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json',
  },
  {
    id: 'en_US-ryan-medium',
    name: 'Ryan (US Masculin)',
    accent: 'en-US',
    gender: 'male',
    sizeBytes: 63201294,
    sizeFormatted: '60 Mo',
    modelUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/medium/en_US-ryan-medium.onnx',
    configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json',
  },
  {
    id: 'en_GB-alba-medium',
    name: 'Alba (UK Féminin)',
    accent: 'en-GB',
    gender: 'female',
    sizeBytes: 63201294,
    sizeFormatted: '60 Mo',
    modelUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alba/medium/en_GB-alba-medium.onnx',
    configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alba/medium/en_GB-alba-medium.onnx.json',
  },
  {
    id: 'en_GB-alan-medium',
    name: 'Alan (UK Masculin)',
    accent: 'en-GB',
    gender: 'male',
    sizeBytes: 63201294,
    sizeFormatted: '60 Mo',
    modelUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx',
    configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json',
  },
];

const PIPER_WINDOWS_BIN_URL =
  'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';

export class VoiceManager {
  private cacheDir: string;
  private piperDir: string;
  private voicesDir: string;
  private window: BrowserWindow | null = null;
  private activeDownloads: Set<string> = new Set();

  constructor() {
    const userData = app.getPath('userData');
    this.cacheDir = path.join(userData, 'audio_cache');
    this.piperDir = path.join(userData, 'piper');
    this.voicesDir = path.join(userData, 'piper', 'voices');

    this.ensureDirs();
  }

  public setWindow(win: BrowserWindow): void {
    this.window = win;
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true });
    if (!fs.existsSync(this.piperDir)) fs.mkdirSync(this.piperDir, { recursive: true });
    if (!fs.existsSync(this.voicesDir)) fs.mkdirSync(this.voicesDir, { recursive: true });
  }

  private getHash(text: string, voiceOrAccent: string): string {
    const norm = text.trim().toLowerCase();
    return crypto.createHash('md5').update(`${norm}_${voiceOrAccent}`).digest('hex');
  }

  /**
   * Statut des modèles de voix Piper
   */
  public getVoicesStatus(): PiperVoiceModel[] {
    return AVAILABLE_PIPER_VOICES.map((v) => {
      const modelPath = path.join(this.voicesDir, `${v.id}.onnx`);
      const configPath = path.join(this.voicesDir, `${v.id}.onnx.json`);
      const isDownloaded = fs.existsSync(modelPath) && fs.existsSync(configPath);
      return {
        ...v,
        isDownloaded,
      };
    });
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
   * Nettoyer le cache audio
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
   * Télécharger le moteur Piper Windows si absent
   */
  private async ensurePiperBinary(onProgress?: (pct: number) => void): Promise<string | null> {
    const piperExe = path.join(this.piperDir, 'piper.exe');
    if (fs.existsSync(piperExe)) {
      return piperExe;
    }

    const zipPath = path.join(this.piperDir, 'piper_windows.zip');

    try {
      if (onProgress) onProgress(5);
      const res = await fetch(PIPER_WINDOWS_BIN_URL, { redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error(`Échec du téléchargement de Piper (${res.status})`);

      const total = Number(res.headers.get('content-length')) || 23000000;
      let received = 0;
      const chunks: Buffer[] = [];

      // @ts-ignore
      for await (const chunk of res.body) {
        chunks.push(Buffer.from(chunk));
        received += chunk.length;
        if (onProgress) {
          const pct = Math.min(45, 5 + Math.round((received / total) * 40));
          onProgress(pct);
        }
      }

      fs.writeFileSync(zipPath, Buffer.concat(chunks));

      if (onProgress) onProgress(48);

      // Extraction via l'outil tar natif de Windows
      await new Promise<void>((resolve, reject) => {
        execFile('tar', ['-xf', zipPath, '-C', this.piperDir], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Nettoyage de l'archive
      try {
        fs.unlinkSync(zipPath);
      } catch {}

      if (fs.existsSync(piperExe)) {
        return piperExe;
      }
      return null;
    } catch (err) {
      console.error('Erreur installation binaire Piper :', err);
      return null;
    }
  }

  /**
   * Télécharger un modèle Piper à la demande avec progression
   */
  public async downloadVoice(
    voiceId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    const voiceDef = AVAILABLE_PIPER_VOICES.find((v) => v.id === voiceId);
    if (!voiceDef) return { success: false, error: 'Voix inconnue' };
    if (this.activeDownloads.has(voiceId)) return { success: true };

    this.activeDownloads.add(voiceId);

    try {
      // 1. S'assurer que le binaire piper.exe est présent
      const binReady = await this.ensurePiperBinary((pct) => {
        if (onProgress) onProgress(Math.round(pct * 0.3));
      });

      if (!binReady) {
        console.warn('Le binaire Piper n’a pas pu être extrait, mais on continue avec les modèles.');
      }

      // 2. Télécharger le fichier JSON de configuration
      const configRes = await fetch(voiceDef.configUrl, { redirect: 'follow' });
      if (!configRes.ok) throw new Error(`Impossible de télécharger la config (${configRes.status})`);
      const configText = await configRes.text();
      fs.writeFileSync(path.join(this.voicesDir, `${voiceDef.id}.onnx.json`), configText, 'utf-8');

      // 3. Télécharger le modèle ONNX avec jauge de progression
      const modelRes = await fetch(voiceDef.modelUrl, { redirect: 'follow' });
      if (!modelRes.ok || !modelRes.body) throw new Error(`Impossible de télécharger le modèle (${modelRes.status})`);

      const total = Number(modelRes.headers.get('content-length')) || voiceDef.sizeBytes;
      let received = 0;
      const chunks: Buffer[] = [];

      // @ts-ignore
      for await (const chunk of modelRes.body) {
        chunks.push(Buffer.from(chunk));
        received += chunk.length;
        const pct = Math.min(100, 30 + Math.round((received / total) * 70));
        if (onProgress) onProgress(pct);
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('audio:downloadProgress', { voiceId, progress: pct });
        }
      }

      fs.writeFileSync(path.join(this.voicesDir, `${voiceDef.id}.onnx`), Buffer.concat(chunks));

      if (onProgress) onProgress(100);
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('audio:downloadProgress', { voiceId, progress: 100 });
      }

      return { success: true };
    } catch (err: any) {
      console.error('Erreur téléchargement voix Piper :', err);
      return { success: false, error: err.message };
    } finally {
      this.activeDownloads.delete(voiceId);
    }
  }

  /**
   * Supprimer une voix téléchargée
   */
  public deleteVoice(voiceId: string): boolean {
    try {
      const modelPath = path.join(this.voicesDir, `${voiceId}.onnx`);
      const configPath = path.join(this.voicesDir, `${voiceId}.onnx.json`);
      if (fs.existsSync(modelPath)) fs.unlinkSync(modelPath);
      if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Synthétiser du texte via Piper localement
   */
  private async synthesizeWithPiper(
    text: string,
    voiceId: string,
    outputWavPath: string
  ): Promise<boolean> {
    const piperExe = path.join(this.piperDir, 'piper.exe');
    const modelPath = path.join(this.voicesDir, `${voiceId}.onnx`);
    const configPath = path.join(this.voicesDir, `${voiceId}.onnx.json`);

    if (!fs.existsSync(piperExe) || !fs.existsSync(modelPath) || !fs.existsSync(configPath)) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const child = spawn(
        piperExe,
        ['--model', modelPath, '--config', configPath, '--output_file', outputWavPath],
        { stdio: ['pipe', 'ignore', 'ignore'] }
      );

      child.stdin.write(text);
      child.stdin.end();

      child.on('close', (code) => {
        resolve(code === 0 && fs.existsSync(outputWavPath));
      });

      child.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Récupérer un enregistrement humain gratuit via Free Dictionary API
   */
  private async fetchDictionaryApiAudio(
    word: string,
    accent: VoiceAccent,
    outputMp3Path: string
  ): Promise<boolean> {
    try {
      const cleanWord = word.trim().toLowerCase();
      // On n'interroge le dictionnaire que pour les mots seuls
      if (cleanWord.includes(' ') || cleanWord.length > 40) return false;

      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`;
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) return false;

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return false;

      const phonetics: Array<{ audio?: string }> = data[0]?.phonetics || [];
      const audios = phonetics.map((p) => p.audio).filter((a): a is string => Boolean(a && a.endsWith('.mp3')));

      if (audios.length === 0) return false;

      // Priorité selon l'accent demandé (US vs UK)
      const accentTag = accent === 'en-GB' ? '-uk.mp3' : '-us.mp3';
      let selectedAudioUrl = audios.find((a) => a.toLowerCase().includes(accentTag));

      if (!selectedAudioUrl) {
        selectedAudioUrl = audios[0];
      }

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
   * Système en cascade principal (Get Audio Data URL)
   */
  public async getAudioDataUrl(
    text: string,
    accent: VoiceAccent,
    preferredVoiceId?: string
  ): Promise<{
    success: boolean;
    dataUrl?: string;
    source: 'cache' | 'piper' | 'dictionary' | 'fallback';
    error?: string;
  }> {
    if (!text || !text.trim()) {
      return { success: false, source: 'fallback', error: 'Texte vide' };
    }

    const cleanText = text.trim();
    const hash = this.getHash(cleanText, preferredVoiceId || accent);
    const cachedWav = path.join(this.cacheDir, `${hash}.wav`);
    const cachedMp3 = path.join(this.cacheDir, `${hash}.mp3`);

    // 1. PALIER 1 : CACHE LOCAL
    if (fs.existsSync(cachedWav)) {
      try {
        const data = fs.readFileSync(cachedWav).toString('base64');
        return { success: true, dataUrl: `data:audio/wav;base64,${data}`, source: 'cache' };
      } catch {}
    }
    if (fs.existsSync(cachedMp3)) {
      try {
        const data = fs.readFileSync(cachedMp3).toString('base64');
        return { success: true, dataUrl: `data:audio/mp3;base64,${data}`, source: 'cache' };
      } catch {}
    }

    // 2. PALIER 2 : VOIX NEURONALE PIPER (Hors ligne)
    // Trouver une voix Piper adaptée
    const voices = this.getVoicesStatus().filter((v) => v.isDownloaded);
    let chosenVoice = preferredVoiceId
      ? voices.find((v) => v.id === preferredVoiceId)
      : voices.find((v) => v.accent === accent);

    if (!chosenVoice && voices.length > 0) {
      chosenVoice = voices[0];
    }

    if (chosenVoice) {
      const ok = await this.synthesizeWithPiper(cleanText, chosenVoice.id, cachedWav);
      if (ok && fs.existsSync(cachedWav)) {
        try {
          const data = fs.readFileSync(cachedWav).toString('base64');
          return { success: true, dataUrl: `data:audio/wav;base64,${data}`, source: 'piper' };
        } catch {}
      }
    }

    // 3. PALIER 3 : ENREGISTREMENTS HUMAINS GRATUITS (dictionaryapi.dev pour les mots seuls)
    const isSingleWord = !cleanText.includes(' ') && cleanText.length < 35;
    if (isSingleWord) {
      const ok = await this.fetchDictionaryApiAudio(cleanText, accent, cachedMp3);
      if (ok && fs.existsSync(cachedMp3)) {
        try {
          const data = fs.readFileSync(cachedMp3).toString('base64');
          return { success: true, dataUrl: `data:audio/mp3;base64,${data}`, source: 'dictionary' };
        } catch {}
      }
    }

    // 4. PALIER 4 : DÉGRADATION EN CASCADE VERS LA SYNTHÈSE SYSTÈME
    return {
      success: false,
      source: 'fallback',
      error: 'Audio non pré-généré, bascule fluide vers la voix système',
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
