import { parentPort } from 'node:worker_threads';
// @ts-ignore
import { KokoroTTS } from 'kokoro-js';
import { env } from '@huggingface/transformers';

let ttsInstance: KokoroTTS | null = null;
let currentLoadedModelPath: string | null = null;

/**
 * Normalise les échantillons float32 vers une crête sécurisée (-3 dB soit ~0.70)
 * avec limiteur dur [-1.0, 1.0] et encode en fichier WAV PCM 16-bit mono 24 000 Hz standard (44 octets).
 * Appliqué UNE SEULE FOIS, à la génération, avant la mise en cache.
 */
export function encodeNormalizedPcm16Wav(
  floatSamples: Float32Array,
  sampleRate: number = 24000,
  targetPeak: number = 0.70
): { buffer: Buffer; peak: number; gain: number } {
  let maxPeak = 0;
  for (let i = 0; i < floatSamples.length; i++) {
    const abs = Math.abs(floatSamples[i]);
    if (abs > maxPeak) maxPeak = abs;
  }

  // Marge de sécurité : gain plafonné à 3.0 pour éviter d'amplifier exagérément un bruit résiduel
  const gain = maxPeak > 0.0001 ? Math.min(targetPeak / maxPeak, 3.0) : 1.0;

  const numSamples = floatSamples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // En-tête RIFF WAVE PCM 16-bit
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 octets pour PCM)
  buffer.writeUInt16LE(1, 20); // Format audio 1 = PCM entier non-compressé
  buffer.writeUInt16LE(1, 22); // 1 canal (mono)
  buffer.writeUInt32LE(sampleRate, 24); // Fréquence d'échantillonnage (24 000 Hz)
  buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate (24000 * 1 * 2 = 48000)
  buffer.writeUInt16LE(2, 32); // Block align (1 * 2 = 2)
  buffer.writeUInt16LE(16, 34); // Bits per sample (16 bits)
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40); // Taille des données audio

  let actualPeak = 0;
  for (let i = 0; i < numSamples; i++) {
    const rawVal = floatSamples[i] * gain;
    // Limiteur dur : clamp strict à [-1.0, 1.0] pour éliminer tout écrêtage / débordement
    const clamped = Math.max(-1.0, Math.min(1.0, rawVal));
    const absClamped = Math.abs(clamped);
    if (absClamped > actualPeak) actualPeak = absClamped;

    // Conversion vers entier signé 16-bit PCM
    const intVal = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, intVal)), 44 + i * 2);
  }

  return { buffer, peak: actualPeak, gain };
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
        if (ok && ttsInstance) {
          try {
            // Passe de réchauffement réelle (inférence factice) pour charger et allouer les tenseurs ONNX
            await ttsInstance.generate('ready', { voice: 'af_heart', speed: 1.0 });
            console.log('[KokoroWorker] Inférence de réchauffement terminée avec succès (modèle chaud et prêt)');
          } catch (warmupErr) {
            console.warn('[KokoroWorker] Avertissement inférence de réchauffement :', warmupErr);
          }
        }
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
              error: 'Modèle Kokoro non initialisé ou introuvable',
            });
            return;
          }
        }

        const safeVoice = voice || 'af_heart';
        const safeSpeed = Math.max(0.6, Math.min(1.2, speed || 1.0));
        const startTime = Date.now();

        const rawAudio = await ttsInstance!.generate(text, {
          voice: safeVoice,
          speed: safeSpeed,
        });

        const floatSamples: Float32Array = rawAudio.audio;
        const sampleRate = rawAudio.sampling_rate || 24000;

        const { buffer: pcm16WavBuffer, peak, gain } = encodeNormalizedPcm16Wav(
          floatSamples,
          sampleRate,
          0.70
        );
        const elapsed = Date.now() - startTime;

        console.log(
          `[KokoroWorker] Synthèse audio réussie : voix="${safeVoice}", vitesse=${safeSpeed.toFixed(1)}x, temps=${elapsed}ms, pic=${peak.toFixed(2)}, gain=${gain.toFixed(2)}`
        );

        parentPort?.postMessage({
          id,
          type: 'synthesize',
          success: true,
          wavBase64: pcm16WavBuffer.toString('base64'),
          peak,
          sampleRate,
        });
        return;
      }
    } catch (err: any) {
      console.error(`[KokoroWorker] Erreur lors de la génération (voix="${voice}") :`, err);
      parentPort?.postMessage({
        id,
        type: msg.type,
        success: false,
        error: err?.message || String(err),
      });
    }
  });
}
