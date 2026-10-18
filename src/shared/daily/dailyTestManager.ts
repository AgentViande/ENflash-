import {
  AppDatabase,
  DailyTestResultItem,
  DailyTestSession,
  WeeklyAnswer,
  WeeklyEvaluation,
  Word,
  StreakState,
} from '../types';
import { getParisDayKey, getParisWeekKey, isClockRollback } from '../date/parisDate';
import { applyReviewResult } from '../srs/leitner';
import { recordDailyCompletion } from '../streak/streakCalculator';
import { estimateEnglishLevel } from '../levenshtein/correction';

export interface DailyTestExecutionResult {
  isOfficial: boolean;
  session: DailyTestSession;
  updatedWords: Word[];
  updatedStreak: StreakState;
  newDailyTestDayKey: string | null;
  newStreakDayKey: string | null;
  xpEarned: number;
  newStreak: number;
  freezeUsed: boolean;
  freezeEarned: boolean;
}

/**
 * Traite la complétion d'un test quotidien :
 * - Si premier test du jour calendaire (Paris) : valide l'officiel, attribue l'XP, met à jour le streak et fait évoluer Leitner.
 * - Si test refait le même jour : bascule en entraînement libre (0 XP, streak inchangé, boîtes Leitner intactes).
 * - Si horloge système reculée : protection anti-triche (aucune récompense attribuée).
 */
export function processDailyTestCompletion(
  db: Pick<AppDatabase, 'words' | 'streak' | 'lastDailyTestDayKey' | 'lastStreakDayKey' | 'dailyTests'>,
  results: DailyTestResultItem[],
  currentDateInput: Date | number | string = new Date()
): DailyTestExecutionResult {
  const todayKey = getParisDayKey(currentDateInput);
  const score = results.filter((r) => r.success).length;
  const total = results.length;

  const isRollback = isClockRollback(todayKey, db.lastDailyTestDayKey);
  const isAlreadyDoneToday = db.lastDailyTestDayKey === todayKey;
  const isOfficial = !isAlreadyDoneToday && !isRollback;

  const dateObj = typeof currentDateInput === 'string' || typeof currentDateInput === 'number'
    ? new Date(currentDateInput)
    : currentDateInput;
  const isoTimestamp = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();

  if (isOfficial) {
    const xpEarned = 50 + score * 5;

    // Mise à jour des boîtes Leitner UNIQUEMENT lors du test officiel
    let updatedWords = [...db.words];
    for (const res of results) {
      const w = updatedWords.find((item) => item.id === res.wordId);
      if (w) {
        const updated = applyReviewResult(w, res.success, 'daily', todayKey, isoTimestamp);
        updatedWords = updatedWords.map((item) => (item.id === res.wordId ? updated : item));
      }
    }

    const streakRes = recordDailyCompletion(db.streak, todayKey);

    const session: DailyTestSession = {
      id: 'daily_' + Date.now(),
      date: todayKey,
      wordIds: results.map((r) => r.wordId),
      results,
      score,
      total,
      xpEarned,
      completedAt: isoTimestamp,
      isFreePractice: false,
    };

    return {
      isOfficial: true,
      session,
      updatedWords,
      updatedStreak: streakRes.newState,
      newDailyTestDayKey: todayKey,
      newStreakDayKey: todayKey,
      xpEarned,
      newStreak: streakRes.newStreak,
      freezeUsed: streakRes.freezeUsed,
      freezeEarned: streakRes.freezeEarned,
    };
  } else {
    // Mode entraînement libre : aucune XP, aucun impact sur le streak, aucun mouvement Leitner
    const session: DailyTestSession = {
      id: 'daily_free_' + Date.now(),
      date: todayKey,
      wordIds: results.map((r) => r.wordId),
      results,
      score,
      total,
      xpEarned: 0,
      completedAt: isoTimestamp,
      isFreePractice: true,
    };

    return {
      isOfficial: false,
      session,
      updatedWords: db.words, // Préservation stricte : les boîtes ne bougent pas
      updatedStreak: db.streak, // Préservation stricte : streak intact
      newDailyTestDayKey: db.lastDailyTestDayKey,
      newStreakDayKey: db.lastStreakDayKey || db.streak.lastCompletedDate,
      xpEarned: 0,
      newStreak: db.streak.currentStreak,
      freezeUsed: false,
      freezeEarned: false,
    };
  }
}

export interface WeeklyEvaluationExecutionResult {
  isOfficial: boolean;
  evaluation: WeeklyEvaluation;
  updatedWords: Word[];
  newEvaluationWeekKey: string | null;
  xpEarned: number;
  scorePercentage: number;
}

/**
 * Traite la complétion d'une évaluation hebdomadaire :
 * - Attribue l'XP UNE SEULE FOIS par semaine calendaire (lundi 00h00 heure de Paris).
 * - En cas de nouvelle tentative dans la même semaine : mode entraînement (0 XP).
 */
export function processWeeklyEvaluationCompletion(
  db: Pick<AppDatabase, 'words' | 'weeklyEvaluations' | 'lastEvaluationWeekKey' | 'lastDailyTestDayKey'>,
  answers: WeeklyAnswer[],
  currentDateInput: Date | number | string = new Date()
): WeeklyEvaluationExecutionResult {
  const todayKey = getParisDayKey(currentDateInput);
  const thisWeekKey = getParisWeekKey(currentDateInput);

  const exactCount = answers.filter((a) => a.status === 'exact').length;
  const almostCount = answers.filter((a) => a.status === 'almost').length;
  const totalPoints = exactCount + almostCount * 0.5;
  const scorePercentage = Math.round((totalPoints / Math.max(1, answers.length)) * 100);

  const masteredCount = db.words.filter((w) => w.leitnerBox === 5).length;
  const estimatedLevel = estimateEnglishLevel(scorePercentage, masteredCount);

  const isRollback = isClockRollback(todayKey, db.lastDailyTestDayKey);
  const isAlreadyDoneThisWeek = db.lastEvaluationWeekKey === thisWeekKey;
  const isOfficial = !isAlreadyDoneThisWeek && !isRollback;

  const dateObj = typeof currentDateInput === 'string' || typeof currentDateInput === 'number'
    ? new Date(currentDateInput)
    : currentDateInput;
  const isoTimestamp = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();

  if (isOfficial) {
    const xpEarned = 100 + Math.round(scorePercentage * 0.8);

    let updatedWords = [...db.words];
    for (const ans of answers) {
      const w = updatedWords.find((item) => item.id === ans.wordId);
      if (w) {
        const success = ans.status === 'exact' || ans.status === 'almost';
        const updated = applyReviewResult(w, success, 'eval', todayKey, isoTimestamp);
        updatedWords = updatedWords.map((item) => (item.id === ans.wordId ? updated : item));
      }
    }

    const evaluation: WeeklyEvaluation = {
      id: 'eval_' + Date.now(),
      date: todayKey,
      answers,
      scorePercentage,
      estimatedLevel,
      xpEarned,
      completedAt: isoTimestamp,
      isFreePractice: false,
    };

    return {
      isOfficial: true,
      evaluation,
      updatedWords,
      newEvaluationWeekKey: thisWeekKey,
      xpEarned,
      scorePercentage,
    };
  } else {
    // Mode entraînement libre d'évaluation hebdomadaire : 0 XP
    const evaluation: WeeklyEvaluation = {
      id: 'eval_free_' + Date.now(),
      date: todayKey,
      answers,
      scorePercentage,
      estimatedLevel,
      xpEarned: 0,
      completedAt: isoTimestamp,
      isFreePractice: true,
    };

    return {
      isOfficial: false,
      evaluation,
      updatedWords: db.words,
      newEvaluationWeekKey: db.lastEvaluationWeekKey,
      xpEarned: 0,
      scorePercentage,
    };
  }
}
