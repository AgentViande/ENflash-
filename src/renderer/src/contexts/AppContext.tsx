import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  AppDatabase,
  Word,
  Playlist,
  AppSettings,
  DailyTestSession,
  WeeklyEvaluation,
  WeeklyAnswer,
  DailyTestResultItem,
  LevenshteinStatus,
} from '../../../shared/types';
import { BADGE_DEFINITIONS, calculateLevel } from '../../../shared/constants';
import { applyReviewResult, getTodayDateString } from '../../../shared/srs/leitner';
import { recordDailyCompletion } from '../../../shared/streak/streakCalculator';
import { estimateEnglishLevel } from '../../../shared/levenshtein/correction';
import {
  playSuccessSound,
  playWrongSound,
  playFlipSound,
  playLevelUpSound,
  playStreakFlameSound,
} from '../utils/audio';

export interface AddWordResult {
  success: boolean;
  word?: Word;
  isDuplicate?: boolean;
  duplicateWord?: Word;
}

interface AppContextType {
  db: AppDatabase | null;
  loading: boolean;
  // Mots
  addWord: (wordData: {
    french: string;
    english: string;
    example?: string;
    tags?: string[];
    note?: string;
  }, forceDuplicate?: boolean) => Promise<AddWordResult>;
  updateWord: (word: Word) => Promise<void>;
  deleteWord: (id: string) => Promise<void>;
  // Flashcards & SRS
  recordReview: (wordId: string, success: boolean, mode?: 'flashcard' | 'daily' | 'eval') => Promise<void>;
  // Test quotidien
  recordDailyTest: (results: DailyTestResultItem[]) => Promise<DailyTestSession>;
  // Évaluation hebdomadaire
  recordWeeklyEvaluation: (answers: WeeklyAnswer[]) => Promise<WeeklyEvaluation>;
  // Playlists
  createPlaylist: (data: { name: string; description: string; color: string; icon: string; wordIds: string[] }) => Promise<Playlist>;
  updatePlaylist: (playlist: Playlist) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  toggleWordInPlaylist: (playlistId: string, wordId: string) => Promise<void>;
  // Paramètres
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  // Gamification & Effets
  triggerConfetti: () => void;
  playSfx: (type: 'success' | 'wrong' | 'flip' | 'levelUp' | 'flame') => void;
  newBadgeUnlocked: string | null;
  clearNewBadge: () => void;
  // Rechargement base
  refreshDatabase: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [newBadgeUnlocked, setNewBadgeUnlocked] = useState<string | null>(null);

  // Charger la base de données au montage
  const refreshDatabase = useCallback(async () => {
    try {
      if (window.api) {
        const loaded = await window.api.getDatabase();
        setDb(loaded);
        // Appliquer le thème dès le chargement
        document.documentElement.setAttribute('data-theme', loaded.settings.theme);
      }
    } catch (err) {
      console.error('Erreur lors du chargement de la base :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDatabase();
  }, [refreshDatabase]);

  // Sauvegarder dans Electron
  const persistDb = useCallback(async (newDb: AppDatabase) => {
    setDb(newDb);
    if (window.api) {
      await window.api.saveDatabase(newDb);
    }
  }, []);

  // Déclencheur sonore
  const playSfx = useCallback(
    (type: 'success' | 'wrong' | 'flip' | 'levelUp' | 'flame') => {
      if (!db || !db.settings.soundEffects) return;
      const vol = db.settings.soundVolume ?? 0.6;
      switch (type) {
        case 'success':
          playSuccessSound(vol);
          break;
        case 'wrong':
          playWrongSound(vol);
          break;
        case 'flip':
          playFlipSound(vol);
          break;
        case 'levelUp':
          playLevelUpSound(vol);
          break;
        case 'flame':
          playStreakFlameSound(vol);
          break;
      }
    },
    [db]
  );

  // Déclencheur confettis
  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6'],
    });
  }, []);

  // Vérification de déblocage de badges et attribution d'XP
  const checkBadgesAndXp = useCallback(
    (
      currentDb: AppDatabase,
      xpGained: number,
      context?: { addedWordCount?: number; streak?: number; masteredWord?: boolean; evalScore?: number }
    ): AppDatabase => {
      let xp = currentDb.gamification.xp + xpGained;
      const oldLevelInfo = calculateLevel(currentDb.gamification.xp);
      const newLevelInfo = calculateLevel(xp);

      if (newLevelInfo.level > oldLevelInfo.level) {
        playSfx('levelUp');
        triggerConfetti();
      }

      const unlocked = [...currentDb.gamification.unlockedBadges];
      const hasBadge = (id: string) => unlocked.some((b) => b.id === id);

      const toUnlock: string[] = [];

      // Vérification des conditions de badges
      const wordCount = currentDb.words.length + (context?.addedWordCount || 0);
      if (wordCount >= 1 && !hasBadge('first_word')) toUnlock.push('first_word');
      if (wordCount >= 10 && !hasBadge('words_10')) toUnlock.push('words_10');
      if (wordCount >= 50 && !hasBadge('words_50')) toUnlock.push('words_50');
      if (wordCount >= 100 && !hasBadge('words_100')) toUnlock.push('words_100');

      if (context?.masteredWord && !hasBadge('first_mastered')) toUnlock.push('first_mastered');

      const streakVal = context?.streak ?? currentDb.streak.currentStreak;
      if (streakVal >= 3 && !hasBadge('streak_3')) toUnlock.push('streak_3');
      if (streakVal >= 7 && !hasBadge('streak_7')) toUnlock.push('streak_7');
      if (streakVal >= 30 && !hasBadge('streak_30')) toUnlock.push('streak_30');

      if (context?.evalScore !== undefined) {
        if (!hasBadge('first_eval')) toUnlock.push('first_eval');
        if (context.evalScore === 100 && !hasBadge('perfect_eval')) toUnlock.push('perfect_eval');
      }

      if (currentDb.playlists.filter((p) => !p.isSmart).length >= 1 && !hasBadge('first_playlist')) {
        toUnlock.push('first_playlist');
      }

      if (newLevelInfo.level >= 5 && !hasBadge('level_5')) {
        toUnlock.push('level_5');
      }

      if (toUnlock.length > 0) {
        toUnlock.forEach((id) => {
          unlocked.push({ id, unlockedAt: new Date().toISOString() });
        });
        setNewBadgeUnlocked(toUnlock[0]);
        playSfx('levelUp');
        triggerConfetti();
      }

      return {
        ...currentDb,
        gamification: {
          xp,
          level: newLevelInfo.level,
          unlockedBadges: unlocked,
        },
      };
    },
    [playSfx, triggerConfetti]
  );

  // 1. Ajouter un mot
  const addWord = useCallback(
    async (
      wordData: { french: string; english: string; example?: string; tags?: string[]; note?: string },
      forceDuplicate: boolean = false
    ): Promise<AddWordResult> => {
      if (!db) return { success: false };

      const normFr = wordData.french.trim().toLowerCase();
      const normEn = wordData.english.trim().toLowerCase();

      // Détection de doublons
      const duplicate = db.words.find(
        (w) => w.french.trim().toLowerCase() === normFr || w.english.trim().toLowerCase() === normEn
      );

      if (duplicate && !forceDuplicate) {
        return { success: false, isDuplicate: true, duplicateWord: duplicate };
      }

      const today = getTodayDateString();
      const newWord: Word = {
        id: 'w_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        french: wordData.french.trim(),
        english: wordData.english.trim(),
        example: wordData.example?.trim() || '',
        tags: wordData.tags || [],
        note: wordData.note?.trim() || '',
        leitnerBox: 1,
        nextReviewDate: today,
        lastReviewedAt: null,
        reviewHistory: [],
        totalReviews: 0,
        successCount: 0,
        failureCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedWords = [newWord, ...db.words];
      let updatedDb: AppDatabase = {
        ...db,
        words: updatedWords,
      };

      // Gain d'XP (+15 XP) et vérification des badges
      updatedDb = checkBadgesAndXp(updatedDb, 15, { addedWordCount: 1 });

      await persistDb(updatedDb);
      playSfx('success');
      return { success: true, word: newWord };
    },
    [db, checkBadgesAndXp, persistDb, playSfx]
  );

  // 2. Modifier un mot
  const updateWord = useCallback(
    async (word: Word) => {
      if (!db) return;
      const updatedWords = db.words.map((w) => (w.id === word.id ? { ...word, updatedAt: new Date().toISOString() } : w));
      await persistDb({ ...db, words: updatedWords });
    },
    [db, persistDb]
  );

  // 3. Supprimer un mot
  const deleteWord = useCallback(
    async (id: string) => {
      if (!db) return;
      const updatedWords = db.words.filter((w) => w.id !== id);
      // Retirer aussi le mot des playlists
      const updatedPlaylists = db.playlists.map((p) => ({
        ...p,
        wordIds: p.wordIds.filter((wId) => wId !== id),
      }));
      await persistDb({ ...db, words: updatedWords, playlists: updatedPlaylists });
    },
    [db, persistDb]
  );

  // 4. Enregistrer une révision flashcard
  const recordReview = useCallback(
    async (wordId: string, success: boolean, mode: 'flashcard' | 'daily' | 'eval' = 'flashcard') => {
      if (!db) return;
      const targetWord = db.words.find((w) => w.id === wordId);
      if (!targetWord) return;

      const updatedWord = applyReviewResult(targetWord, success, mode);
      const isMastered = updatedWord.leitnerBox === 5;

      const updatedWords = db.words.map((w) => (w.id === wordId ? updatedWord : w));
      let updatedDb: AppDatabase = { ...db, words: updatedWords };

      // +10 XP par révision (+5 bonus si réussi)
      const xpGained = success ? 15 : 10;
      updatedDb = checkBadgesAndXp(updatedDb, xpGained, { masteredWord: isMastered });

      await persistDb(updatedDb);
    },
    [db, checkBadgesAndXp, persistDb]
  );

  // 5. Enregistrer le test quotidien
  const recordDailyTest = useCallback(
    async (results: DailyTestResultItem[]): Promise<DailyTestSession> => {
      if (!db) throw new Error('Base non chargée');

      const today = getTodayDateString();
      const score = results.filter((r) => r.success).length;
      const total = results.length;
      const xpEarned = 50 + score * 5;

      // Mettre à jour chaque mot révisé selon Leitner
      let updatedWords = [...db.words];
      for (const res of results) {
        const w = updatedWords.find((item) => item.id === res.wordId);
        if (w) {
          const updated = applyReviewResult(w, res.success, 'daily', today);
          updatedWords = updatedWords.map((item) => (item.id === res.wordId ? updated : item));
        }
      }

      // Mise à jour du streak et attribution de jokers de gel
      const streakUpdate = recordDailyCompletion(db.streak, today);

      const session: DailyTestSession = {
        id: 'daily_' + Date.now(),
        date: today,
        wordIds: results.map((r) => r.wordId),
        results,
        score,
        total,
        xpEarned,
        completedAt: new Date().toISOString(),
      };

      let updatedDb: AppDatabase = {
        ...db,
        words: updatedWords,
        streak: streakUpdate.newState,
        dailyTests: [session, ...db.dailyTests],
      };

      updatedDb = checkBadgesAndXp(updatedDb, xpEarned, { streak: streakUpdate.newStreak });

      await persistDb(updatedDb);
      playSfx('flame');
      triggerConfetti();

      return session;
    },
    [db, checkBadgesAndXp, persistDb, playSfx, triggerConfetti]
  );

  // 6. Enregistrer l'évaluation hebdomadaire
  const recordWeeklyEvaluation = useCallback(
    async (answers: WeeklyAnswer[]): Promise<WeeklyEvaluation> => {
      if (!db) throw new Error('Base non chargée');

      const today = getTodayDateString();
      const exactCount = answers.filter((a) => a.status === 'exact').length;
      const almostCount = answers.filter((a) => a.status === 'almost').length;
      // Les réponses presque parfaites rapportent 0.5 point
      const totalPoints = exactCount + almostCount * 0.5;
      const scorePercentage = Math.round((totalPoints / Math.max(1, answers.length)) * 100);

      const masteredCount = db.words.filter((w) => w.leitnerBox === 5).length;
      const estimatedLevel = estimateEnglishLevel(scorePercentage, masteredCount);
      const xpEarned = 100 + Math.round(scorePercentage * 0.8);

      const evaluation: WeeklyEvaluation = {
        id: 'eval_' + Date.now(),
        date: today,
        answers,
        scorePercentage,
        estimatedLevel,
        xpEarned,
        completedAt: new Date().toISOString(),
      };

      // Mettre à jour les mots de l'évaluation dans le Leitner
      let updatedWords = [...db.words];
      for (const ans of answers) {
        const w = updatedWords.find((item) => item.id === ans.wordId);
        if (w) {
          const success = ans.status === 'exact' || ans.status === 'almost';
          const updated = applyReviewResult(w, success, 'eval', today);
          updatedWords = updatedWords.map((item) => (item.id === ans.wordId ? updated : item));
        }
      }

      let updatedDb: AppDatabase = {
        ...db,
        words: updatedWords,
        weeklyEvaluations: [evaluation, ...db.weeklyEvaluations],
      };

      updatedDb = checkBadgesAndXp(updatedDb, xpEarned, { evalScore: scorePercentage });

      await persistDb(updatedDb);
      playSfx('levelUp');
      triggerConfetti();

      return evaluation;
    },
    [db, checkBadgesAndXp, persistDb, playSfx, triggerConfetti]
  );

  // 7. Playlists
  const createPlaylist = useCallback(
    async (data: { name: string; description: string; color: string; icon: string; wordIds: string[] }): Promise<Playlist> => {
      if (!db) throw new Error('Base non chargée');
      const newPlaylist: Playlist = {
        id: 'pl_' + Date.now(),
        ...data,
        isSmart: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let updatedDb: AppDatabase = {
        ...db,
        playlists: [...db.playlists, newPlaylist],
      };

      updatedDb = checkBadgesAndXp(updatedDb, 20);
      await persistDb(updatedDb);
      playSfx('success');
      return newPlaylist;
    },
    [db, checkBadgesAndXp, persistDb, playSfx]
  );

  const updatePlaylist = useCallback(
    async (playlist: Playlist) => {
      if (!db) return;
      const updatedPlaylists = db.playlists.map((p) =>
        p.id === playlist.id ? { ...playlist, updatedAt: new Date().toISOString() } : p
      );
      await persistDb({ ...db, playlists: updatedPlaylists });
    },
    [db, persistDb]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      if (!db) return;
      const updatedPlaylists = db.playlists.filter((p) => p.id !== id);
      await persistDb({ ...db, playlists: updatedPlaylists });
    },
    [db, persistDb]
  );

  const toggleWordInPlaylist = useCallback(
    async (playlistId: string, wordId: string) => {
      if (!db) return;
      const updatedPlaylists = db.playlists.map((p) => {
        if (p.id !== playlistId) return p;
        const exists = p.wordIds.includes(wordId);
        const newWordIds = exists ? p.wordIds.filter((id) => id !== wordId) : [...p.wordIds, wordId];
        return { ...p, wordIds: newWordIds, updatedAt: new Date().toISOString() };
      });
      await persistDb({ ...db, playlists: updatedPlaylists });
    },
    [db, persistDb]
  );

  // 8. Paramètres
  const updateSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      if (!db) return;
      const updatedSettings = { ...db.settings, ...newSettings };
      if (newSettings.theme) {
        document.documentElement.setAttribute('data-theme', newSettings.theme);
      }
      await persistDb({ ...db, settings: updatedSettings });
    },
    [db, persistDb]
  );

  const clearNewBadge = useCallback(() => {
    setNewBadgeUnlocked(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        db,
        loading,
        addWord,
        updateWord,
        deleteWord,
        recordReview,
        recordDailyTest,
        recordWeeklyEvaluation,
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        toggleWordInPlaylist,
        updateSettings,
        triggerConfetti,
        playSfx,
        newBadgeUnlocked,
        clearNewBadge,
        refreshDatabase,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp doit être utilisé à l’intérieur d’un AppProvider');
  }
  return context;
};
