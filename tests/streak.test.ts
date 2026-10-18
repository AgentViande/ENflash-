import { describe, it, expect } from 'vitest';
import {
  daysBetweenDates,
  evaluateStreakBeforeToday,
  recordDailyCompletion,
} from '../src/shared/streak/streakCalculator';
import { StreakState } from '../src/shared/types';

describe('Streak Calculator & Freeze Protection', () => {
  it('calcule exactement le nombre de jours entre deux dates', () => {
    expect(daysBetweenDates('2026-10-15', '2026-10-16')).toBe(1);
    expect(daysBetweenDates('2026-10-15', '2026-10-17')).toBe(2);
    expect(daysBetweenDates('2026-10-17', '2026-10-17')).toBe(0);
  });

  it('maintient le streak actif si la veille a été complétée', () => {
    const state: StreakState = {
      currentStreak: 5,
      maxStreak: 5,
      lastCompletedDate: '2026-10-16',
      streakFreezes: 0,
      activityCalendar: {},
    };

    const evalRes = evaluateStreakBeforeToday(state, '2026-10-17');
    expect(evalRes.currentStreak).toBe(5);
    expect(evalRes.streakLost).toBe(false);
    expect(evalRes.freezeUsed).toBe(false);
  });

  it('consomme un joker de gel pour sauver le streak en cas de jour manqué', () => {
    const state: StreakState = {
      currentStreak: 8,
      maxStreak: 10,
      lastCompletedDate: '2026-10-15', // 1 jour manqué (le 16)
      streakFreezes: 2,
      activityCalendar: {},
    };

    const evalRes = evaluateStreakBeforeToday(state, '2026-10-17');
    expect(evalRes.currentStreak).toBe(8); // Préservé !
    expect(evalRes.streakFreezes).toBe(1); // 1 consommé
    expect(evalRes.freezeUsed).toBe(true);
    expect(evalRes.streakLost).toBe(false);
  });

  it('réinitialise le streak si pas de joker disponible lors d’un jour manqué', () => {
    const state: StreakState = {
      currentStreak: 12,
      maxStreak: 12,
      lastCompletedDate: '2026-10-14',
      streakFreezes: 0,
      activityCalendar: {},
    };

    const evalRes = evaluateStreakBeforeToday(state, '2026-10-17');
    expect(evalRes.currentStreak).toBe(0);
    expect(evalRes.streakLost).toBe(true);
  });

  it('incrémente le streak lors de la complétion du test et offre un joker tous les 7 jours', () => {
    const state: StreakState = {
      currentStreak: 6,
      maxStreak: 6,
      lastCompletedDate: '2026-10-16',
      streakFreezes: 0,
      activityCalendar: {},
    };

    const res = recordDailyCompletion(state, '2026-10-17');
    expect(res.newStreak).toBe(7);
    expect(res.freezeEarned).toBe(true); // 7ème jour = 1 joker de gel offert
    expect(res.newState.streakFreezes).toBe(1);
    expect(res.isNewRecord).toBe(true);
    expect(res.newState.maxStreak).toBe(7);
    expect(res.newState.activityCalendar['2026-10-17']).toBe(1);
  });

  it('ne compte pas deux fois le streak si fait plusieurs fois le même jour', () => {
    const state: StreakState = {
      currentStreak: 4,
      maxStreak: 4,
      lastCompletedDate: '2026-10-17',
      streakFreezes: 0,
      activityCalendar: { '2026-10-17': 1 },
    };

    const res = recordDailyCompletion(state, '2026-10-17');
    expect(res.newStreak).toBe(4);
    expect(res.newState.activityCalendar['2026-10-17']).toBe(2);
  });

  it('incrémente le streak entre 23h59 (jour J) et 00h01 (jour J+1) soit 2 minutes d’écart', () => {
    // Jour J validé à 23h59 Paris
    const stateJourJ: StreakState = {
      currentStreak: 3,
      maxStreak: 3,
      lastCompletedDate: '2026-10-18',
      streakFreezes: 0,
      activityCalendar: { '2026-10-18': 1 },
    };

    // Validation à 00h01 Paris le lendemain (clé de jour : 2026-10-19)
    const res = recordDailyCompletion(stateJourJ, '2026-10-19');
    expect(res.newStreak).toBe(4); // +1 bien compté !
    expect(res.newState.lastCompletedDate).toBe('2026-10-19');
  });

  it('incrémente le streak à 08h00 puis le lendemain à 07h00 (23 h d’écart < 24 h glissantes)', () => {
    // Jour J validé à 08h00
    const stateJourJ: StreakState = {
      currentStreak: 5,
      maxStreak: 5,
      lastCompletedDate: '2026-10-18',
      streakFreezes: 0,
      activityCalendar: { '2026-10-18': 1 },
    };

    // Test le lendemain à 07h00 (moins de 24h d'écart réel, mais nouveau jour calendaire !)
    const res = recordDailyCompletion(stateJourJ, '2026-10-19');
    expect(res.newStreak).toBe(6); // Bien augmenté de 1 !
    expect(res.newState.lastCompletedDate).toBe('2026-10-19');
  });

  it('ignore le recul de l’horloge système sans altérer le streak ni accorder de récompense (anti-triche)', () => {
    const state: StreakState = {
      currentStreak: 10,
      maxStreak: 10,
      lastCompletedDate: '2026-10-18',
      streakFreezes: 1,
      activityCalendar: { '2026-10-18': 1 },
    };

    // Tentative de validation avec une date antérieure au dernier jour validé
    const res = recordDailyCompletion(state, '2026-10-17');
    expect(res.newStreak).toBe(10);
    expect(res.isRollback).toBe(true);
    expect(res.freezeEarned).toBe(false);
    expect(res.newState.lastCompletedDate).toBe('2026-10-18'); // Non écrasé

    // Évaluation avant aujourd'hui avec horloge reculée
    const evalRes = evaluateStreakBeforeToday(state, '2026-10-17');
    expect(evalRes.currentStreak).toBe(10);
    expect(evalRes.streakLost).toBe(false);
    expect(evalRes.freezeUsed).toBe(false);
  });
});
