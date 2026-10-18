/**
 * Synthétiseur d'effets sonores via Web Audio API et synthèse vocale TTS
 * 100 % autonome : aucun fichier audio externe requis !
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Joue une tonalité synthétisée avec enveloppe ADSR
 */
function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  volume: number = 0.5,
  delay: number = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const startTime = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/**
 * Son de succès (arpège ascendant lumineux C5 - E5 - G5 - C6)
 */
export function playSuccessSound(volume: number = 0.5): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    playTone(freq, 'triangle', 0.15, volume * 0.4, i * 0.06);
  });
}

/**
 * Son d'erreur (tonalité basse douce)
 */
export function playWrongSound(volume: number = 0.5): void {
  playTone(220, 'sine', 0.25, volume * 0.4, 0);
  playTone(185, 'sine', 0.3, volume * 0.35, 0.1);
}

/**
 * Son de retournement de carte (clic / bruissement)
 */
export function playFlipSound(volume: number = 0.5): void {
  playTone(800, 'sine', 0.06, volume * 0.25, 0);
  playTone(1200, 'triangle', 0.05, volume * 0.2, 0.03);
}

/**
 * Son de passage de niveau (fanfare triomphale)
 */
export function playLevelUpSound(volume: number = 0.5): void {
  const notes = [440, 554.37, 659.25, 880, 1108.73];
  notes.forEach((freq, i) => {
    playTone(freq, 'sine', 0.28, volume * 0.45, i * 0.08);
  });
}

/**
 * Son d'animation de flamme de streak
 */
export function playStreakFlameSound(volume: number = 0.5): void {
  playTone(392, 'triangle', 0.18, volume * 0.35, 0);
  playTone(587.33, 'triangle', 0.25, volume * 0.4, 0.08);
}

import { VoiceAccent } from '../../../shared/types';

export interface SpeakOptions {
  accent?: VoiceAccent;
  speed?: number; // 0.6 à 1.2
  isSlow?: boolean; // Mode ralenti (0.7x)
  preferredVoiceId?: string;
}

let currentAudioElement: HTMLAudioElement | null = null;
let lastSpokenText: string | null = null;
let lastSpokenOptions: SpeakOptions | null = null;

/**
 * Sélectionne la meilleure voix anglaise installée sur le système
 * Priorité aux voix Natural / Neural / Enhanced / Premium, jamais une voix non-anglaise
 */
export function getBestSystemEnglishVoice(accent: VoiceAccent = 'en-US'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Filtrer uniquement les voix anglaises
  const englishVoices = voices.filter(
    (v) => v.lang.toLowerCase().startsWith('en') || v.lang.toLowerCase().startsWith('en_')
  );

  if (englishVoices.length === 0) return null;

  const qualityKeywords = ['natural', 'neural', 'online', 'premium', 'enhanced'];

  // 1. Voix haute qualité de l'accent exact demandé (ex: en-US ou en-GB)
  const targetTag = accent.toLowerCase();
  const highQualityExact = englishVoices.find(
    (v) =>
      v.lang.toLowerCase().replace('_', '-').startsWith(targetTag) &&
      qualityKeywords.some((k) => v.name.toLowerCase().includes(k))
  );
  if (highQualityExact) return highQualityExact;

  // 2. N'importe quelle voix haute qualité anglaise
  const highQualityAny = englishVoices.find((v) =>
    qualityKeywords.some((k) => v.name.toLowerCase().includes(k))
  );
  if (highQualityAny) return highQualityAny;

  // 3. Voix de l'accent exact demandé
  const exactAccent = englishVoices.find((v) =>
    v.lang.toLowerCase().replace('_', '-').startsWith(targetTag)
  );
  if (exactAccent) return exactAccent;

  // 4. Première voix anglaise trouvée
  return englishVoices[0];
}

/**
 * Synthèse vocale de dernier recours via la Web Speech API
 */
function speakSystemFallback(text: string, options: SpeakOptions): void {
  if (!('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const accent = options.accent || 'en-US';
    utterance.lang = accent;

    const rate = options.isSlow
      ? 0.7
      : Math.max(0.6, Math.min(1.2, options.speed ?? 1.0));
    utterance.rate = rate;

    const bestVoice = getBestSystemEnglishVoice(accent);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Fallback système vocal :', err);
  }
}

/**
 * Système de prononciation audio en cascade :
 * 1. Cache local disque
 * 2. Voix neuronale hors ligne (Piper)
 * 3. Enregistrement humain gratuit (Free Dictionary API)
 * 4. Voix système naturelle filtrée
 */
export async function speakText(text: string, options: SpeakOptions = {}): Promise<void> {
  if (!text || !text.trim()) return;

  lastSpokenText = text;
  lastSpokenOptions = options;

  // Arrêter l'audio en cours s'il y en a un
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {}
    currentAudioElement = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  const accent = options.accent || 'en-US';

  // Si on est dans Electron, tenter la cascade locale (Cache -> Piper -> Dictionary API)
  if (typeof window !== 'undefined' && window.api?.getAudioDataUrl) {
    try {
      const res = await window.api.getAudioDataUrl({
        text,
        accent,
        preferredVoiceId: options.preferredVoiceId,
      });

      if (res && res.success && res.dataUrl) {
        const audio = new Audio(res.dataUrl);
        currentAudioElement = audio;

        const rate = options.isSlow
          ? 0.7
          : Math.max(0.6, Math.min(1.2, options.speed ?? 1.0));
        audio.playbackRate = rate;
        audio.volume = 1.0;

        await audio.play();
        return;
      }
    } catch (err) {
      // Échec silencieux, descente au palier système
      console.warn('Cascade audio (Piper / Dictionary) indisponible, bascule système :', err);
    }
  }

  // Palier 4 : Voix système en dernier recours
  speakSystemFallback(text, options);
}

/**
 * Raccourci pour réécouter le dernier son joué (Touche P)
 */
export function replayLastAudio(): void {
  if (lastSpokenText) {
    speakText(lastSpokenText, lastSpokenOptions || {});
  }
}

/**
 * Préchargement en arrière-plan d'une liste de mots (ex: pour le test quotidien)
 */
export function preloadAudioList(
  words: string[],
  accent: VoiceAccent = 'en-US',
  preferredVoiceId?: string
): void {
  if (typeof window === 'undefined' || !window.api?.getAudioDataUrl) return;

  // Préchargement asynchrone échelonné pour ne pas saturer le thread
  words.forEach((word, index) => {
    setTimeout(() => {
      window.api.getAudioDataUrl({
        text: word,
        accent,
        preferredVoiceId,
      }).catch(() => {});
    }, index * 200);
  });
}

/**
 * Rétro-compatibilité : prononcer un mot avec l'accent spécifié
 */
export function speakWord(
  text: string,
  accent: VoiceAccent = 'en-US',
  options?: Partial<SpeakOptions>
): void {
  speakText(text, { accent, ...options });
}

