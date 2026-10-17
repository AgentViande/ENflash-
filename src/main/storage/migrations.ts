import { AppDatabase } from '../../shared/types';
import { CURRENT_SCHEMA_VERSION, DEFAULT_APP_SETTINGS } from '../../shared/constants';

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
