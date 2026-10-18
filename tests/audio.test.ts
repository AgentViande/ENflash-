import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBestSystemEnglishVoice } from '../src/renderer/src/utils/audio';

describe('Système Audio & Filtrage des Voix Système', () => {
  beforeEach(() => {
    // Mock de window.speechSynthesis
    (global as any).window = {
      speechSynthesis: {
        getVoices: vi.fn(),
        cancel: vi.fn(),
        speak: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('sélectionne une autre voix anglaise si l’accent exact n’est pas disponible', () => {
    const voiceUS = { name: 'English US Standard', lang: 'en-US' };

    (window.speechSynthesis.getVoices as any).mockReturnValue([voiceUS]);

    // On demande UK mais seul US est installé -> renvoie la voix US sans erreur
    expect(getBestSystemEnglishVoice('en-GB')).toBe(voiceUS);
  });
});
