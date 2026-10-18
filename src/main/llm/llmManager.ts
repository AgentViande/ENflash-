import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ExampleSourceType,
  AiApiProvider,
} from '../../shared/types';
import {
  AI_PROVIDERS,
  getEffectiveEndpoint,
  formatApiError,
  detectProviderFromKey,
} from '../../shared/constants/aiProviders';
import { validateSentenceQuality } from './qualityControl';
import { getSentenceQueue } from './sentenceQueue';

// Verrou global inter-processus pour coordonner les tâches de génération avec la synthèse vocale Kokoro
let isHeavyTaskRunning = false;
export function isHeavyTaskActive(): boolean {
  return isHeavyTaskRunning;
}
export function setHeavyTaskActive(active: boolean): void {
  isHeavyTaskRunning = active;
}

export class LlmManager {
  private static instance: LlmManager;

  private constructor() {
    // Constructeur privé (Singleton)
  }

  public static getInstance(): LlmManager {
    if (!LlmManager.instance) {
      LlmManager.instance = new LlmManager();
    }
    return LlmManager.instance;
  }

  // --- Gestion du dossier orphelin des anciens modèles locaux (1.6 Go) ---

  public getOrphanedModelPath(): string {
    const userDataDir =
      typeof app?.getPath === 'function' ? app.getPath('userData') : path.join(os.tmpdir(), 'enflash');
    return path.join(userDataDir, 'models', 'llm');
  }

  /**
   * Vérifie si d'anciens fichiers du modèle local sont présents sur le disque
   */
  public checkOrphanedLocalModel(): { hasLocalModel: boolean; sizeBytes: number; sizeFormatted: string } {
    const dir = this.getOrphanedModelPath();
    if (!fs.existsSync(dir)) {
      return { hasLocalModel: false, sizeBytes: 0, sizeFormatted: '0 Mo' };
    }
    try {
      let totalSize = 0;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const p = path.join(dir, f);
        const stat = fs.statSync(p);
        if (stat.isFile()) totalSize += stat.size;
      }
      if (totalSize === 0) {
        return { hasLocalModel: false, sizeBytes: 0, sizeFormatted: '0 Mo' };
      }
      const sizeMB = Math.round(totalSize / (1024 * 1024));
      const sizeFormatted = sizeMB >= 1024 ? `${(sizeMB / 1024).toFixed(2)} Go` : `${sizeMB} Mo`;
      return { hasLocalModel: true, sizeBytes: totalSize, sizeFormatted };
    } catch {
      return { hasLocalModel: false, sizeBytes: 0, sizeFormatted: '0 Mo' };
    }
  }

  /**
   * Supprime définitivement l'ancien dossier des modèles locaux pour libérer l'espace disque
   * Ne touche JAMAIS au dossier Kokoro TTS ni aux autres modèles !
   */
  public deleteOrphanedLocalModel(): { success: boolean; freedBytes: number; freedFormatted: string } {
    const check = this.checkOrphanedLocalModel();
    const dir = this.getOrphanedModelPath();
    if (!fs.existsSync(dir)) {
      return { success: true, freedBytes: 0, freedFormatted: '0 Mo' };
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[LlmManager] Nettoyage réussi : ${check.sizeFormatted} libérés dans ${dir}`);
      return { success: true, freedBytes: check.sizeBytes, freedFormatted: check.sizeFormatted };
    } catch (err: any) {
      console.error(`[LlmManager] Erreur lors de la suppression de ${dir}:`, err);
      return { success: false, freedBytes: 0, freedFormatted: '0 Mo' };
    }
  }

  // --- Recherche dans le dictionnaire en ligne (dictionaryapi.dev) ---

  public async fetchDictionaryExample(
    word: string,
    skipSentence?: string
  ): Promise<{ sentence: string; definition?: string; partOfSpeech?: string } | null> {
    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) return null;

    // Décomposer en mots simples si expression composée pour la recherche lexicale
    const lookupCandidate = cleanWord.includes(' ')
      ? cleanWord.split(/\s+/)[0]
      : cleanWord;

    const candidates = [cleanWord];
    if (lookupCandidate !== cleanWord) {
      candidates.push(lookupCandidate);
    }
    // Gérer les pluriels courants (ex: flaps -> flap, batteries -> battery)
    if (cleanWord.endsWith('ies') && cleanWord.length > 4) {
      candidates.push(`${cleanWord.slice(0, -3)}y`);
    } else if (cleanWord.endsWith('es') && cleanWord.length > 3) {
      candidates.push(cleanWord.slice(0, -2));
    } else if (cleanWord.endsWith('s') && cleanWord.length > 2) {
      candidates.push(cleanWord.slice(0, -1));
    }

    for (const term of candidates) {
      try {
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (!res.ok) continue;

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) continue;

        for (const entry of data) {
          const meanings = entry.meanings || [];
          for (const meaning of meanings) {
            const definitions = meaning.definitions || [];
            for (const def of definitions) {
              if (def.example && def.example.trim().length > 0) {
                const exampleText = def.example.trim();
                if (skipSentence && exampleText.toLowerCase() === skipSentence.toLowerCase()) {
                  continue;
                }

                // Vérifier la qualité de l'exemple du dictionnaire
                const qc = validateSentenceQuality(exampleText, cleanWord);
                if (qc.isValid && qc.cleanSentence) {
                  return {
                    sentence: qc.cleanSentence,
                    definition: def.definition,
                    partOfSpeech: meaning.partOfSpeech,
                  };
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn(`[LlmManager] Timeout lors de la requête dictionnaire pour "${term}"`);
        }
      }
    }

    return null;
  }

  // --- Validation et test de la clé API externe ---

  /**
   * Validation légère de la clé API via l'endpoint /models du fournisseur
   */
  public async testAiApiKey(params: {
    provider?: AiApiProvider;
    apiKey: string;
    apiEndpoint?: string;
  }): Promise<{ success: boolean; models?: string[]; error?: string; message?: string }> {
    const cleanKey = (params.apiKey || '').trim();
    if (!cleanKey) {
      return { success: false, error: 'Veuillez renseigner une clé API.' };
    }

    const provider = params.provider;
    if (!provider) {
      return { success: false, error: 'Veuillez sélectionner un fournisseur d’API (Google Gemini, OpenAI, Groq, etc.).' };
    }

    const endpoint = getEffectiveEndpoint(provider, params.apiEndpoint);
    if (!endpoint) {
      return {
        success: false,
        error: 'Veuillez renseigner l’adresse (endpoint) de votre API personnalisée.',
      };
    }

    // Détecteurs de cohérence de clé (Google Gemini vs OpenAI)
    if ((provider === 'openai' || endpoint.includes('openai.com')) && cleanKey.startsWith('AIza')) {
      return {
        success: false,
        error: 'Cette clé ressemble à une clé Google Gemini : choisis le fournisseur Google Gemini.',
      };
    }
    if (provider === 'gemini' && (cleanKey.startsWith('sk-') || cleanKey.startsWith('gsk_'))) {
      return {
        success: false,
        error: 'Cette clé ressemble à une clé OpenAI ou Groq : choisis le fournisseur correspondant dans la liste.',
      };
    }

    try {
      const url = `${endpoint.replace(/\/+$/, '')}/models`;
      console.log(`[LlmManager] Test de clé API auprès de : ${url} (fournisseur: ${provider})`);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const formattedErr = formatApiError(res.status, errorBody, provider, cleanKey, endpoint);
        return { success: false, error: formattedErr };
      }

      const json = await res.json().catch(() => null);
      let rawModels: string[] = [];

      if (json && Array.isArray(json.data)) {
        rawModels = json.data
          .map((item: any) => (typeof item === 'string' ? item : item?.id))
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0);
      } else if (json && Array.isArray(json.models)) {
        rawModels = json.models
          .map((item: any) => (typeof item === 'string' ? item : item?.id || item?.name))
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0);
      }

      // Nettoyer et filtrer les modèles adaptés au texte
      const filteredModels = rawModels.filter((id) => {
        const lower = id.toLowerCase();
        return (
          !lower.includes('embedding') &&
          !lower.includes('whisper') &&
          !lower.includes('dall-e') &&
          !lower.includes('tts') &&
          !lower.includes('moderation') &&
          !lower.includes('imagen')
        );
      });

      const recommended = AI_PROVIDERS[provider]?.recommendedModels || [];
      const sortedModels = [
        ...recommended.filter((m) => filteredModels.includes(m)),
        ...filteredModels.filter((m) => !recommended.includes(m)),
      ];

      return {
        success: true,
        models: sortedModels.length > 0 ? sortedModels : recommended,
        message: `Clé valide ✅ (${sortedModels.length || recommended.length} modèle(s) disponible(s))`,
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        return { success: false, error: 'Délai d’attente dépassé (timeout) : le service distant n’a pas répondu.' };
      }
      if (
        err.message?.includes('fetch failed') ||
        err.message?.includes('ENOTFOUND') ||
        err.message?.includes('ECONNREFUSED')
      ) {
        return {
          success: false,
          error: 'Impossible de joindre le service : vérifie ta connexion ou ton pare-feu.',
        };
      }
      return { success: false, error: `Erreur de connexion : ${err.message}` };
    }
  }

  /**
   * Test complet avec génération réelle d'une phrase d'exemple courte
   */
  public async testAiGeneration(params: {
    provider?: AiApiProvider;
    apiKey: string;
    apiEndpoint?: string;
    model?: string;
  }): Promise<{ success: boolean; sentence?: string; durationMs?: number; error?: string }> {
    const start = Date.now();
    const res = await this.generateSentenceWithApi({
      english: 'sky',
      french: 'ciel',
      apiKey: params.apiKey,
      apiEndpoint: params.apiEndpoint,
      provider: params.provider,
      model: params.model,
    });
    const durationMs = Date.now() - start;

    if (res.success && res.sentence) {
      return { success: true, sentence: res.sentence, durationMs };
    }
    return { success: false, error: res.error, durationMs };
  }

  // --- Génération par API distante (Google Gemini, OpenAI, Groq, Mistral, OpenRouter, Custom) ---

  public async generateSentenceWithApi(params: {
    english: string;
    french: string;
    apiKey: string;
    apiEndpoint?: string;
    provider?: AiApiProvider;
    model?: string;
  }): Promise<{ success: boolean; sentence?: string; error?: string }> {
    const cleanKey = (params.apiKey || '').trim();
    if (!cleanKey) {
      return { success: false, error: 'Clé API non renseignée' };
    }

    const provider = params.provider || detectProviderFromKey(cleanKey) || 'gemini';
    const endpoint = getEffectiveEndpoint(provider, params.apiEndpoint);
    if (!endpoint) {
      return { success: false, error: 'Endpoint d’API non configuré' };
    }

    const targetUrl = `${endpoint.replace(/\/+$/, '')}/chat/completions`;
    const model = params.model || AI_PROVIDERS[provider]?.defaultModel || 'gemini-1.5-flash';

    const systemPrompt =
      'You are an English teacher. Output ONLY one natural English example sentence (A2-B1 level, 8-15 words) using the specified word in the intended French sense. No quotes, no intro.';
    const userPrompt = `Word: ${params.english} (French: ${params.french})`;

    setHeavyTaskActive(true);

    try {
      console.log(`[LlmManager] Requête API distante vers : ${targetUrl} (modèle: ${model}, fournisseur: ${provider})`);

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 40,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const formattedErr = formatApiError(res.status, errorBody, provider, cleanKey, endpoint);
        return { success: false, error: formattedErr };
      }

      const json = await res.json().catch(() => null);
      const content = json?.choices?.[0]?.message?.content || '';
      const qc = validateSentenceQuality(content, params.english);

      if (qc.isValid && qc.cleanSentence) {
        return { success: true, sentence: qc.cleanSentence };
      }
      return {
        success: false,
        error: qc.reason || 'Réponse API non conforme au contrôle qualité',
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        return { success: false, error: 'Délai maximal de réponse API dépassé (15 s).' };
      }
      if (
        err.message?.includes('fetch failed') ||
        err.message?.includes('ENOTFOUND') ||
        err.message?.includes('ECONNREFUSED')
      ) {
        return {
          success: false,
          error: 'Impossible de joindre le service : vérifie ta connexion ou ton pare-feu.',
        };
      }
      return { success: false, error: err.message };
    } finally {
      setHeavyTaskActive(false);
    }
  }

  // --- Exécution de la cascade des phrases (Dictionnaire ➔ Clé API) ---

  public async resolveSentenceCascade(params: {
    english: string;
    french: string;
    existingExample?: string;
    existingSource?: ExampleSourceType;
    cascadeOrder?: ExampleSourceType[];
    aiApiProvider?: AiApiProvider;
    aiApiKey?: string;
    aiApiEndpoint?: string;
    aiApiModel?: string;
    skipSentence?: string;
    priority?: 'normal' | 'immediate';
  }): Promise<{
    sentence?: string;
    source?: ExampleSourceType;
    error?: string;
    durationMs?: number;
  } | null> {
    console.log(
      `[LlmManager] Résolution cascade pour "${params.english}" (fr: "${params.french}", priorité: ${
        params.priority || 'normal'
      })`
    );

    // Règle 1 : Phrase écrite ou modifiée par l'utilisateur => JAMAIS écrasée
    if (params.existingExample && params.existingSource === 'user' && !params.skipSentence) {
      console.log(`[LlmManager] Phrase utilisateur conservée pour "${params.english}".`);
      return { sentence: params.existingExample, source: 'user' };
    }

    const isImmediate = params.priority === 'immediate';
    const queue = getSentenceQueue();
    if (isImmediate) {
      queue.pauseForImmediateRequest();
    }

    const hasApiKey = Boolean(params.aiApiKey && params.aiApiKey.trim().length > 0);

    try {
      // Si mode immédiat (clic utilisateur sur "✨ Générer une phrase") :
      // On lance en parallèle le dictionnaire et l'API distante pour une réactivité maximale !
      if (isImmediate) {
        const start = Date.now();
        const dictPromise = this.fetchDictionaryExample(params.english, params.skipSentence);

        if (hasApiKey) {
          const apiPromise = this.generateSentenceWithApi({
            english: params.english,
            french: params.french,
            apiKey: params.aiApiKey!,
            apiEndpoint: params.aiApiEndpoint,
            provider: params.aiApiProvider,
            model: params.aiApiModel,
          });

          // Concurrence intelligente : si le dictionnaire répond très vite avec un exemple valide
          const quickDict = await Promise.race([
            dictPromise,
            new Promise<null>((r) => setTimeout(() => r(null), 350)),
          ]);

          if (quickDict && quickDict.sentence) {
            return {
              sentence: quickDict.sentence,
              source: 'dictionary',
              durationMs: Date.now() - start,
            };
          }

          // Sinon attendre les deux résultats
          const [dictRes, apiRes] = await Promise.all([
            dictPromise.catch(() => null),
            apiPromise.catch(() => null),
          ]);

          if (apiRes && apiRes.success && apiRes.sentence) {
            return {
              sentence: apiRes.sentence,
              source: 'api',
              durationMs: Date.now() - start,
            };
          }

          if (dictRes && dictRes.sentence) {
            return {
              sentence: dictRes.sentence,
              source: 'dictionary',
              durationMs: Date.now() - start,
            };
          }

          return {
            error: apiRes?.error || 'Aucun exemple trouvé dans le dictionnaire.',
            durationMs: Date.now() - start,
          };
        } else {
          // Pas de clé API : recherche exclusive dans le dictionnaire
          const dictRes = await dictPromise;
          if (dictRes && dictRes.sentence) {
            return {
              sentence: dictRes.sentence,
              source: 'dictionary',
              durationMs: Date.now() - start,
            };
          }

          return {
            error:
              'Aucun exemple trouvé dans le dictionnaire. Ajoutez une clé API gratuite dans le Centre IA pour générer des phrases automatiquement.',
            durationMs: Date.now() - start,
          };
        }
      }

      // Mode standard / File d'attente séquentielle
      const order: ExampleSourceType[] = (params.cascadeOrder || ['user', 'dictionary', 'api']).filter(
        (s) => s !== 'local_llm'
      );

      for (const source of order) {
        if (source === 'user') {
          if (params.existingExample && params.existingSource === 'user' && !params.skipSentence) {
            return { sentence: params.existingExample, source: 'user' };
          }
        } else if (source === 'dictionary') {
          const dictRes = await this.fetchDictionaryExample(params.english, params.skipSentence);
          if (dictRes && dictRes.sentence) {
            return { sentence: dictRes.sentence, source: 'dictionary' };
          }
        } else if (source === 'api') {
          if (hasApiKey) {
            const apiRes = await this.generateSentenceWithApi({
              english: params.english,
              french: params.french,
              apiKey: params.aiApiKey!,
              apiEndpoint: params.aiApiEndpoint,
              provider: params.aiApiProvider,
              model: params.aiApiModel,
            });

            if (apiRes.success && apiRes.sentence) {
              return { sentence: apiRes.sentence, source: 'api' };
            }
          }
        }
      }

      const errorMsg = hasApiKey
        ? 'Aucun exemple disponible via le dictionnaire ou l’API.'
        : 'Aucun exemple dans le dictionnaire et aucune clé API configurée.';

      return { error: errorMsg };
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
