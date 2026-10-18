import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseStore } from '../src/main/storage/store';
import { migrateDatabase } from '../src/main/storage/migrations';
import { AppDatabase } from '../src/shared/types';

describe('Storage & Migration System', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enflash-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initialise correctement une nouvelle base avec les données de démarrage', () => {
    const store = new DatabaseStore(tempDir);
    const data = store.load();

    expect(data.schemaVersion).toBe(2);
    expect(data.words.length).toBeGreaterThan(0);
    expect(data.playlists.length).toBeGreaterThan(0);
    expect(data.settings.theme).toBe('dark');
    expect(data.lastDailyTestDayKey).toBeNull();
    expect(data.lastStreakDayKey).toBeNull();
    expect(data.lastEvaluationWeekKey).toBeNull();
    expect(fs.existsSync(store.getFilePath())).toBe(true);
  });

  it('écrit et recharge les données de manière atomique sans altération', () => {
    const store = new DatabaseStore(tempDir);
    const data = store.load();

    data.words.push({
      id: 'test-w1',
      french: 'maison',
      english: 'house',
      tags: ['habitat'],
      leitnerBox: 1,
      nextReviewDate: '2026-10-18',
      lastReviewedAt: null,
      reviewHistory: [],
      totalReviews: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: '2026-10-17T12:00:00.000Z',
      updatedAt: '2026-10-17T12:00:00.000Z',
    });

    store.save(data);

    // Nouveau store pointant sur le même dossier pour vérifier la persistance disque
    const reloadedStore = new DatabaseStore(tempDir);
    const reloadedData = reloadedStore.load();

    expect(reloadedData.words.some((w) => w.id === 'test-w1')).toBe(true);
  });

  it('migre un ancien schéma v0 vers le schéma v1 en préservant le contenu', () => {
    const legacyRawData = {
      words: [{ id: 'legacy-1', french: 'eau', english: 'water' }],
      settings: { theme: 'light' },
    };

    const { migratedData, migrationsRun } = migrateDatabase(legacyRawData, 1);

    expect(migrationsRun).toBe(1);
    expect(migratedData.schemaVersion).toBe(1);
    expect(migratedData.words.length).toBe(1);
    expect(migratedData.words[0].english).toBe('water');
    expect(migratedData.settings.theme).toBe('light');
    expect(migratedData.streak.currentStreak).toBe(0);
  });

  it('migre un schéma v1 vers le schéma v2 avec conversion des clés calendaires Paris sans perte', () => {
    const v1Data = {
      schemaVersion: 1,
      words: [{ id: 'w1', french: 'arbre', english: 'tree' }],
      playlists: [],
      dailyTests: [
        {
          id: 'd1',
          date: '2026-10-16',
          completedAt: '2026-10-16T22:30:00.000Z',
          score: 18,
          total: 20,
          xpEarned: 140,
          wordIds: [],
          results: [],
        },
      ],
      weeklyEvaluations: [
        {
          id: 'e1',
          date: '2026-10-11',
          completedAt: '2026-10-11T14:00:00.000Z',
          scorePercentage: 90,
          estimatedLevel: 'B1',
          xpEarned: 172,
          answers: [],
        },
      ],
      streak: {
        currentStreak: 5,
        maxStreak: 10,
        lastCompletedDate: '2026-10-16',
        streakFreezes: 1,
        activityCalendar: { '2026-10-16': 1 },
      },
      gamification: {
        xp: 450,
        level: 3,
        unlockedBadges: [{ id: 'first_word', unlockedAt: '2026-10-10' }],
      },
      settings: {
        theme: 'dark',
      },
    };

    const { migratedData, migrationsRun } = migrateDatabase(v1Data, 2);

    expect(migrationsRun).toBe(1);
    expect(migratedData.schemaVersion).toBe(2);
    // Vérifie que les données sont intactes
    expect(migratedData.gamification.xp).toBe(450);
    expect(migratedData.gamification.level).toBe(3);
    expect(migratedData.streak.currentStreak).toBe(5);
    expect(migratedData.words.length).toBe(1);
    // Vérifie le calcul des clés Paris
    expect(migratedData.lastStreakDayKey).toBe('2026-10-16');
    // 2026-10-16T22:30:00.000Z à Paris (UTC+2 en heure d'été) correspond au 17 octobre 2026 !
    expect(migratedData.lastDailyTestDayKey).toBe('2026-10-17');
    expect(migratedData.lastEvaluationWeekKey).toBe('2026-W41');
  });

  it('crée un fichier de sauvegarde avant migration', () => {
    const store = new DatabaseStore(tempDir);
    store.load(); // Initialise le fichier

    const backupPath = store.createBackup('test-backup');
    expect(fs.existsSync(backupPath)).toBe(true);
  });
});
