import { StreakState } from '../types';

/**
 * Calcule le nombre de jours calendaires entre deux dates au format YYYY-MM-DD.
 * Utilise UTC pour éviter tout artefact lié aux changements d'heure (heure d'été/hiver).
 */
export function daysBetweenDates(dateStr1: string, dateStr2: string): number {
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / msPerDay);
}

export interface StreakCheckResult {
  currentStreak: number;
  streakFreezes: number;
  freezeUsed: boolean;
  streakLost: boolean;
  missedDays: number;
}

/**
 * Vérifie l'état actuel du streak au début de la journée avant validation du test quotidien.
 * Protège le streak grâce aux jokers de gel si des jours ont été manqués.
 */
export function evaluateStreakBeforeToday(
  state: StreakState,
  todayStr: string
): StreakCheckResult {
  if (!state.lastCompletedDate) {
    return {
      currentStreak: state.currentStreak,
      streakFreezes: state.streakFreezes,
      freezeUsed: false,
      streakLost: false,
      missedDays: 0,
    };
  }

  const diff = daysBetweenDates(state.lastCompletedDate, todayStr);

  // Même jour (déjà fait ou en cours) ou jour suivant consécutif (hier validé)
  if (diff <= 1) {
    return {
      currentStreak: state.currentStreak,
      streakFreezes: state.streakFreezes,
      freezeUsed: false,
      streakLost: false,
      missedDays: 0,
    };
  }

  // Des jours ont été manqués : diff >= 2
  const missedDays = diff - 1;

  if (state.streakFreezes >= missedDays) {
    // Les jokers ont pu couvrir l'ensemble des jours manqués
    return {
      currentStreak: state.currentStreak,
      streakFreezes: state.streakFreezes - missedDays,
      freezeUsed: true,
      streakLost: false,
      missedDays,
    };
  }

  // Pas assez de jokers : le streak est rompu
  return {
    currentStreak: 0,
    streakFreezes: 0,
    freezeUsed: state.streakFreezes > 0,
    streakLost: true,
    missedDays,
  };
}

export interface DailyCompletionResult {
  newState: StreakState;
  newStreak: number;
  freezeEarned: boolean;
  freezeUsed: boolean;
  isNewRecord: boolean;
}

/**
 * Valide la complétion du test quotidien et met à jour l'état du streak :
 * - Incrémente le streak
 * - Met à jour le record personnel
 * - Offre 1 joker de gel tous les 7 jours consécutifs
 * - Enregistre l'activité sur le calendrier
 */
export function recordDailyCompletion(
  currentState: StreakState,
  todayStr: string
): DailyCompletionResult {
  // Évaluer l'état actuel en prenant en compte d'éventuels gels de streak
  const check = evaluateStreakBeforeToday(currentState, todayStr);
  let streak = check.currentStreak;
  let freezes = check.streakFreezes;
  let freezeEarned = false;

  const alreadyDoneToday = currentState.lastCompletedDate === todayStr;

  if (!alreadyDoneToday) {
    streak += 1;

    // Récompense : 1 joker de gel tous les 7 jours de streak
    if (streak > 0 && streak % 7 === 0) {
      freezes += 1;
      freezeEarned = true;
    }
  }

  const newMax = Math.max(currentState.maxStreak, streak);
  const isNewRecord = streak > currentState.maxStreak;

  const currentActivityCount = currentState.activityCalendar[todayStr] || 0;
  const newCalendar = {
    ...currentState.activityCalendar,
    [todayStr]: currentActivityCount + 1,
  };

  const newState: StreakState = {
    currentStreak: streak,
    maxStreak: newMax,
    lastCompletedDate: todayStr,
    streakFreezes: freezes,
    activityCalendar: newCalendar,
  };

  return {
    newState,
    newStreak: streak,
    freezeEarned,
    freezeUsed: check.freezeUsed,
    isNewRecord,
  };
}
