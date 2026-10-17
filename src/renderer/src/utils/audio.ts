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

/**
 * Synthèse vocale native pour prononciation en anglais US ou UK
 */
export function speakWord(text: string, accent: 'en-US' | 'en-GB' = 'en-US'): void {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // Stoppe toute lecture en cours

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent;
  utterance.rate = 0.9; // Rythme d'élocution naturel et clair

  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find((v) => v.lang === accent || v.lang.startsWith(accent.split('-')[0]));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
}
