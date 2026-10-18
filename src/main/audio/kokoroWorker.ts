import { parentPort } from 'node:worker_threads';
// @ts-ignore
import { KokoroTTS } from 'kokoro-js';
import { env } from '@huggingface/transformers';
import path from 'node:path';
import fs from 'node:fs';

let ttsInstance: KokoroTTS | null = null;
let currentLoadedModelPath: string | null = null;

/**
 * Normalise le volume audio pour que tous les audios aient un niveau sonore homogène
 */
function normalizeWavVolume(wavBuffer: Buffer, targetPeak: number = 0.95): Buffer {
  try {
    // Les fichiers WAV PCM 16-bit mono 24kHz ont un en-tête de 44 octets
    if (wavBuffer.length < 44) return wavBuffer;

    // Vérifier l'en-tête RIFF / WAVE
    const riff = wavBuffer.toString('ascii', 0, 4);
    const wave = wavBuffer.toString('ascii', 8, 12);
    if (riff !== 'RIFF' || wave !== 'WAVE') return wavBuffer;

    // Trouver le chunk 'data'
    let offset = 12;
    let dataOffset = 0;
    let dataSize = 0;

    while (offset < wavBuffer.length - 8) {
      const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
      const chunkSize = wavBuffer.readUInt32LE(offset + 4);
      if (chunkId === 'data') {
        dataOffset = offset + 8;
        dataSize = chunkSize;
        break;
      }
      offset += 8 + chunkSize;
    }

    if (!dataOffset || dataOffset + dataSize > wavBuffer.length) return wavBuffer;

    // Trouver la crête absolue (max peak)
    let maxVal = 0;
    for (let i = dataOffset; i < dataOffset + dataSize; i += 2) {
      const sample = Math.abs(wavBuffer.readInt16LE(i));
      if (sample > maxVal) maxVal = sample;
    }

    if (maxVal === 0) return wavBuffer;

    // Calculer le gain nécessaire pour atteindre targetPeak (32767 * targetPeak)
    const targetMax = 32767 * targetPeak;
    const gain = targetMax / maxVal;

    // Ne modifier que si nécessaire et éviter une sur-amplification excessive
    if (gain < 0.98 || (gain > 1.02 && gain <= 4.0)) {
      const newBuffer = Buffer.from(wavBuffer);
      for (let i = dataOffset; i < dataOffset + dataSize; i += 2) {
        const sample = newBuffer.readInt16LE(i);
        const amplified = Math.max(-32768, Math.min(32767, Math.round(sample * gain)));
        newBuffer.writeInt16LE(amplified, i);
      }
      return newBuffer;
    }

    return wavBuffer;
  } catch (err) {
    console.warn('Erreur lors de la normalisation audio :', err);
    return wavBuffer;
  }
}

/**
 * Initialise le modèle KokoroTTS depuis le dossier local spécifié
 */
async function initTTS(modelDir: string): Promise<boolean> {
  try {
    if (ttsInstance && currentLoadedModelPath === modelDir) {
      return true;
    }

    // Configuration Transformers.js pour chargement local 100% hors-ligne
    env.localModelPath = modelDir;
    env.allowRemoteModels = false;
    env.allowLocalModels = true;

    // Kokoro-82M-v1.0-ONNX est le sous-dossier ou le dossier du modèle
    const modelName = 'Kokoro-82M-v1.0-ONNX';
    ttsInstance = await KokoroTTS.from_pretrained(modelName, {
      dtype: 'q8',
    });

    currentLoadedModelPath = modelDir;
    return true;
  } catch (err: any) {
    console.error('Erreur initialisation KokoroTTS dans le worker :', err);
    return false;
  }
}

if (parentPort) {
  parentPort.on('message', async (msg: any) => {
    const { id, type, modelDir, text, voice, speed } = msg;

    try {
      if (type === 'init') {
        const ok = await initTTS(modelDir);
        parentPort?.postMessage({ id, type: 'init', success: ok });
        return;
      }

      if (type === 'synthesize') {
        if (!ttsInstance) {
          const ok = await initTTS(modelDir);
          if (!ok) {
            parentPort?.postMessage({
              id,
              type: 'synthesize',
              success: false,
              error: 'Modèle Kokoro non initialisé',
            });
            return;
          }
        }

        const safeVoice = voice || 'af_heart';
        const safeSpeed = Math.max(0.6, Math.min(1.2, speed || 1.0));

        const audio = await ttsInstance!.generate(text, {
          voice: safeVoice,
          speed: safeSpeed,
        });

        const rawWavBuffer = Buffer.from(audio.toWav());
        const normalizedWavBuffer = normalizeWavVolume(rawWavBuffer);

        parentPort?.postMessage({
          id,
          type: 'synthesize',
          success: true,
          wavBase64: normalizedWavBuffer.toString('base64'),
        });
        return;
      }
    } catch (err: any) {
      console.error('Erreur exécution tâche Kokoro worker :', err);
      parentPort?.postMessage({
        id,
        type: msg.type,
        success: false,
        error: err?.message || String(err),
      });
    }
  });
}
