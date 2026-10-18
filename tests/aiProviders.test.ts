import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  AI_PROVIDERS,
  detectProviderFromKey,
  getEffectiveEndpoint,
  formatApiError,
} from '../src/shared/constants/aiProviders';
import { DatabaseStore } from '../src/main/storage/store';
import { LlmManager } from '../src/main/llm/llmManager';
import { encryptSecret, decryptSecret, maskApiKey } from '../src/main/storage/crypto';

describe('Centre IA - Fournisseurs d’API & Gestion des Clés', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enflash-ai-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('1. Détection automatique et endpoints effectifs', () => {
    it('détecte correctement Google Gemini par le préfixe AIza', () => {
      expect(detectProviderFromKey('AIzaSyAbc123456789')).toBe('gemini');
    });

    it('détecte correctement Groq par le préfixe gsk_', () => {
      expect(detectProviderFromKey('gsk_Abc123456789xyz')).toBe('groq');
    });

    it('détecte correctement OpenRouter par le préfixe sk-or-', () => {
      expect(detectProviderFromKey('sk-or-v1-abcdef123456')).toBe('openrouter');
    });

    it('détecte correctement OpenAI par les préfixes sk-proj- ou sk-admin-', () => {
      expect(detectProviderFromKey('sk-proj-xyz123456')).toBe('openai');
      expect(detectProviderFromKey('sk-admin-xyz123456')).toBe('openai');
    });

    it('retourne null si la clé est non reconnue ou vide', () => {
      expect(detectProviderFromKey('')).toBeNull();
      expect(detectProviderFromKey('   ')).toBeNull();
      expect(detectProviderFromKey('mysterious_key_999')).toBeNull();
    });

    it('fournit les endpoints officiels attendus pour chaque fournisseur', () => {
      expect(getEffectiveEndpoint('gemini')).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
      expect(getEffectiveEndpoint('openai')).toBe('https://api.openai.com/v1');
      expect(getEffectiveEndpoint('groq')).toBe('https://api.groq.com/openai/v1');
      expect(getEffectiveEndpoint('mistral')).toBe('https://api.mistral.ai/v1');
      expect(getEffectiveEndpoint('openrouter')).toBe('https://openrouter.ai/api/v1');
    });

    it('n’utilise JAMAIS api.openai.com par défaut si le champ personnalisé est vide', () => {
      expect(getEffectiveEndpoint('custom', '')).toBe('');
      expect(getEffectiveEndpoint('custom', '   ')).toBe('');
      expect(getEffectiveEndpoint('custom', undefined)).toBe('');
      expect(getEffectiveEndpoint('custom', 'http://localhost:11434/v1/')).toBe('http://localhost:11434/v1');
    });
  });

  describe('2. Messages d’erreur précis et sécurité de la clé', () => {
    const testKey = 'AIzaSySecretGoogleKey999';

    it('détecte l’envoi erroné d’une clé Gemini (AIza) vers OpenAI', () => {
      const msg = formatApiError(401, null, 'openai', testKey, 'https://api.openai.com/v1');
      expect(msg).toContain('Cette clé ressemble à une clé Google Gemini : choisis le fournisseur Google Gemini.');
    });

    it('détecte l’envoi erroné d’une clé OpenAI vers Gemini', () => {
      const msg = formatApiError(401, null, 'gemini', 'sk-proj-openaiKey123', 'https://generativelanguage.googleapis.com/v1beta/openai');
      expect(msg).toContain('Cette clé ressemble à une clé OpenAI ou Groq');
    });

    it('affiche un message clair pour HTTP 401', () => {
      const msg = formatApiError(401, { error: { message: 'Invalid API key provided' } }, 'mistral', 'mistral_secret_key');
      expect(msg).toContain('Clé refusée (HTTP 401)');
      expect(msg).toContain('Mistral AI');
      expect(msg).toContain('Invalid API key provided');
    });

    it('affiche un message clair pour HTTP 403', () => {
      const msg = formatApiError(403, { message: 'User location not supported' }, 'gemini', testKey);
      expect(msg).toContain('Accès refusé (HTTP 403)');
      expect(msg).toContain('User location not supported');
    });

    it('affiche un message clair pour HTTP 404', () => {
      const msg = formatApiError(404, null, 'gemini', testKey);
      expect(msg).toContain('Modèle ou adresse introuvable (HTTP 404)');
    });

    it('affiche un message clair pour HTTP 429', () => {
      const msg = formatApiError(429, { error: { message: 'Rate limit exceeded' } }, 'groq', 'gsk_secret');
      expect(msg).toContain('Quota atteint ou débit dépassé (HTTP 429)');
      expect(msg).toContain('Rate limit exceeded');
    });

    it('masque IMPÉRATIVEMENT la clé si celle-ci apparaît dans le message renvoyé par le fournisseur distant', () => {
      const sensitiveMsg = `Authentication error: invalid credential AIzaSySecretGoogleKey999 passed to server`;
      const formatted = formatApiError(401, sensitiveMsg, 'custom', testKey, 'http://custom-llm.local');
      expect(formatted).not.toContain(testKey);
      expect(formatted).toContain('[CLÉ MASQUÉE]');
    });

    it('masque les clés pour l’affichage via maskApiKey', () => {
      expect(maskApiKey('AIzaSyAbc123456789xyz')).toBe('AIza...xyz');
      expect(maskApiKey('short')).toBe('••••••••');
      expect(maskApiKey('')).toBe('');
    });
  });

  describe('3. Stockage chiffré, persistance par fournisseur et export sécurisé', () => {
    it('chiffre la clé API sur le disque et la déchiffre à la lecture', () => {
      const store = new DatabaseStore(tempDir);
      const data = store.load();

      data.settings.aiApiProvider = 'gemini';
      data.settings.aiApiKey = 'AIzaSyRealSecretKey123';
      data.settings.aiApiKeys = {
        gemini: 'AIzaSyRealSecretKey123',
        openai: 'sk-proj-RealSecretKey456',
      };
      store.save(data);

      // Lire le fichier brut directement sur le disque
      const rawContent = fs.readFileSync(store.getFilePath(), 'utf-8');
      expect(rawContent).not.toContain('AIzaSyRealSecretKey123');
      expect(rawContent).not.toContain('sk-proj-RealSecretKey456');
      expect(rawContent).toContain('enc:');

      // Recharger via le store : les clés doivent être lisibles en clair en mémoire
      const reloadedStore = new DatabaseStore(tempDir);
      const reloadedData = reloadedStore.load();
      expect(reloadedData.settings.aiApiKey).toBe('AIzaSyRealSecretKey123');
      expect(reloadedData.settings.aiApiKeys?.gemini).toBe('AIzaSyRealSecretKey123');
      expect(reloadedData.settings.aiApiKeys?.openai).toBe('sk-proj-RealSecretKey456');
    });

    it('migre automatiquement une clé Gemini existante quand provider est absent', () => {
      const store = new DatabaseStore(tempDir);
      const data = store.load();

      delete (data.settings as any).aiApiProvider;
      delete (data.settings as any).aiApiEndpoint;
      data.settings.aiApiKey = 'AIzaSyLegacyGoogleKey';
      store.save(data);

      const reloadedStore = new DatabaseStore(tempDir);
      const reloaded = reloadedStore.load();

      expect(reloaded.settings.aiApiProvider).toBe('gemini');
      expect(reloaded.settings.aiApiEndpoint).toBe('https://generativelanguage.googleapis.com/v1beta/openai/');
      expect(reloaded.settings.aiApiModel).toBe('gemini-1.5-flash');
      expect(reloaded.settings.aiApiKeys?.gemini).toBe('AIzaSyLegacyGoogleKey');
    });

    it('supprime TOUTE clé API lors d’un export vers fichier JSON', () => {
      const store = new DatabaseStore(tempDir);
      const data = store.load();

      data.settings.aiApiKey = 'AIzaSySecretToNeverExport';
      data.settings.aiApiKeys = { gemini: 'AIzaSySecretToNeverExport' };
      store.save(data);

      const exportPath = path.join(tempDir, 'export-test.json');
      store.exportToFile(exportPath);

      const exportRaw = fs.readFileSync(exportPath, 'utf-8');
      const exportParsed = JSON.parse(exportRaw);

      expect(exportRaw).not.toContain('AIzaSySecretToNeverExport');
      expect(exportParsed.settings.aiApiKey).toBeUndefined();
      expect(exportParsed.settings.aiApiKeys).toBeUndefined();
    });
  });

  describe('4. Simulation des requêtes API (testAiApiKey et testAiGeneration)', () => {
    const llmManager = LlmManager.getInstance();

    it('valide la clé Gemini et récupère la liste des modèles via l’endpoint officiel', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'gemini-1.5-flash' },
            { id: 'gemini-2.0-flash' },
            { id: 'gemini-1.5-pro' },
            { id: 'text-embedding-004' }, // doit être filtré
          ],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await llmManager.testAiApiKey({
        provider: 'gemini',
        apiKey: 'AIzaSyValidGeminiKey',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Clé valide ✅');
      expect(res.models).toContain('gemini-1.5-flash');
      expect(res.models).not.toContain('text-embedding-004');

      // Vérification de l'URL et des en-têtes
      expect(mockFetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/openai/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer AIzaSyValidGeminiKey',
          }),
        })
      );
    });

    it('bloque immédiatement sans requête réseau si une clé AIza est envoyée à OpenAI', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const res = await llmManager.testAiApiKey({
        provider: 'openai',
        apiKey: 'AIzaSyGoogleKeySentToOpenAI',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Cette clé ressemble à une clé Google Gemini : choisis le fournisseur Google Gemini.');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('bloque immédiatement si l’endpoint personnalisé est vide sans contacter api.openai.com', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const res = await llmManager.testAiApiKey({
        provider: 'custom',
        apiKey: 'some_key',
        apiEndpoint: '',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Veuillez renseigner l’adresse (endpoint)');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('gère correctement une erreur réseau (serveur indisponible)', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));
      vi.stubGlobal('fetch', mockFetch);

      const res = await llmManager.testAiApiKey({
        provider: 'gemini',
        apiKey: 'AIzaSyNetworkFailKey',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Impossible de joindre le service : vérifie ta connexion ou ton pare-feu.');
    });

    it('génère une phrase avec succès via testAiGeneration', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'The bright blue sky had not a single cloud all afternoon.',
              },
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await llmManager.testAiGeneration({
        provider: 'gemini',
        apiKey: 'AIzaSyGenerateKey',
        model: 'gemini-1.5-flash',
      });

      expect(res.success).toBe(true);
      expect(res.sentence).toBe('The bright blue sky had not a single cloud all afternoon.');
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
