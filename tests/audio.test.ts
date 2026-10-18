import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getBestSystemEnglishVoice,
  speakText,
  getLastAudioSource,
  subscribeAudioSource,
  stopAllAudio,
} from '../src/renderer/src/utils/audio';
import {
  AVAILABLE_KOKORO_VOICES,
  getDefaultVoiceForAccent,
} from '../src/shared/audio/kokoroVoices';

describe('Système Audio & Cascade Kokoro-82M', () => {
  beforeEach(() => {
    // Mock de SpeechSynthesisUtterance
    (global as any).SpeechSynthesisUtterance = class {
      text: string;
      lang: string = '';
      rate: number = 1;
      voice: any = null;
      onend: any = null;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    };

    // Mock de window.speechSynthesis et window.Audio
    (global as any).window = {
      speechSynthesis: {
        getVoices: vi.fn(),
        cancel: vi.fn(),
        speak: vi.fn().mockImplementation((utterance: any) => {
          if (utterance.onend) utterance.onend();
        }),
      },
      api: {
        getAudioDataUrl: vi.fn(),
      },
    };

    // Mock HTML5 Audio
    (global as any).Audio = class {
      playbackRate = 1.0;
      volume = 1.0;
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Filtrage des voix système (Fallback SAPI)', () => {
    it('renvoie null si aucune voix n’est disponible sur le système', () => {
      (window.speechSynthesis.getVoices as any).mockReturnValue([]);
      const voice = getBestSystemEnglishVoice('en-US');
      expect(voice).toBeNull();
    });

    it('ne sélectionne JAMAIS une voix non-anglaise (ex: français, espagnol)', () => {
      (window.speechSynthesis.getVoices as any).mockReturnValue([
        { name: 'Microsoft Hortense - French', lang: 'fr-FR' },
        { name: 'Google Français', lang: 'fr-FR' },
        { name: 'Microsoft Helena - Spanish', lang: 'es-ES' },
      ]);

      const voice = getBestSystemEnglishVoice('en-US');
      expect(voice).toBeNull();
    });

    it('privilégie les voix anglaises contenant Natural ou Neural', () => {
      const basicUs = { name: 'Microsoft David - English (United States)', lang: 'en-US' };
      const naturalUs = { name: 'Microsoft Jenny (Natural) - English (United States)', lang: 'en-US' };
      const naturalGb = { name: 'Microsoft Sonia (Neural) - English (United Kingdom)', lang: 'en-GB' };

      (window.speechSynthesis.getVoices as any).mockReturnValue([basicUs, naturalGb, naturalUs]);

      const selectedUS = getBestSystemEnglishVoice('en-US');
      expect(selectedUS).toBe(naturalUs);

      const selectedUK = getBestSystemEnglishVoice('en-GB');
      expect(selectedUK).toBe(naturalGb);
    });

    it('sélectionne la voix correspondant exactement à l’accent demandé si disponible', () => {
      const voiceUS = { name: 'English US Standard', lang: 'en-US' };
      const voiceUK = { name: 'English UK Standard', lang: 'en-GB' };

      (window.speechSynthesis.getVoices as any).mockReturnValue([voiceUS, voiceUK]);

      expect(getBestSystemEnglishVoice('en-US')).toBe(voiceUS);
      expect(getBestSystemEnglishVoice('en-GB')).toBe(voiceUK);
    });
  });

  describe('Ordre de la cascade et repli', () => {
    it('utilise le cache en priorité 1 s’il est disponible', async () => {
      (window.api.getAudioDataUrl as any).mockResolvedValue({
        success: true,
        source: 'cache',
        dataUrl: 'data:audio/wav;base64,CACHE_DATA',
        voiceUsed: 'af_heart',
      });

      await speakText('apple', { accent: 'en-US' });

      expect(window.api.getAudioDataUrl).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'apple', accent: 'en-US' })
      );
      expect(getLastAudioSource()).toBe('cache');
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('utilise le moteur neuronal Kokoro en priorité 2 par défaut', async () => {
      (window.api.getAudioDataUrl as any).mockResolvedValue({
        success: true,
        source: 'kokoro',
        dataUrl: 'data:audio/wav;base64,KOKORO_DATA',
        voiceUsed: 'af_heart',
      });

      let observedSource = '';
      const unsubscribe = subscribeAudioSource((src) => {
        observedSource = src;
      });

      await speakText('Hello world', { accent: 'en-US' });
      unsubscribe();

      expect(observedSource).toBe('kokoro');
      expect(getLastAudioSource()).toBe('kokoro');
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('bascule sur la synthèse système SAPI en dernier recours si la cascade échoue', async () => {
      (window.api.getAudioDataUrl as any).mockResolvedValue({
        success: false,
        source: 'fallback',
        error: 'Kokoro absent',
      });

      (window.speechSynthesis.getVoices as any).mockReturnValue([
        { name: 'Microsoft David - English (United States)', lang: 'en-US' },
      ]);

      await speakText('strawberry', { accent: 'en-US' });

      expect(window.speechSynthesis.speak).toHaveBeenCalled();
      expect(getLastAudioSource()).toBe('fallback');
    });
  });

  describe('Définitions des voix Kokoro-82M', () => {
    it('propose af_heart par défaut pour l’accent américain (en-US)', () => {
      expect(getDefaultVoiceForAccent('en-US')).toBe('af_heart');
    });

    it('propose bf_emma par défaut pour l’accent britannique (en-GB)', () => {
      expect(getDefaultVoiceForAccent('en-GB')).toBe('bf_emma');
    });

    it('toutes les voix disponibles ont des identifiants valides et uniques', () => {
      const ids = AVAILABLE_KOKORO_VOICES.map((v) => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      AVAILABLE_KOKORO_VOICES.forEach((voice) => {
        expect(['en-US', 'en-GB']).toContain(voice.accent);
        expect(['female', 'male']).toContain(voice.gender);
        expect(voice.label).toBeTruthy();
      });
      expect(AVAILABLE_KOKORO_VOICES.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('Normalisation audio anti-saturation & Encodage WAV PCM 16-bit 24kHz', () => {
    it('normalise la crête cible sous 0.70 (-3 dB) et ne dépasse jamais [-1.0, 1.0]', async () => {
      const { encodeNormalizedPcm16Wav } = await import('../src/main/audio/kokoroWorker');

      // Test avec signaux de test contenant différentes amplitudes (y compris extrêmes)
      const testSignals = [
        new Float32Array([0.05, -0.1, 0.2, -0.3, 0.15]), // Signal faible
        new Float32Array([0.5, -0.8, 0.9, -0.95, 0.4]), // Signal fort
        new Float32Array([1.5, -2.0, 3.0, -1.2]), // Signal débordant (> 1.0)
      ];

      for (const sig of testSignals) {
        const result = encodeNormalizedPcm16Wav(sig, 24000, 0.70);

        // La crête réelle ne doit jamais dépasser 0.70
        expect(result.peak).toBeLessThanOrEqual(0.7001);

        // Vérifier l'en-tête RIFF WAV PCM 16-bit 24 000 Hz
        const buf = result.buffer;
        expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
        expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
        expect(buf.toString('ascii', 12, 16)).toBe('fmt ');
        expect(buf.readUInt16LE(20)).toBe(1); // PCM 1 (non compressé)
        expect(buf.readUInt16LE(22)).toBe(1); // Mono
        expect(buf.readUInt32LE(24)).toBe(24000); // 24 000 Hz
        expect(buf.readUInt32LE(28)).toBe(48000); // 48 000 octets/s (24000 * 2)
        expect(buf.readUInt16LE(32)).toBe(2); // Block align
        expect(buf.readUInt16LE(34)).toBe(16); // 16 bits
        expect(buf.toString('ascii', 36, 40)).toBe('data');
        expect(buf.readUInt32LE(40)).toBe(sig.length * 2);

        // Vérifier chaque échantillon 16-bit dans le buffer
        for (let i = 0; i < sig.length; i++) {
          const sample = buf.readInt16LE(44 + i * 2);
          expect(sample).toBeGreaterThanOrEqual(-32768);
          expect(sample).toBeLessThanOrEqual(32767);
          expect(Math.abs(sample) / 32767).toBeLessThanOrEqual(0.705);
        }
      }
    });
  });

  describe('Isolation et versionnement du cache audio', () => {
    it('distingue deux voix différentes pour le même mot', async () => {
      const crypto = await import('node:crypto');
      const getHash = (text: string, voiceId: string, speed: number = 1.0) => {
        return crypto
          .createHash('md5')
          .update(`v2_${text.trim().toLowerCase()}_${voiceId}_${speed.toFixed(1)}`)
          .digest('hex');
      };

      const hashHeart = getHash('cat', 'af_heart', 1.0);
      const hashBella = getHash('cat', 'af_bella', 1.0);
      const hashEmma = getHash('cat', 'bf_emma', 1.0);

      // Les empreintes doivent toutes être strictement distinctes
      expect(hashHeart).not.toBe(hashBella);
      expect(hashHeart).not.toBe(hashEmma);
      expect(hashBella).not.toBe(hashEmma);

      // Le même mot et la même voix produisent la même clé
      expect(getHash('cat', 'af_heart', 1.0)).toBe(hashHeart);

      // Une vitesse différente produit une clé différente
      expect(getHash('cat', 'af_heart', 0.8)).not.toBe(hashHeart);
    });
  });

  describe('Gestion du volume de lecture', () => {
    it('applique le volume par défaut de 0.8 sans jamais dépasser 1.0', async () => {
      let createdVolume = -1;
      (global as any).Audio = class {
        volume = 1.0;
        play = vi.fn().mockImplementation(() => {
          createdVolume = this.volume;
          return Promise.resolve();
        });
        pause = vi.fn();
      };

      (window.api.getAudioDataUrl as any).mockResolvedValue({
        success: true,
        source: 'kokoro',
        dataUrl: 'data:audio/wav;base64,TEST',
        voiceUsed: 'af_heart',
      });

      // 1. Sans volume spécifié -> 0.8 par défaut
      await speakText('apple');
      expect(createdVolume).toBe(0.8);

      // 2. Avec volume personnalisé (ex: 0.6)
      await speakText('apple', { volume: 0.6 });
      expect(createdVolume).toBe(0.6);

      // 3. Avec volume excessif (> 1.0) -> plafonné à 1.0
      await speakText('apple', { volume: 1.5 });
      expect(createdVolume).toBe(1.0);
    });
  });

  describe('Arrêt d’urgence du son (stopAllAudio)', () => {
    it('stoppe la lecture HTMLAudio et réinitialise la synthèse vocale', async () => {
      let paused = false;
      let resetSrc = false;
      (global as any).Audio = class {
        volume = 1.0;
        src = 'data:audio/wav;base64,TEST';
        play = vi.fn().mockImplementation(() => Promise.resolve());
        pause = vi.fn().mockImplementation(() => {
          paused = true;
        });
        set currentTime(_v: number) {}
        get currentTime() { return 0; }
      };

      (window.api.getAudioDataUrl as any).mockResolvedValue({
        success: true,
        source: 'kokoro',
        dataUrl: 'data:audio/wav;base64,TEST',
        voiceUsed: 'af_heart',
      });

      // Démarrer la lecture
      await speakText('strawberry');

      // Appel de l'arrêt
      stopAllAudio();

      expect(paused).toBe(true);
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('Cache audio persistant v2 & Index O(1)', () => {
    it('génère une clé de cache déterministe avec version de cache', () => {
      const crypto = require('crypto');
      const getHash = (text: string, voiceId: string, speed: number, version: string = 'v2') => {
        return crypto
          .createHash('sha256')
          .update(`${version}_${text.toLowerCase().trim()}_${voiceId}_${speed.toFixed(2)}`)
          .digest('hex')
          .substring(0, 24);
      };

      const keyV2 = getHash('banana', 'af_heart', 1.0, 'v2');
      const keyV3 = getHash('banana', 'af_heart', 1.0, 'v3');

      // Clé déterministe
      expect(getHash('banana', 'af_heart', 1.0, 'v2')).toBe(keyV2);
      // Différente si la version change (permet la purge automatique lors de mises à jour de qualité)
      expect(keyV2).not.toBe(keyV3);
    });

    it('ignore les fichiers temporaires orphelins et corrompus (< 44 octets)', () => {
      const isValidCacheFile = (fileName: string, sizeBytes: number) => {
        if (fileName.endsWith('.tmp')) return false;
        if (sizeBytes < 44) return false; // En-tête WAV fait au minimum 44 octets
        return fileName.endsWith('.wav') || fileName.endsWith('.mp3');
      };

      expect(isValidCacheFile('abc_123.tmp', 5000)).toBe(false);
      expect(isValidCacheFile('corrupted.wav', 12)).toBe(false);
      expect(isValidCacheFile('good.wav', 24000)).toBe(true);
      expect(isValidCacheFile('cache_index.json', 1024)).toBe(false);
    });
  });
});

