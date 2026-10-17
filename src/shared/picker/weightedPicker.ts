import { Word } from '../types';
import { daysBetweenDates } from '../streak/streakCalculator';
import { getTodayDateString } from '../srs/leitner';

/**
 * Calcule le poids de priorité d'un mot pour le tirage du test quotidien.
 * Plus le poids est élevé, plus le mot a de chances d'être sélectionné en priorité.
 */
export function calculateWordPriority(word: Word, todayStr: string): number {
  // 1. Poids lié à la boîte Leitner (priorité aux boîtes 1, 2 et 3)
  const boxWeights: Record<number, number> = {
    1: 60,
    2: 45,
    3: 30,
    4: 15,
    5: 5,
  };
  const baseWeight = boxWeights[word.leitnerBox] || 20;

  // 2. Retard de révision : si nextReviewDate est passée, fort bonus
  let overdueWeight = 0;
  if (word.nextReviewDate) {
    const daysLate = daysBetweenDates(word.nextReviewDate, todayStr);
    if (daysLate > 0) {
      overdueWeight = Math.min(50, daysLate * 5);
    }
  }

  // 3. Taux d'échec historique : bonus pour les mots qui posent problème
  let failureWeight = 0;
  if (word.totalReviews > 0) {
    const failureRatio = word.failureCount / word.totalReviews;
    failureWeight = Math.round(failureRatio * 30);
  }

  // 4. Mots jamais revus (nouveaux) : bonus d'amorçage
  const newWordBonus = word.totalReviews === 0 ? 25 : 0;

  return Math.max(1, baseWeight + overdueWeight + failureWeight + newWordBonus);
}

/**
 * Mélange un tableau selon l'algorithme de Fisher-Yates
 */
export function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Sélectionne `count` mots (par défaut 20) par tirage pondéré sans remise.
 * Si le vocabulaire contient moins de `count` mots, tous les mots sont retournés mélangés.
 */
export function pickDailyTestWords(
  words: Word[],
  count: number = 20,
  todayStr: string = getTodayDateString()
): Word[] {
  if (words.length <= count) {
    return shuffleArray(words);
  }

  // Copie de travail avec les poids calculés
  const pool = words.map((w) => ({
    word: w,
    weight: calculateWordPriority(w, todayStr),
  }));

  const selected: Word[] = [];

  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((acc, item) => acc + item.weight, 0);
    let threshold = Math.random() * totalWeight;

    let pickedIndex = -1;
    for (let i = 0; i < pool.length; i++) {
      threshold -= pool[i].weight;
      if (threshold <= 0) {
        pickedIndex = i;
        break;
      }
    }

    if (pickedIndex === -1) {
      pickedIndex = pool.length - 1;
    }

    selected.push(pool[pickedIndex].word);
    pool.splice(pickedIndex, 1);
  }

  // Mélange final pour varier l'ordre de présentation
  return shuffleArray(selected);
}
