import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  normalizeAnswer,
  evaluateAnswer,
  estimateEnglishLevel,
} from '../src/shared/levenshtein/correction';

describe('Levenshtein & Smart Correction', () => {
  it('normalise correctement le texte (casse, espaces, ponctuation)', () => {
    expect(normalizeAnswer('  Hello, World!  ')).toBe('hello world');
    expect(normalizeAnswer('To be, or not to be...')).toBe('to be or not to be');
  });

  it('calcule la distance de Levenshtein exacte', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('book', 'back')).toBe(2);
    expect(levenshteinDistance('apple', 'apple')).toBe(0);
    expect(levenshteinDistance('', 'test')).toBe(4);
  });

  it('identifie une réponse exacte même avec casse ou espaces superflus', () => {
    const res = evaluateAnswer('1', 'chat', 'cat', '  CAT  ');
    expect(res.status).toBe('exact');
    expect(res.distance).toBe(0);
  });

  it('tolère les petites fautes de frappe (status almost)', () => {
    // Mot court (>= 3 lettres) : tolérance 1 faute
    const resShort = evaluateAnswer('2', 'livre', 'book', 'bok');
    expect(resShort.status).toBe('almost');
    expect(resShort.distance).toBe(1);

    // Mot long (>= 6 lettres) : tolérance jusqu’à 2 fautes
    const resLong = evaluateAnswer('3', 'magnifique', 'beautiful', 'beautifull');
    expect(resLong.status).toBe('almost');

    const resLong2 = evaluateAnswer('4', 'magnifique', 'beautiful', 'beautful');
    expect(resLong2.status).toBe('almost');
  });

  it('marque comme faux en cas d’erreur trop importante', () => {
    const res = evaluateAnswer('5', 'chien', 'dog', 'cat');
    expect(res.status).toBe('wrong');
  });

  it('supporte les synonymes séparés par des barres obliques', () => {
    const res1 = evaluateAnswer('6', 'voiture', 'car / automobile', 'automobile');
    expect(res1.status).toBe('exact');

    const res2 = evaluateAnswer('7', 'voiture', 'car / automobile', 'car');
    expect(res2.status).toBe('exact');

    const res3 = evaluateAnswer('8', 'voiture', 'car / automobile', 'automobil');
    expect(res3.status).toBe('almost');
  });

  it('estime le niveau CECRL selon les mots maîtrisés et le score', () => {
    expect(estimateEnglishLevel(40, 5)).toBe('A1');
    expect(estimateEnglishLevel(60, 25)).toBe('A2');
    expect(estimateEnglishLevel(70, 70)).toBe('B1');
    expect(estimateEnglishLevel(80, 160)).toBe('B2');
    expect(estimateEnglishLevel(90, 320)).toBe('C1');
  });
});
