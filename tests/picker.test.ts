import { describe, it, expect } from 'vitest';
import { calculateWordPriority, pickDailyTestWords } from '../src/shared/picker/weightedPicker';
import { Word } from '../src/shared/types';

function createMockWord(id: string, box: 1 | 2 | 3 | 4 | 5, overdueDays: number = 0, failureRatio: number = 0): Word {
  const today = '2026-10-17';
  const nextReviewDate = overdueDays > 0 ? '2026-10-10' : '2026-10-25';
  const totalReviews = failureRatio > 0 ? 10 : 0;
  const failureCount = failureRatio > 0 ? Math.round(10 * failureRatio) : 0;

  return {
    id,
    french: `mot_${id}`,
    english: `word_${id}`,
    tags: ['test'],
    leitnerBox: box,
    nextReviewDate,
    lastReviewedAt: null,
    reviewHistory: [],
    totalReviews,
    successCount: totalReviews - failureCount,
    failureCount,
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z',
  };
}

describe('Weighted Random Card Picker', () => {
  it('donne une priorité plus élevée aux boîtes faibles et aux mots en retard', () => {
    const today = '2026-10-17';
    const box1Word = createMockWord('1', 1, 0);
    const box5Word = createMockWord('2', 5, 0);
    const overdueWord = createMockWord('3', 3, 5);

    const pBox1 = calculateWordPriority(box1Word, today);
    const pBox5 = calculateWordPriority(box5Word, today);
    const pOverdue = calculateWordPriority(overdueWord, today);

    expect(pBox1).toBeGreaterThan(pBox5);
    expect(pOverdue).toBeGreaterThan(pBox5);
  });

  it('retourne tous les mots si la liste contient moins de 20 mots', () => {
    const words = Array.from({ length: 8 }, (_, i) => createMockWord(`w_${i}`, 1));
    const picked = pickDailyTestWords(words, 20);
    expect(picked.length).toBe(8);
  });

  it('sélectionne exactement 20 mots sans doublons quand le catalogue en a plus', () => {
    const words = Array.from({ length: 45 }, (_, i) =>
      createMockWord(`w_${i}`, ((i % 5) + 1) as any, i % 3 === 0 ? 3 : 0)
    );

    const picked = pickDailyTestWords(words, 20);
    expect(picked.length).toBe(20);

    const ids = new Set(picked.map((w) => w.id));
    expect(ids.size).toBe(20); // Aucun doublon
  });
});
