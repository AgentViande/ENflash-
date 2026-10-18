import { LeitnerBox, ReviewHistoryEntry, Word, WordStatus } from '../types';
import { LEITNER_INTERVALS_DAYS } from '../constants';
import { addDaysToDate, getParisDayKey } from '../date/parisDate';

export { addDaysToDate, getParisDayKey };

/**
 * Retourne la date courante dans le fuseau Europe/Paris au format YYYY-MM-DD
 */
export function getTodayDateString(date: Date | number | string = new Date()): string {
  return getParisDayKey(date);
}

/**
 * Détermine le statut d'un mot en fonction de sa boîte Leitner et de son historique
 */
export function getWordStatus(leitnerBox: LeitnerBox, totalReviews: number): WordStatus {
  if (leitnerBox === 5) return 'mastered';
  if (totalReviews === 0 && leitnerBox === 1) return 'new';
  return 'learning';
}

/**
 * Calcule la prochaine boîte Leitner après une révision :
 * - En cas de succès : boîte + 1 (plafonnée à 5)
 * - En cas d'échec : retour direct en boîte 1 pour réancrage immédiat
 */
export function computeNextBox(currentBox: LeitnerBox, success: boolean): LeitnerBox {
  if (success) {
    return Math.min(5, currentBox + 1) as LeitnerBox;
  }
  return 1;
}

/**
 * Applique le résultat d'une révision à un mot et met à jour son état, ses compteurs et son historique
 */
export function applyReviewResult(
  word: Word,
  success: boolean,
  mode: 'flashcard' | 'daily' | 'eval',
  todayDateStr: string = getTodayDateString(),
  isoTimestamp: string = new Date().toISOString()
): Word {
  const previousBox = word.leitnerBox;
  const newBox = computeNextBox(previousBox, success);
  const intervalDays = LEITNER_INTERVALS_DAYS[newBox];
  const nextReviewDate = addDaysToDate(todayDateStr, intervalDays);

  const historyEntry: ReviewHistoryEntry = {
    date: isoTimestamp,
    success,
    mode,
    previousBox,
    newBox,
  };

  return {
    ...word,
    leitnerBox: newBox,
    nextReviewDate,
    lastReviewedAt: isoTimestamp,
    totalReviews: word.totalReviews + 1,
    successCount: success ? word.successCount + 1 : word.successCount,
    failureCount: !success ? word.failureCount + 1 : word.failureCount,
    reviewHistory: [...(word.reviewHistory || []), historyEntry],
    updatedAt: isoTimestamp,
  };
}
