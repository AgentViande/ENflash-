import { describe, it, expect } from 'vitest';
import {
  processDailyTestCompletion,
  processWeeklyEvaluationCompletion,
} from '../src/shared/daily/dailyTestManager';
import { AppDatabase, DailyTestResultItem, WeeklyAnswer, Word } from '../src/shared/types';
import { createInitialDatabase } from '../src/main/storage/initialData';

describe('Daily Test Rewards & Streak - Calendrier Europe/Paris', () => {
  const sampleWords: Word[] = [
    {
      id: 'w1',
      french: 'bonjour',
      english: 'hello',
      tags: [],
      leitnerBox: 1,
      nextReviewDate: '2026-10-18',
      lastReviewedAt: null,
      reviewHistory: [],
      totalReviews: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
    {
      id: 'w2',
      french: 'merci',
      english: 'thank you',
      tags: [],
      leitnerBox: 1,
      nextReviewDate: '2026-10-18',
      lastReviewedAt: null,
      reviewHistory: [],
      totalReviews: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
  ];

  it('attribue l’XP une seule fois si le test est refait 2 fois le même jour calendaire', () => {
    const db: AppDatabase = createInitialDatabase();
    db.words = [...sampleWords];

    const results: DailyTestResultItem[] = [
      { wordId: 'w1', success: true },
      { wordId: 'w2', success: true },
    ];

    // 1er test du jour (2026-10-18 à 14h00 Paris)
    const run1 = processDailyTestCompletion(db, results, '2026-10-18T12:00:00.000Z');
    expect(run1.isOfficial).toBe(true);
    expect(run1.xpEarned).toBe(60); // 50 + 2 * 5
    expect(run1.newStreak).toBe(1);
    expect(run1.newDailyTestDayKey).toBe('2026-10-18');
    // Vérification que les boîtes Leitner ont progressé (Boîte 1 -> Boîte 2)
    expect(run1.updatedWords.find((w) => w.id === 'w1')?.leitnerBox).toBe(2);

    // Mettre à jour l'état de la base comme le ferait AppContext
    const dbAfterRun1: AppDatabase = {
      ...db,
      words: run1.updatedWords,
      streak: run1.updatedStreak,
      lastDailyTestDayKey: run1.newDailyTestDayKey,
      lastStreakDayKey: run1.newStreakDayKey,
      dailyTests: [run1.session],
    };

    // 2ème test le MÊME jour (2026-10-18 à 18h00 Paris)
    const run2 = processDailyTestCompletion(dbAfterRun1, results, '2026-10-18T16:00:00.000Z');
    expect(run2.isOfficial).toBe(false); // Entraînement libre !
    expect(run2.xpEarned).toBe(0); // AUCUNE XP attribuée !
    expect(run2.session.isFreePractice).toBe(true);
    expect(run2.newStreak).toBe(1); // Streak inchangé !
    // Vérification stricte : les boîtes Leitner ne bougent PAS pendant l'entraînement libre
    expect(run2.updatedWords.find((w) => w.id === 'w1')?.leitnerBox).toBe(2);
  });

  it('permet de gagner à nouveau de l’XP et d’augmenter le streak entre 23h59 et 00h01', () => {
    const db: AppDatabase = createInitialDatabase();
    db.words = [...sampleWords];

    const results: DailyTestResultItem[] = [
      { wordId: 'w1', success: true },
      { wordId: 'w2', success: true },
    ];

    // 1er test : Jour J à 23h59 Paris (21h59 UTC en été UTC+2)
    const runDay1 = processDailyTestCompletion(db, results, '2026-10-18T21:59:00.000Z');
    expect(runDay1.isOfficial).toBe(true);
    expect(runDay1.newDailyTestDayKey).toBe('2026-10-18');
    expect(runDay1.xpEarned).toBe(60);
    expect(runDay1.newStreak).toBe(1);

    const dbDay1: AppDatabase = {
      ...db,
      words: runDay1.updatedWords,
      streak: runDay1.updatedStreak,
      lastDailyTestDayKey: runDay1.newDailyTestDayKey,
      lastStreakDayKey: runDay1.newStreakDayKey,
      dailyTests: [runDay1.session],
    };

    // 2ème test : Jour J+1 à 00h01 Paris (22h01 UTC le 18 octobre, soit 2 minutes plus tard !)
    const runDay2 = processDailyTestCompletion(dbDay1, results, '2026-10-18T22:01:00.000Z');
    expect(runDay2.isOfficial).toBe(true);
    expect(runDay2.newDailyTestDayKey).toBe('2026-10-19');
    expect(runDay2.xpEarned).toBe(60); // Nouvelle XP accordée car nouveau jour calendaire !
    expect(runDay2.newStreak).toBe(2); // Streak incrémenté (+1) !
  });

  it('incrémente le streak entre 08h00 et le lendemain 07h00 (< 24 h d’intervalle)', () => {
    const db: AppDatabase = createInitialDatabase();
    db.words = [...sampleWords];

    const results: DailyTestResultItem[] = [{ wordId: 'w1', success: true }];

    // Jour J à 08h00 Paris (06h00 UTC)
    const run1 = processDailyTestCompletion(db, results, '2026-10-18T06:00:00.000Z');
    expect(run1.isOfficial).toBe(true);
    expect(run1.newStreak).toBe(1);

    const dbDay1: AppDatabase = {
      ...db,
      words: run1.updatedWords,
      streak: run1.updatedStreak,
      lastDailyTestDayKey: run1.newDailyTestDayKey,
      lastStreakDayKey: run1.newStreakDayKey,
      dailyTests: [run1.session],
    };

    // Lendemain à 07h00 Paris (05h00 UTC, 23h d'écart)
    const run2 = processDailyTestCompletion(dbDay1, results, '2026-10-19T05:00:00.000Z');
    expect(run2.isOfficial).toBe(true);
    expect(run2.newStreak).toBe(2); // Valide sans devoir attendre 24 heures glissantes !
  });

  it('remet le streak à 1 après un jour manqué sans gel, mais le conserve et l’augmente avec gel', () => {
    const dbSansGel: AppDatabase = createInitialDatabase();
    dbSansGel.words = [...sampleWords];
    dbSansGel.streak = {
      currentStreak: 10,
      maxStreak: 10,
      lastCompletedDate: '2026-10-15', // 16 octobre manqué
      streakFreezes: 0, // Pas de joker
      activityCalendar: {},
    };
    dbSansGel.lastDailyTestDayKey = '2026-10-15';

    const results: DailyTestResultItem[] = [{ wordId: 'w1', success: true }];

    // Complétion le 17 octobre sans gel
    const resSansGel = processDailyTestCompletion(dbSansGel, results, '2026-10-17T10:00:00.000Z');
    expect(resSansGel.isOfficial).toBe(true);
    expect(resSansGel.newStreak).toBe(1); // Série brisée -> repart à 1

    // Cas avec gel de streak disponible
    const dbAvecGel: AppDatabase = createInitialDatabase();
    dbAvecGel.words = [...sampleWords];
    dbAvecGel.streak = {
      currentStreak: 10,
      maxStreak: 10,
      lastCompletedDate: '2026-10-15', // 16 octobre manqué
      streakFreezes: 2, // 2 jokers disponibles
      activityCalendar: {},
    };
    dbAvecGel.lastDailyTestDayKey = '2026-10-15';

    const resAvecGel = processDailyTestCompletion(dbAvecGel, results, '2026-10-17T10:00:00.000Z');
    expect(resAvecGel.isOfficial).toBe(true);
    expect(resAvecGel.newStreak).toBe(11); // Streak préservé (10) puis incrémenté (+1) = 11 !
    expect(resAvecGel.freezeUsed).toBe(true);
    expect(resAvecGel.updatedStreak.streakFreezes).toBe(1); // 1 joker consommé pour le jour manqué
  });

  it('protège contre le recul de l’horloge système (anti-triche)', () => {
    const db: AppDatabase = createInitialDatabase();
    db.words = [...sampleWords];
    db.streak = {
      currentStreak: 8,
      maxStreak: 8,
      lastCompletedDate: '2026-10-18',
      streakFreezes: 1,
      activityCalendar: {},
    };
    db.lastDailyTestDayKey = '2026-10-18';

    const results: DailyTestResultItem[] = [{ wordId: 'w1', success: true }];

    // L'utilisateur recule son horloge système au 17 octobre (date antérieure)
    const runCheat = processDailyTestCompletion(db, results, '2026-10-17T10:00:00.000Z');
    expect(runCheat.isOfficial).toBe(false);
    expect(runCheat.xpEarned).toBe(0); // Aucune récompense indue !
    expect(runCheat.newStreak).toBe(8); // Streak intact
    expect(runCheat.updatedWords).toEqual(db.words); // Boîtes Leitner non modifiées
  });

  it('attribue l’XP d’évaluation hebdomadaire une seule fois par semaine calendaire (lundi 00h00 Paris)', () => {
    const db: AppDatabase = createInitialDatabase();
    db.words = [...sampleWords];

    const answers: WeeklyAnswer[] = [
      {
        wordId: 'w1',
        french: 'bonjour',
        expected: 'hello',
        given: 'hello',
        status: 'exact',
        distance: 0,
      },
    ];

    // Mercredi 14 octobre 2026 (Semaine 2026-W42)
    const run1 = processWeeklyEvaluationCompletion(db, answers, '2026-10-14T14:00:00.000Z');
    expect(run1.isOfficial).toBe(true);
    expect(run1.xpEarned).toBeGreaterThan(0);
    expect(run1.newEvaluationWeekKey).toBe('2026-W42');

    const dbAfterEval1: AppDatabase = {
      ...db,
      lastEvaluationWeekKey: run1.newEvaluationWeekKey,
      weeklyEvaluations: [run1.evaluation],
    };

    // Samedi 17 octobre 2026 (même semaine 2026-W42)
    const runSameWeek = processWeeklyEvaluationCompletion(dbAfterEval1, answers, '2026-10-17T15:00:00.000Z');
    expect(runSameWeek.isOfficial).toBe(false); // Entraînement libre !
    expect(runSameWeek.xpEarned).toBe(0); // 0 XP
    expect(runSameWeek.evaluation.isFreePractice).toBe(true);

    // Lundi 19 octobre 2026 à 00h01 Paris (22h01 UTC le 18 oct, nouvelle semaine 2026-W43)
    const runNextWeek = processWeeklyEvaluationCompletion(dbAfterEval1, answers, '2026-10-18T22:01:00.000Z');
    expect(runNextWeek.isOfficial).toBe(true); // Nouvelle semaine = nouvelle attribution !
    expect(runNextWeek.xpEarned).toBeGreaterThan(0);
    expect(runNextWeek.newEvaluationWeekKey).toBe('2026-W43');
  });
});
