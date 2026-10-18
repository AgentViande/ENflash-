import { AppDatabase } from '../../shared/types';
import { CURRENT_SCHEMA_VERSION, DEFAULT_APP_SETTINGS } from '../../shared/constants';
import { getParisDayKey, getParisWeekKey } from '../../shared/date/parisDate';

export interface MigrationStep {
  version: number;
  description: string;
  up: (oldData: any) => any;
}

/**
 * Registre des migrations de schéma ordonnées par version croissante.
 * Permet de faire évoluer le modèle sans JAMAIS perdre de données existantes.
 */
export const MIGRATIONS: MigrationStep[] = [
  {
    version: 1,
    description: 'Initialisation du schéma v1 avec support Leitner, Playlists, Streak et Gamification',
    up: (data: any): AppDatabase => {
      return {
        schemaVersion: 1,
        words: Array.isArray(data?.words) ? data.words : [],
        playlists: Array.isArray(data?.playlists) ? data.playlists : [],
        dailyTests: Array.isArray(data?.dailyTests) ? data.dailyTests : [],
        weeklyEvaluations: Array.isArray(data?.weeklyEvaluations) ? data.weeklyEvaluations : [],
        streak: {
          currentStreak: Number(data?.streak?.currentStreak) || 0,
          maxStreak: Number(data?.streak?.maxStreak) || 0,
          lastCompletedDate: data?.streak?.lastCompletedDate || null,
          streakFreezes: Number(data?.streak?.streakFreezes) || 0,
          activityCalendar: data?.streak?.activityCalendar || {},
        },
        gamification: {
          xp: Number(data?.gamification?.xp) || 0,
          level: Number(data?.gamification?.level) || 1,
          unlockedBadges: Array.isArray(data?.gamification?.unlockedBadges) ? data.gamification.unlockedBadges : [],
        },
        settings: {
          ...DEFAULT_APP_SETTINGS,
          ...(data?.settings || {}),
        },
        lastDailyTestDayKey: null,
        lastStreakDayKey: null,
        lastEvaluationWeekKey: null,
      };
    },
  },
  {
    version: 2,
    description: 'Migration vers les clés calendaires Europe/Paris (lastDailyTestDayKey, lastStreakDayKey, lastEvaluationWeekKey)',
    up: (data: any): AppDatabase => {
      // Déterminer lastDailyTestDayKey depuis le dernier test quotidien ou lastCompletedDate
      let lastDailyTestDayKey: string | null = data?.lastDailyTestDayKey || null;
      if (!lastDailyTestDayKey) {
        if (Array.isArray(data?.dailyTests) && data.dailyTests.length > 0) {
          const latestTest = data.dailyTests[0];
          lastDailyTestDayKey = getParisDayKey(latestTest.completedAt || latestTest.date);
        } else if (data?.streak?.lastCompletedDate) {
          lastDailyTestDayKey = getParisDayKey(data.streak.lastCompletedDate);
        }
      }

      // Déterminer lastStreakDayKey depuis streak.lastCompletedDate
      let lastStreakDayKey: string | null = data?.lastStreakDayKey || null;
      if (!lastStreakDayKey && data?.streak?.lastCompletedDate) {
        lastStreakDayKey = getParisDayKey(data.streak.lastCompletedDate);
      }

      // Déterminer lastEvaluationWeekKey depuis la dernière évaluation
      let lastEvaluationWeekKey: string | null = data?.lastEvaluationWeekKey || null;
      if (!lastEvaluationWeekKey && Array.isArray(data?.weeklyEvaluations) && data.weeklyEvaluations.length > 0) {
        const latestEval = data.weeklyEvaluations[0];
        lastEvaluationWeekKey = getParisWeekKey(latestEval.completedAt || latestEval.date);
      }

      // Normaliser lastCompletedDate dans streak au format Paris si présent
      const normalizedLastCompleted = data?.streak?.lastCompletedDate
        ? getParisDayKey(data.streak.lastCompletedDate)
        : null;

      return {
        ...data,
        schemaVersion: 2,
        streak: {
          ...data.streak,
          lastCompletedDate: normalizedLastCompleted,
        },
        lastDailyTestDayKey,
        lastStreakDayKey,
        lastEvaluationWeekKey,
      };
    },
  },
];

/**
 * Exécute l'ensemble des migrations nécessaires sur les données brutes
 */
export function migrateDatabase(rawData: any, targetVersion: number = CURRENT_SCHEMA_VERSION): { migratedData: AppDatabase; migrationsRun: number } {
  let currentVersion = typeof rawData?.schemaVersion === 'number' ? rawData.schemaVersion : 0;
  let data = { ...rawData };
  let migrationsRun = 0;

  for (const step of MIGRATIONS) {
    if (step.version > currentVersion && step.version <= targetVersion) {
      data = step.up(data);
      currentVersion = step.version;
      data.schemaVersion = currentVersion;
      migrationsRun++;
    }
  }

  // S'assurer que le schéma est bien mis à jour
  data.schemaVersion = targetVersion;
  return { migratedData: data as AppDatabase, migrationsRun };
}
