import { StreakState } from '../types';
import { daysBetweenDates, getParisDayKey } from '../date/parisDate';

export { daysBetweenDates };

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
 * Protection anti-triche : ignore le recul d'horloge.
 */
export function evaluateStreakBeforeToday(
  state: StreakState,
  todayStr: string = getParisDayKey()
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

  // Protection anti-triche : l'horloge système a reculé
  if (diff < 0) {
    return {
      currentStreak: state.currentStreak,
      streakFreezes: state.streakFreezes,
      freezeUsed: false,
      streakLost: false,
      missedDays: 0,
    };
  }

  // Même jour (déjà fait ou en cours) ou jour consécutif immédiat (hier validé)
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
  isRollback?: boolean;
}

/**
 * Valide la complétion du test quotidien et met à jour l'état du streak :
 * - Incrémente le streak si nouveau jour calendaire (Paris)
 * - Met à jour le record personnel
 * - Offre 1 joker de gel tous les 7 jours consécutifs
 * - Enregistre l'activité sur le calendrier
 * - Protection anti-triche si l'horloge a reculé
 */
export function recordDailyCompletion(
  currentState: StreakState,
  todayStr: string = getParisDayKey()
): DailyCompletionResult {
  // Protection anti-triche : si l'horloge recule par rapport au dernier jour validé
  if (currentState.lastCompletedDate && daysBetweenDates(currentState.lastCompletedDate, todayStr) < 0) {
    return {
      newState: currentState,
      newStreak: currentState.currentStreak,
      freezeEarned: false,
      freezeUsed: false,
      isNewRecord: false,
      isRollback: true,
    };
  }

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
    lastCompletedDate: alreadyDoneToday ? currentState.lastCompletedDate : todayStr,
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
