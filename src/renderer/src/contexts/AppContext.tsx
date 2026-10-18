import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
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
  SentenceQueueStats,
  ExampleSourceType,
} from '../../../shared/types';
import { calculateLevel } from '../../../shared/constants';
import { applyReviewResult } from '../../../shared/srs/leitner';
import { recordDailyCompletion } from '../../../shared/streak/streakCalculator';
import { estimateEnglishLevel } from '../../../shared/levenshtein/correction';
import {
  getParisDayKey,
  getParisWeekKey,
  getMsUntilNextParisMidnight,
} from '../../../shared/date/parisDate';
import {
  processDailyTestCompletion,
  processWeeklyEvaluationCompletion,
} from '../../../shared/daily/dailyTestManager';
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
  currentDayKey: string;
  currentWeekKey: string;
  isDailyDoneToday: boolean;
  isWeeklyDoneThisWeek: boolean;
  getTodayOfficialSession: () => DailyTestSession | undefined;
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
  levelUpData: { oldLevel: number; newLevel: number } | null;
  clearLevelUpData: () => void;
  // Phrases d'exemple & IA locale
  sentenceQueueStats: SentenceQueueStats | null;
  regenerateWordSentence: (wordId: string) => Promise<void>;
  deleteWordSentence: (wordId: string) => Promise<void>;
  generateMissingSentences: () => Promise<number>;
  setSentenceSessionActive: (isActive: boolean) => Promise<void>;
  // Rechargement base
  refreshDatabase: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [newBadgeUnlocked, setNewBadgeUnlocked] = useState<string | null>(null);
  const [levelUpData, setLevelUpData] = useState<{ oldLevel: number; newLevel: number } | null>(null);
  const [currentDayKey, setCurrentDayKey] = useState<string>(() => getParisDayKey());
  const [currentWeekKey, setCurrentWeekKey] = useState<string>(() => getParisWeekKey());
  const [sentenceQueueStats, setSentenceQueueStats] = useState<SentenceQueueStats | null>(null);

  // Charger la base de données au montage
  const refreshDatabase = useCallback(async () => {
    try {
      if (window.api) {
        const loaded = await window.api.getDatabase();
        setDb(loaded);
        // Appliquer le thème dès le chargement
        document.documentElement.setAttribute('data-theme', loaded.settings.theme);

        // Pré-génération douce en arrière-plan des mots du vocabulaire
        if (window.api?.preloadWords && loaded.words && loaded.words.length > 0) {
          const itemsToPreload = loaded.words.map((w) => ({
            text: w.english,
            accent: loaded.settings.voiceAccent,
            voiceId: loaded.settings.preferredVoiceId,
            speed: loaded.settings.voiceSpeed || 1.0,
          }));

          // Décalage de 1 seconde pour laisser l'interface démarrer instantanément
          setTimeout(() => {
            window.api?.preloadWords(itemsToPreload);
          }, 1000);
        }
      }
    } catch (err) {
      console.error('Erreur lors du chargement de la base :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDatabase();

    // Initialiser les stats de la file de phrases
    if (window.api?.getSentenceQueueStats) {
      window.api.getSentenceQueueStats().then(setSentenceQueueStats).catch(() => {});
    }

    const unsubProgress = window.api?.onSentenceQueueProgress?.((stats) => {
      setSentenceQueueStats(stats);
    });

    const unsubGenerated = window.api?.onSentenceGenerated?.(({ wordId, sentence, source }) => {
      setDb((prevDb) => {
        if (!prevDb) return prevDb;
        const updatedWords = prevDb.words.map((w) => {
          if (w.id === wordId) {
            // Ne jamais écraser une phrase manuelle de l'utilisateur
            if (w.example && w.exampleSource === 'user') return w;
            return {
              ...w,
              example: sentence,
              exampleSource: source,
              updatedAt: new Date().toISOString(),
            };
          }
          return w;
        });

        // Pré-générer l'audio de la phrase d'exemple nouvellement générée
        if (window.api?.preloadWords && prevDb.settings) {
          window.api.preloadWords([
            {
              text: sentence,
              accent: prevDb.settings.voiceAccent,
              voiceId: prevDb.settings.preferredVoiceId,
              speed: prevDb.settings.voiceSpeed || 1.0,
            },
          ]);
        }

        return { ...prevDb, words: updatedWords };
      });
    });

    return () => {
      if (unsubProgress) unsubProgress();
      if (unsubGenerated) unsubGenerated();
    };
  }, [refreshDatabase]);

  // Synchronisation automatique à minuit heure de Paris et détection veille / focus
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextMidnight = () => {
      const ms = getMsUntilNextParisMidnight();
      // Ajouter 500 ms de marge pour franchir nettement minuit
      timerId = setTimeout(() => {
        const nextDay = getParisDayKey();
        const nextWeek = getParisWeekKey();
        setCurrentDayKey(nextDay);
        setCurrentWeekKey(nextWeek);
        refreshDatabase();
        scheduleNextMidnight();
      }, ms + 500);
    };

    scheduleNextMidnight();

    const checkDateChange = () => {
      const latestDay = getParisDayKey();
      const latestWeek = getParisWeekKey();
      setCurrentDayKey((prevDay) => {
        if (latestDay !== prevDay) {
          setCurrentWeekKey(latestWeek);
          refreshDatabase();
          return latestDay;
        }
        return prevDay;
      });
    };

    window.addEventListener('focus', checkDateChange);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkDateChange();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('focus', checkDateChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
        setLevelUpData({ oldLevel: oldLevelInfo.level, newLevel: newLevelInfo.level });
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

  // État du jour et de la semaine calculés
  const isDailyDoneToday = useMemo(() => {
    if (!db) return false;
    return db.lastDailyTestDayKey === currentDayKey;
  }, [db, currentDayKey]);

  const isWeeklyDoneThisWeek = useMemo(() => {
    if (!db) return false;
    return db.lastEvaluationWeekKey === currentWeekKey;
  }, [db, currentWeekKey]);

  const getTodayOfficialSession = useCallback((): DailyTestSession | undefined => {
    if (!db) return undefined;
    const sessions = db.dailyTests.filter((t) => t.date === currentDayKey && !t.isFreePractice);
    return sessions[sessions.length - 1];
  }, [db, currentDayKey]);

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

      const today = getParisDayKey();
      const hasUserExample = Boolean(wordData.example && wordData.example.trim());
      const newWord: Word = {
        id: 'w_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        french: wordData.french.trim(),
        english: wordData.english.trim(),
        example: wordData.example?.trim() || '',
        exampleSource: hasUserExample ? 'user' : undefined,
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

      // Si aucune phrase d'exemple n'a été saisie, enfiler pour génération automatique en arrière-plan
      if (!hasUserExample && window.api?.enqueueSentence) {
        window.api
          .enqueueSentence({
            wordId: newWord.id,
            english: newWord.english,
            french: newWord.french,
            priority: 1, // Priorité 1 : mot ajouté manuellement (urgent)
          })
          .catch(() => {});
      }

      // Pré-génération anticipée immédiate en arrière-plan de la voix (mot et exemple)
      if (window.api?.preloadWords && updatedDb.settings) {
        const items = [
          {
            text: newWord.english,
            accent: updatedDb.settings.voiceAccent,
            voiceId: updatedDb.settings.preferredVoiceId,
            speed: updatedDb.settings.voiceSpeed || 1.0,
          },
        ];
        if (newWord.example && newWord.example.trim()) {
          items.push({
            text: newWord.example.trim(),
            accent: updatedDb.settings.voiceAccent,
            voiceId: updatedDb.settings.preferredVoiceId,
            speed: updatedDb.settings.voiceSpeed || 1.0,
          });
        }
        window.api.preloadWords(items);
      }

      return { success: true, word: newWord };
    },
    [db, checkBadgesAndXp, persistDb, playSfx]
  );

  // 2. Modifier un mot
  const updateWord = useCallback(
    async (word: Word) => {
      if (!db) return;
      const oldWord = db.words.find((w) => w.id === word.id);
      const isExampleModified = oldWord && oldWord.example !== word.example;

      // Règle d'or : Toute phrase écrite ou modifiée par l'utilisateur devient "ma phrase" (source: user)
      const updatedWord: Word = {
        ...word,
        exampleSource:
          isExampleModified && word.example?.trim()
            ? 'user'
            : word.exampleSource || (word.example?.trim() ? 'user' : undefined),
        updatedAt: new Date().toISOString(),
      };

      const updatedWords = db.words.map((w) => (w.id === word.id ? updatedWord : w));
      await persistDb({ ...db, words: updatedWords });

      // Pré-génération anticipée immédiate en arrière-plan (mot et exemple)
      if (window.api?.preloadWords && db.settings) {
        const items = [
          {
            text: updatedWord.english,
            accent: db.settings.voiceAccent,
            voiceId: db.settings.preferredVoiceId,
            speed: db.settings.voiceSpeed || 1.0,
          },
        ];
        if (updatedWord.example && updatedWord.example.trim()) {
          items.push({
            text: updatedWord.example.trim(),
            accent: db.settings.voiceAccent,
            voiceId: db.settings.preferredVoiceId,
            speed: db.settings.voiceSpeed || 1.0,
          });
        }
        window.api.preloadWords(items);
      }
    },
    [db, persistDb]
  );

  // Régénérer la phrase d'exemple d'un mot
  const regenerateWordSentence = useCallback(
    async (wordId: string) => {
      if (!db || !window.api?.enqueueSentence) return;
      const word = db.words.find((w) => w.id === wordId);
      if (!word) return;

      // Effacer l'exemple actuel et enfiler pour régénération immédiate
      const updatedWords = db.words.map((w) =>
        w.id === wordId ? { ...w, example: '', exampleSource: undefined } : w
      );
      await persistDb({ ...db, words: updatedWords });

      await window.api.enqueueSentence({
        wordId: word.id,
        english: word.english,
        french: word.french,
        priority: 1,
      });
    },
    [db, persistDb]
  );

  // Supprimer la phrase d'exemple d'un mot
  const deleteWordSentence = useCallback(
    async (wordId: string) => {
      if (!db) return;
      const updatedWords = db.words.map((w) =>
        w.id === wordId ? { ...w, example: '', exampleSource: undefined } : w
      );
      await persistDb({ ...db, words: updatedWords });
    },
    [db, persistDb]
  );

  // Générer les phrases manquantes de toute la base
  const generateMissingSentences = useCallback(async (): Promise<number> => {
    if (!db || !window.api?.enqueueMissingSentences) return 0;
    const missing = db.words.filter((w) => !w.example || !w.example.trim());
    if (missing.length === 0) return 0;
    return await window.api.enqueueMissingSentences(missing);
  }, [db]);

  // Pause / reprise de la file lors d'une session de test ou d'étude
  const setSentenceSessionActive = useCallback(async (isActive: boolean) => {
    if (window.api?.setSentenceSessionActive) {
      await window.api.setSentenceSessionActive(isActive);
    }
  }, []);

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

  // 4. Enregistrer une révision flashcard libre
  const recordReview = useCallback(
    async (wordId: string, success: boolean, mode: 'flashcard' | 'daily' | 'eval' = 'flashcard') => {
      if (!db) return;
      const targetWord = db.words.find((w) => w.id === wordId);
      if (!targetWord) return;

      const today = getParisDayKey();
      const updatedWord = applyReviewResult(targetWord, success, mode, today);
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

  // 5. Enregistrer le test quotidien (officiel 1 fois par jour Paris, sinon entraînement libre sans XP/streak)
  const recordDailyTest = useCallback(
    async (results: DailyTestResultItem[]): Promise<DailyTestSession> => {
      if (!db) throw new Error('Base non chargée');

      const res = processDailyTestCompletion(db, results, new Date());

      let updatedDb: AppDatabase = {
        ...db,
        words: res.updatedWords,
        streak: res.updatedStreak,
        dailyTests: [res.session, ...db.dailyTests],
        lastDailyTestDayKey: res.newDailyTestDayKey,
        lastStreakDayKey: res.newStreakDayKey,
      };

      if (res.isOfficial) {
        updatedDb = checkBadgesAndXp(updatedDb, res.xpEarned, { streak: res.newStreak });
        await persistDb(updatedDb);
        playSfx('flame');
        triggerConfetti();
      } else {
        await persistDb(updatedDb);
        playSfx(res.session.score >= res.session.total / 2 ? 'success' : 'wrong');
      }

      return res.session;
    },
    [db, checkBadgesAndXp, persistDb, playSfx, triggerConfetti]
  );

  // 6. Enregistrer l'évaluation hebdomadaire (XP une seule fois par semaine calendaire Paris)
  const recordWeeklyEvaluation = useCallback(
    async (answers: WeeklyAnswer[]): Promise<WeeklyEvaluation> => {
      if (!db) throw new Error('Base non chargée');

      const res = processWeeklyEvaluationCompletion(db, answers, new Date());

      let updatedDb: AppDatabase = {
        ...db,
        words: res.updatedWords,
        weeklyEvaluations: [res.evaluation, ...db.weeklyEvaluations],
        lastEvaluationWeekKey: res.newEvaluationWeekKey,
      };

      if (res.isOfficial) {
        updatedDb = checkBadgesAndXp(updatedDb, res.xpEarned, { evalScore: res.scorePercentage });
        await persistDb(updatedDb);
        playSfx('levelUp');
        triggerConfetti();
      } else {
        await persistDb(updatedDb);
        playSfx(res.scorePercentage >= 50 ? 'success' : 'wrong');
      }

      return res.evaluation;
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
        currentDayKey,
        currentWeekKey,
        isDailyDoneToday,
        isWeeklyDoneThisWeek,
        getTodayOfficialSession,
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
        levelUpData,
        clearLevelUpData: () => setLevelUpData(null),
        sentenceQueueStats,
        regenerateWordSentence,
        deleteWordSentence,
        generateMissingSentences,
        setSentenceSessionActive,
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
