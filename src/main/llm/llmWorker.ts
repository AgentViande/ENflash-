import { parentPort } from 'node:worker_threads';
import os from 'node:os';
import { getLlama, Llama, LlamaModel, LlamaContext, LlamaChatSession, LlamaLogLevel } from 'node-llama-cpp';
import { validateSentenceQuality } from './qualityControl';

let llamaInstance: Llama | null = null;
let currentModel: LlamaModel | null = null;
let currentContext: LlamaContext | null = null;
let currentSession: LlamaChatSession | null = null;
let currentModelPath: string | null = null;

// Prompt raccourci et direct avec un seul exemple few-shot pour maximiser la vitesse d'inférence CPU
const SYSTEM_PROMPT = `You are an expert English language tutor creating flashcard examples.
Generate ONE simple, natural English example sentence (8 to 15 words) for the vocabulary word.
Strict Rules:
1. Output ONLY the raw sentence. No quotes, explanations, or French translation.
2. Must include the exact English word or a direct inflection (-s, -ed, -ing).
3. Reflect the French meaning accurately.

Example:
Word: runway | French meaning: piste d'atterrissage
The airplane touched down safely on the lighted runway at dusk.`;

function getOptimalThreadCount(): number {
  const logicalCores = os.cpus()?.length || 4;
  // Sur les processeurs modernes (ex: 8 cœurs / 16 threads), 6 ou 7 threads évitent la saturation du TDP et du cache L3
  if (logicalCores >= 16) return 7;
  if (logicalCores >= 8) return 6;
  if (logicalCores >= 4) return 3;
  return Math.max(1, logicalCores - 1);
}

async function ensureModelLoaded(modelPath: string): Promise<number> {
  if (currentModel && currentModelPath === modelPath && currentSession) {
    return 0; // Déjà en mémoire
  }

  const startLoad = Date.now();
  // Libérer l'ancien modèle si différent
  await unloadModel();

  if (!llamaInstance) {
    llamaInstance = await getLlama({
      logLevel: LlamaLogLevel.disabled, // Mode silencieux sans pollution console
    });
  }

  const threads = getOptimalThreadCount();

  currentModel = await llamaInstance.loadModel({
    modelPath,
  });

  // Contexte réduit à 512 tokens pour diviser par deux la consommation mémoire et accélérer l'allocation
  currentContext = await currentModel.createContext({
    contextSize: 512,
    threads,
  });

  currentSession = new LlamaChatSession({
    contextSequence: currentContext.getSequence(),
    systemPrompt: SYSTEM_PROMPT,
  });

  currentModelPath = modelPath;
  return Date.now() - startLoad;
}

async function unloadModel(): Promise<void> {
  try {
    if (currentSession) {
      currentSession.dispose();
      currentSession = null;
    }
    if (currentContext) {
      await currentContext.dispose();
      currentContext = null;
    }
    if (currentModel) {
      await currentModel.dispose();
      currentModel = null;
    }
    currentModelPath = null;
    if (global.gc) {
      global.gc();
    }
  } catch (err) {
    console.warn('[LLMWorker] Avertissement lors du déchargement du modèle:', err);
  }
}

async function generateSentenceWithQualityControl(params: {
  id: string;
  modelPath: string;
  english: string;
  french: string;
  definition?: string;
  partOfSpeech?: string;
  maxAttempts?: number;
}): Promise<{
  success: boolean;
  sentence?: string;
  attempts: number;
  durationMs: number;
  loadDurationMs: number;
  generationDurationMs: number;
  tokensPerSec: number;
  error?: string;
}> {
  const startTime = Date.now();
  const wasLoaded = Boolean(currentModel && currentModelPath === params.modelPath && currentSession);

  if (!wasLoaded) {
    parentPort?.postMessage({
      type: 'status_update',
      id: params.id,
      state: 'loading_model',
      message: 'Chargement du modèle en mémoire...',
    });
  }

  const loadDurationMs = await ensureModelLoaded(params.modelPath);
  if (!wasLoaded) {
    console.log(`[LLMWorker] [Chrono] 1. Chargement modèle depuis disque : ${loadDurationMs} ms (threads: ${getOptimalThreadCount()}, context: 512).`);
  }

  if (!currentSession) {
    throw new Error('Impossible d’initialiser la session de chat LLM');
  }

  parentPort?.postMessage({
    type: 'status_update',
    id: params.id,
    state: 'generating',
    message: 'Génération de la phrase d’exemple...',
  });

  const maxAttempts = params.maxAttempts || 2;
  let lastError = '';
  let totalGenTime = 0;
  let lastTokensPerSec = 0;

  const userPromptBase = `Word: ${params.english.trim()} | French meaning: ${params.french.trim()}${
    params.partOfSpeech ? ` | Category: ${params.partOfSpeech}` : ''
  }${params.definition ? ` | Definition: ${params.definition}` : ''}\nSentence:`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const attemptStart = Date.now();
      const temperature = 0.25 + (attempt - 1) * 0.15;

      // Réinitialiser l'historique pour une génération indépendante
      currentSession.resetChatHistory();

      let accumulatedText = '';
      const rawResponse = await currentSession.prompt(userPromptBase, {
        maxTokens: 35,
        temperature,
        topP: 0.9,
        customStopTriggers: ['\n', 'Word:', 'Sentence:'],
        onTextChunk: (chunk: string) => {
          accumulatedText += chunk;
          parentPort?.postMessage({
            type: 'token_chunk',
            id: params.id,
            chunk,
            fullText: accumulatedText.trim(),
          });
        },
      });

      const attemptDuration = Date.now() - attemptStart;
      totalGenTime += attemptDuration;

      const wordCount = rawResponse.trim().split(/\s+/).length;
      const tokensEst = Math.round(wordCount * 1.35);
      lastTokensPerSec = Math.round((tokensEst / Math.max(attemptDuration / 1000, 0.05)) * 10) / 10;

      console.log(`[LLMWorker] [Chrono] Tentative ${attempt} terminée en ${attemptDuration} ms (~${lastTokensPerSec} tok/s) : « ${rawResponse.trim()} »`);

      const qc = validateSentenceQuality(rawResponse, params.english);

      if (qc.isValid && qc.cleanSentence) {
        return {
          success: true,
          sentence: qc.cleanSentence,
          attempts: attempt,
          durationMs: Date.now() - startTime,
          loadDurationMs,
          generationDurationMs: totalGenTime,
          tokensPerSec: lastTokensPerSec,
        };
      } else {
        lastError = qc.reason || 'Qualité non conforme';
        console.warn(`[LLMWorker] Tentative ${attempt} rejetée par le contrôle qualité : ${lastError}`);
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn(`[LLMWorker] Erreur tentative ${attempt} :`, lastError);
    }
  }

  return {
    success: false,
    attempts: maxAttempts,
    durationMs: Date.now() - startTime,
    loadDurationMs,
    generationDurationMs: totalGenTime,
    tokensPerSec: lastTokensPerSec,
    error: lastError || 'Échec du contrôle qualité',
  };
}

async function runSpeedBenchmark(modelPath: string): Promise<{
  durationMs: number;
  tokensPerSec: number;
  ramUsageMB: number;
  sentence: string;
  rating: 'fast' | 'acceptable' | 'slow';
  recommendation: string;
}> {
  const start = Date.now();
  await ensureModelLoaded(modelPath);

  if (!currentSession) {
    throw new Error('Session non disponible pour le benchmark');
  }

  currentSession.resetChatHistory();
  const testWord = 'altitude';
  const testPrompt = `Word: altitude | French meaning: altitude | Category: noun\nSentence:`;

  const output = await currentSession.prompt(testPrompt, {
    maxTokens: 35,
    temperature: 0.3,
    customStopTriggers: ['\n', 'Word:', 'Sentence:'],
  });

  const durationMs = Date.now() - start;
  const qc = validateSentenceQuality(output, testWord);
  const sentence = qc.isValid && qc.cleanSentence ? qc.cleanSentence : output.trim();

  const wordCount = sentence.split(/\s+/).length;
  const tokenCount = Math.round(wordCount * 1.35);
  const tokensPerSec = Math.round((tokenCount / Math.max(durationMs / 1000, 0.1)) * 10) / 10;

  const mem = process.memoryUsage();
  const ramUsageMB = Math.round(mem.rss / (1024 * 1024));

  let rating: 'fast' | 'acceptable' | 'slow' = 'fast';
  let recommendation = 'Confortable : votre PC gère ce modèle sans aucun ralentissement.';

  if (durationMs > 2500 || tokensPerSec < 8) {
    rating = 'slow';
    recommendation = 'Lent : nous vous recommandons de basculer sur le modèle léger (0,5B).';
  } else if (durationMs > 1200) {
    rating = 'acceptable';
    recommendation = 'Fluide : les générations en arrière-plan se feront sans gêne.';
  }

  return {
    durationMs,
    tokensPerSec,
    ramUsageMB,
    sentence,
    rating,
    recommendation,
  };
}

if (parentPort) {
  parentPort.on('message', async (msg) => {
    try {
      if (msg.type === 'generate') {
        const result = await generateSentenceWithQualityControl({
          id: msg.id,
          modelPath: msg.modelPath,
          english: msg.english,
          french: msg.french,
          definition: msg.definition,
          partOfSpeech: msg.partOfSpeech,
          maxAttempts: msg.maxAttempts,
        });

        parentPort?.postMessage({
          type: 'generate_result',
          id: msg.id,
          ...result,
        });
      } else if (msg.type === 'preload') {
        const loadDurationMs = await ensureModelLoaded(msg.modelPath);
        parentPort?.postMessage({
          type: 'preload_result',
          id: msg.id,
          success: true,
          loadDurationMs,
        });
      } else if (msg.type === 'benchmark') {
        const result = await runSpeedBenchmark(msg.modelPath);
        parentPort?.postMessage({
          type: 'benchmark_result',
          id: msg.id,
          success: true,
          data: result,
        });
      } else if (msg.type === 'unload') {
        await unloadModel();
        parentPort?.postMessage({
          type: 'unload_result',
          id: msg.id,
          success: true,
        });
      } else if (msg.type === 'ping') {
        parentPort?.postMessage({
          type: 'pong',
          id: msg.id,
          isLoaded: currentModel !== null,
        });
      }
    } catch (err: any) {
      parentPort?.postMessage({
        type: 'error',
        id: msg.id,
        error: err?.message || String(err),
      });
    }
  });
}
