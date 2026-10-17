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

    expect(data.schemaVersion).toBe(1);
    expect(data.words.length).toBeGreaterThan(0);
    expect(data.playlists.length).toBeGreaterThan(0);
    expect(data.settings.theme).toBe('dark');
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

  it('crée un fichier de sauvegarde avant migration', () => {
    const store = new DatabaseStore(tempDir);
    store.load(); // Initialise le fichier

    const backupPath = store.createBackup('test-backup');
    expect(fs.existsSync(backupPath)).toBe(true);
  });
});
