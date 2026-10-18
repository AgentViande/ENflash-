import { parentPort } from 'node:worker_threads';
import os from 'node:os';
import { getLlama, Llama, LlamaModel, LlamaContext, LlamaChatSession, LlamaLogLevel } from 'node-llama-cpp';
import { validateSentenceQuality } from './qualityControl';

let llamaInstance: Llama | null = null;
let currentModel: LlamaModel | null = null;
let currentContext: LlamaContext | null = null;
let currentSession: LlamaChatSession | null = null;
let currentModelPath: string | null = null;

const SYSTEM_PROMPT = `You are an expert English language tutor creating flashcard examples.
Your task is to generate ONE simple, natural English example sentence for a vocabulary word.

Strict Rules:
1. Target level: A2-B1 (clear, natural, everyday or appropriate technical context).
2. Length: exactly 8 to 15 words.
3. Must explicitly include the target English word or a common inflected form (plural, -s, -ed, -ing).
4. Accurately reflect the provided French meaning (especially technical, engineering, or aviation terms).
5. Output ONLY the raw sentence. DO NOT include quotes, greetings, explanations, bullet points, or French translations.

Few-shot Examples:
Word: runway | French meaning: piste d'atterrissage | Category: noun
The airplane touched down safely on the lighted runway at dusk.

Word: leading edge | French meaning: bord d'attaque | Category: noun
Ice formed along the leading edge of the wing during the flight.

Word: reliable | French meaning: fiable | Category: adjective
This turboprop aircraft is known to be very reliable in cold weather.`;

function getOptimalThreadCount(): number {
  const cores = os.cpus()?.length || 4;
  return Math.max(1, Math.min(8, Math.floor(cores / 2)));
}

async function ensureModelLoaded(modelPath: string): Promise<void> {
  if (currentModel && currentModelPath === modelPath && currentSession) {
    return;
  }

  // Si un modèle différent était chargé, le libérer d'abord
  await unloadModel();

  if (!llamaInstance) {
    llamaInstance = await getLlama({
      logLevel: LlamaLogLevel.disabled, // Mode silencieux
    });
  }

  const threads = getOptimalThreadCount();

  currentModel = await llamaInstance.loadModel({
    modelPath,
  });

  currentContext = await currentModel.createContext({
    contextSize: 1024,
    threads,
  });

  currentSession = new LlamaChatSession({
    contextSequence: currentContext.getSequence(),
    systemPrompt: SYSTEM_PROMPT,
  });

  currentModelPath = modelPath;
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
  error?: string;
}> {
  const startTime = Date.now();
  await ensureModelLoaded(params.modelPath);

  if (!currentSession) {
    throw new Error('Impossible d’initialiser la session de chat LLM');
  }

  const maxAttempts = params.maxAttempts || 3;
  let lastError = '';

  const userPromptBase = `Word: ${params.english.trim()} | French meaning: ${params.french.trim()}${
    params.partOfSpeech ? ` | Category: ${params.partOfSpeech}` : ''
  }${params.definition ? ` | Definition: ${params.definition}` : ''}\nSentence:`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Température basse (0.3 à 0.5) avec légère variation par tentative
      const temperature = 0.3 + (attempt - 1) * 0.1;

      // Réinitialiser l'historique de chat pour que chaque génération soit indépendante
      currentSession.resetChatHistory();

      const rawResponse = await currentSession.prompt(userPromptBase, {
        maxTokens: 40,
        temperature,
        topP: 0.9,
      });

      const qc = validateSentenceQuality(rawResponse, params.english);

      if (qc.isValid && qc.cleanSentence) {
        return {
          success: true,
          sentence: qc.cleanSentence,
          attempts: attempt,
          durationMs: Date.now() - startTime,
        };
      } else {
        lastError = qc.reason || 'Qualité non conforme';
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  return {
    success: false,
    attempts: maxAttempts,
    durationMs: Date.now() - startTime,
    error: lastError || 'Échec des 3 tentatives de contrôle qualité',
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
  });

  const durationMs = Date.now() - start;
  const qc = validateSentenceQuality(output, testWord);
  const sentence = qc.isValid && qc.cleanSentence ? qc.cleanSentence : output.trim();

  // Estimation tokens/seconde (~1 mot = 1.3 tokens)
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
