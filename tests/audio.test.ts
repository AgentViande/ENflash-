import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getBestSystemEnglishVoice,
  speakText,
  getLastAudioSource,
  subscribeAudioSource,
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
    });
  });
});
