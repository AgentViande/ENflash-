import { AiApiProvider } from '../types';

export interface AiProviderConfig {
  id: AiApiProvider;
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  recommendedModels: string[];
  keyPlaceholder: string;
  isEndpointEditable: boolean;
  helpUrl: string;
  description: string;
}

export const AI_PROVIDERS: Record<AiApiProvider, AiProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-1.5-flash',
    recommendedModels: ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    keyPlaceholder: 'AIzaSy...',
    isEndpointEditable: false,
    helpUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Modèle rapide, gratuit et haute qualité via l’API officielle Google Gemini (mode OpenAI compatible).',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    recommendedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    keyPlaceholder: 'sk-proj-...',
    isEndpointEditable: false,
    helpUrl: 'https://platform.openai.com/api-keys',
    description: 'Modèles officiels OpenAI GPT-4o-mini / GPT-4o.',
  },
  groq: {
    id: 'groq',
    name: 'Groq (Ultra-rapide Llama)',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    recommendedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    keyPlaceholder: 'gsk_...',
    isEndpointEditable: false,
    helpUrl: 'https://console.groq.com/keys',
    description: 'Inférence ultra-rapide sur puces LPU pour modèles Llama 3.',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    defaultEndpoint: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    recommendedModels: ['mistral-small-latest', 'open-mistral-7b', 'mistral-large-latest'],
    keyPlaceholder: 'Votre clé Mistral...',
    isEndpointEditable: false,
    helpUrl: 'https://console.mistral.ai/api-keys/',
    description: 'Modèles européens performants Mistral Small / Large.',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.0-flash-001',
    recommendedModels: [
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct:free',
      'anthropic/claude-3.5-haiku',
    ],
    keyPlaceholder: 'sk-or-v1-...',
    isEndpointEditable: false,
    helpUrl: 'https://openrouter.ai/keys',
    description: 'Agrégateur unifié donnant accès à plus de 100 modèles IA.',
  },
  custom: {
    id: 'custom',
    name: 'Personnalisé (compatible OpenAI)',
    defaultEndpoint: 'http://localhost:11434/v1',
    defaultModel: '',
    recommendedModels: [],
    keyPlaceholder: 'Clé API ou jeton (si requis)',
    isEndpointEditable: true,
    helpUrl: '',
    description: 'Serveur local ou passerelle d’entreprise compatible avec l’API OpenAI (Ollama, vLLM, LM Studio, etc.).',
  },
};

export const AI_PROVIDER_LIST = Object.values(AI_PROVIDERS);

/**
 * Déduit automatiquement le fournisseur à partir du préfixe ou de la structure de la clé
 */
export function detectProviderFromKey(apiKey: string): AiApiProvider | null {
  const clean = apiKey.trim();
  if (clean.startsWith('AIza')) {
    return 'gemini';
  }
  if (clean.startsWith('gsk_')) {
    return 'groq';
  }
  if (clean.startsWith('sk-or-')) {
    return 'openrouter';
  }
  if (clean.startsWith('sk-proj-') || clean.startsWith('sk-admin-')) {
    return 'openai';
  }
  return null;
}

/**
 * Retourne l'URL de l'endpoint effectif pour un fournisseur donné
 */
export function getEffectiveEndpoint(provider: AiApiProvider, customEndpoint?: string): string {
  if (provider === 'custom') {
    return (customEndpoint || '').trim().replace(/\/+$/, '');
  }
  const config = AI_PROVIDERS[provider];
  return config ? config.defaultEndpoint.replace(/\/+$/, '') : '';
}

/**
 * Formate un message d'erreur lisible et sans fuite de clé
 */
export function formatApiError(
  status: number,
  rawErrorBody: any,
  provider: AiApiProvider,
  apiKey: string,
  endpoint?: string
): string {
  const cleanKey = (apiKey || '').trim();
  const targetUrl = (endpoint || '').toLowerCase();

  // Détecteur de mauvaise affectation de clé
  if ((provider === 'openai' || targetUrl.includes('openai.com')) && cleanKey.startsWith('AIza')) {
    return 'Cette clé ressemble à une clé Google Gemini : choisis le fournisseur Google Gemini.';
  }
  if (provider === 'gemini' && (cleanKey.startsWith('sk-') || cleanKey.startsWith('gsk_'))) {
    return 'Cette clé ressemble à une clé OpenAI ou Groq : choisis le fournisseur correspondant dans la liste.';
  }

  // Extraire le message détaillé renvoyé par le fournisseur (sans jamais divulguer la clé)
  let apiMsg = '';
  if (rawErrorBody) {
    if (typeof rawErrorBody === 'string') {
      apiMsg = rawErrorBody;
    } else if (rawErrorBody.error?.message) {
      apiMsg = rawErrorBody.error.message;
    } else if (rawErrorBody.message) {
      apiMsg = rawErrorBody.message;
    }
  }

  // Sécurité absolue : masquer la clé si elle apparaît dans le message renvoyé par l'API
  if (cleanKey.length > 5 && apiMsg.includes(cleanKey)) {
    apiMsg = apiMsg.split(cleanKey).join('[CLÉ MASQUÉE]');
  }

  const detail = apiMsg ? ` : ${apiMsg}` : '';

  switch (status) {
    case 401:
      return `Clé refusée (HTTP 401) : vérifie qu'elle correspond bien au fournisseur choisi (${AI_PROVIDERS[provider]?.name || provider})${detail}`;
    case 403:
      return `Accès refusé (HTTP 403) : région non éligible, API non activée ou clé restreinte${detail}`;
    case 404:
      return `Modèle ou adresse introuvable (HTTP 404)${detail}`;
    case 429:
      return `Quota atteint ou débit dépassé (HTTP 429), réessaie plus tard${detail}`;
    default:
      if (status >= 500) {
        return `Erreur serveur du fournisseur (HTTP ${status})${detail}`;
      }
      return `Erreur API (HTTP ${status})${detail}`;
  }
}
