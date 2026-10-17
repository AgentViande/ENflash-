import { describe, it, expect } from 'vitest';
import {
  computeNextBox,
  applyReviewResult,
  getWordStatus,
  addDaysToDate,
} from '../src/shared/srs/leitner';
import { Word } from '../src/shared/types';

describe('SRS Leitner System', () => {
  it('avance les boîtes en cas de succès jusqu’au plafond de 5', () => {
    expect(computeNextBox(1, true)).toBe(2);
    expect(computeNextBox(2, true)).toBe(3);
    expect(computeNextBox(3, true)).toBe(4);
    expect(computeNextBox(4, true)).toBe(5);
    expect(computeNextBox(5, true)).toBe(5); // Plafond
  });

  it('rétrograde immédiatement en boîte 1 en cas d’échec', () => {
    expect(computeNextBox(5, false)).toBe(1);
    expect(computeNextBox(4, false)).toBe(1);
    expect(computeNextBox(2, false)).toBe(1);
    expect(computeNextBox(1, false)).toBe(1);
  });

  it('calcule correctement les statuts (new, learning, mastered)', () => {
    expect(getWordStatus(1, 0)).toBe('new');
    expect(getWordStatus(1, 1)).toBe('learning');
    expect(getWordStatus(3, 4)).toBe('learning');
    expect(getWordStatus(5, 5)).toBe('mastered');
  });

  it('ajoute correctement des jours à une date ISO YYYY-MM-DD', () => {
    expect(addDaysToDate('2026-10-17', 1)).toBe('2026-10-18');
    expect(addDaysToDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToDate('2026-12-31', 2)).toBe('2027-01-02');
  });

  it('met à jour les compteurs et l’historique lors d’une révision réussie', () => {
    const initialWord: Word = {
      id: 'w1',
      french: 'pomme',
      english: 'apple',
      tags: ['fruits'],
      leitnerBox: 1,
      nextReviewDate: '2026-10-17',
      lastReviewedAt: null,
      reviewHistory: [],
      totalReviews: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: '2026-10-17T10:00:00.000Z',
      updatedAt: '2026-10-17T10:00:00.000Z',
    };

    const updated = applyReviewResult(initialWord, true, 'flashcard', '2026-10-17', '2026-10-17T12:00:00.000Z');

    expect(updated.leitnerBox).toBe(2);
    expect(updated.nextReviewDate).toBe('2026-10-19'); // Boîte 2 -> 2 jours
    expect(updated.totalReviews).toBe(1);
    expect(updated.successCount).toBe(1);
    expect(updated.failureCount).toBe(0);
    expect(updated.reviewHistory.length).toBe(1);
    expect(updated.reviewHistory[0].success).toBe(true);
    expect(updated.reviewHistory[0].previousBox).toBe(1);
    expect(updated.reviewHistory[0].newBox).toBe(2);
  });
});
