import { describe, it, expect } from 'vitest';
import {
  validateSentenceQuality,
  cleanRawOutput,
  getWordVariants,
} from '../src/main/llm/qualityControl';

describe('Contrôle Qualité des Phrases d’Exemple (Quality Control)', () => {
  describe('Variantes morphologiques des mots', () => {
    it('génère les formes de base et fléchies pour un mot simple', () => {
      const variants = getWordVariants('apple');
      expect(variants).toContain('apple');
      expect(variants).toContain('apples');
    });

    it('génère les formes verbales régulières', () => {
      const variants = getWordVariants('land');
      expect(variants).toContain('land');
      expect(variants).toContain('lands');
      expect(variants).toContain('landed');
      expect(variants).toContain('landing');
    });

    it('gère les termes composés aéronautiques comme "leading edge"', () => {
      const variants = getWordVariants('leading edge');
      expect(variants).toContain('leading edge');
      expect(variants).toContain('leading edges');
    });
  });

  describe('Nettoyage du texte généré (cleanRawOutput)', () => {
    it('retire les introductions de chatbot (Sure, Here is...)', () => {
      const raw = 'Sure! Here is a sentence: The airplane landed safely on the runway.';
      const clean = cleanRawOutput(raw);
      expect(clean).toBe('The airplane landed safely on the runway.');
    });

    it('retire les guillemets englobants et le markdown', () => {
      const raw = '"The **pilot** checked the flight instruments before takeoff."';
      const clean = cleanRawOutput(raw);
      expect(clean).toBe('The pilot checked the flight instruments before takeoff.');
    });

    it('retire les préfixes numérotés', () => {
      const raw = '1. The leading edge of the wing was damaged during hail.';
      const clean = cleanRawOutput(raw);
      expect(clean).toBe('The leading edge of the wing was damaged during hail.');
    });
  });

  describe('Validation stricte de la phrase', () => {
    it('valide une phrase correcte contenant le mot cible', () => {
      const result = validateSentenceQuality(
        'The airplane climbed smoothly above the dense clouds.',
        'airplane'
      );
      expect(result.isValid).toBe(true);
      expect(result.cleanSentence).toBe('The airplane climbed smoothly above the dense clouds.');
    });

    it('valide une phrase avec une variante fléchie (-ing, -ed, pluriel)', () => {
      const result = validateSentenceQuality(
        'The mechanics are inspecting the leading edges of the aircraft.',
        'leading edge'
      );
      expect(result.isValid).toBe(true);
    });

    it('rejette une phrase ne contenant pas le mot cible', () => {
      const result = validateSentenceQuality(
        'The train arrived exactly on time at the central station.',
        'airplane'
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('n\'apparaît pas');
    });

    it('rejette une phrase trop courte (< 5 mots)', () => {
      const result = validateSentenceQuality('Airplanes are very fast.', 'airplane'); // 4 mots
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('trop courte');
    });

    it('rejette une phrase trop longue (> 20 mots)', () => {
      const longSentence =
        'The modern passenger airplane with powerful twin jet engines designed by experienced aerospace engineers took off from the busy international airport into the sunset.';
      const result = validateSentenceQuality(longSentence, 'airplane');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('trop longue');
    });

    it('rejette une phrase sans majuscule initiale', () => {
      const result = validateSentenceQuality('the airplane landed safely on runway two.', 'airplane');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('majuscule');
    });

    it('rejette le texte conversationnel ou en français', () => {
      const result = validateSentenceQuality(
        'Voici une phrase en anglais pour vous: The airplane flies very high in the sky.',
        'airplane'
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('parasite');
    });
  });
});
