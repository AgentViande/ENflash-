import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Volume2,
  ArrowLeftRight,
  RotateCw,
  Check,
  X,
  Sparkles,
  Award,
  Flame,
  ArrowRight,
  Filter,
  Edit3,
  Trash2,
  Bot,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Word, LeitnerBox } from '../../../shared/types';
import { speakWord, speakText, preloadAudioList, replayLastAudio, subscribeAudioSource, AudioSourceType } from '../utils/audio';
import { pickDailyTestWords } from '../../../shared/picker/weightedPicker';
import { getTodayDateString } from '../../../shared/srs/leitner';
import { Mascot } from '../assets/Mascot';

interface EtudierScreenProps {
  initialDailyMode?: boolean;
  selectedPlaylistId?: string | null;
  onFinishDaily?: () => void;
}

export const EtudierScreen: React.FC<EtudierScreenProps> = ({
  initialDailyMode = false,
  selectedPlaylistId = null,
  onFinishDaily,
}) => {
  const {
    db,
    recordReview,
    recordDailyTest,
    updateSettings,
    updateWord,
    playSfx,
    isDailyDoneToday,
    getTodayOfficialSession,
    regenerateWordSentence,
    deleteWordSentence,
    sentenceQueueStats,
    setSentenceSessionActive,
  } = useApp();

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(selectedPlaylistId);
  const [isDailyMode, setIsDailyMode] = useState<boolean>(initialDailyMode);
  const [isFreePracticeRun, setIsFreePracticeRun] = useState<boolean>(false);
  const [isSlowMode, setIsSlowMode] = useState<boolean>(false);
  const [audioSource, setAudioSource] = useState<AudioSourceType>('kokoro');

  const [cards, setCards] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [dailyResults, setDailyResults] = useState<Array<{ wordId: string; success: boolean }>>([]);

  // Édition rapide de la phrase d'exemple sur la carte
  const [isEditingExample, setIsEditingExample] = useState<boolean>(false);
  const [editedExampleText, setEditedExampleText] = useState<string>('');

  useEffect(() => {
    return subscribeAudioSource(setAudioSource);
  }, []);

  // Mettre en pause la file d'attente de génération d'exemples pendant la session d'étude
  useEffect(() => {
    setSentenceSessionActive(true);
    return () => {
      setSentenceSessionActive(false);
    };
  }, [setSentenceSessionActive]);

  const direction = db?.settings.cardDirection || 'fr_to_en';
  const voiceAccent = db?.settings.voiceAccent || 'en-US';

  // Préparation du jeu de cartes selon le mode choisi
  const prepareCards = useCallback(() => {
    if (!db || db.words.length === 0) {
      setCards([]);
      return;
    }

    const isFree = Boolean(isDailyMode && isDailyDoneToday);
    setIsFreePracticeRun(isFree);

    if (isDailyMode) {
      const todayOfficial = getTodayOfficialSession();
      let loadedCards: Word[] = [];
      // Si déjà validé aujourd'hui : entraînement libre avec EXACTEMENT les mêmes cartes
      if (isDailyDoneToday && todayOfficial && todayOfficial.wordIds?.length > 0) {
        const sessionWords = todayOfficial.wordIds
          .map((id) => db.words.find((w) => w.id === id))
          .filter(Boolean) as Word[];
        loadedCards = sessionWords.length > 0 ? sessionWords : pickDailyTestWords(db.words, 20, getTodayDateString());
      } else {
        // 20 cartes tirées de manière pondérée
        loadedCards = pickDailyTestWords(db.words, 20, getTodayDateString());
      }
      setCards(loadedCards);
      // Préchargement en arrière-plan des audios du test du jour pour éliminer toute latence
      if (loadedCards.length > 0) {
        preloadAudioList(
          loadedCards.map((c) => c.english),
          db.settings.voiceAccent,
          db.settings.preferredVoiceId
        );
      }
    } else if (activePlaylistId) {
      const playlist = db.playlists.find((p) => p.id === activePlaylistId);
      if (playlist) {
        if (playlist.isSmart) {
          if (playlist.smartType === 'difficult') {
            const difficult = db.words.filter(
              (w) => w.totalReviews > 0 && w.failureCount / w.totalReviews >= 0.4
            );
            setCards(difficult.length > 0 ? difficult : db.words.slice(0, 10));
          } else if (playlist.smartType === 'new') {
            const newWords = db.words.filter((w) => w.leitnerBox === 1);
            setCards(newWords.length > 0 ? newWords : db.words.slice(0, 10));
          }
        } else {
          const playlistWords = db.words.filter((w) => playlist.wordIds.includes(w.id));
          setCards(playlistWords);
        }
      }
    } else {
      // Tous les mots
      setCards([...db.words]);
    }

    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(false);
    setDailyResults([]);
  }, [db, isDailyMode, activePlaylistId, isDailyDoneToday, getTodayOfficialSession]);

  useEffect(() => {
    prepareCards();
  }, [prepareCards]);

  const currentCard: Word | undefined = cards[currentIndex];
  const isFrenchOnFront = direction === 'fr_to_en';

  // Prononciation audio du mot principal
  const handlePronounce = useCallback(
    (e?: React.MouseEvent, forceSlow?: boolean) => {
      if (e) e.stopPropagation();
      if (!currentCard || !db) return;
      const slow = forceSlow !== undefined ? forceSlow : isSlowMode;
      speakText(currentCard.english, {
        accent: voiceAccent,
        speed: db.settings.voiceSpeed || 1.0,
        isSlow: slow,
        preferredVoiceId: db.settings.preferredVoiceId,
      });
    },
    [currentCard, db, voiceAccent, isSlowMode]
  );

  // Prononciation audio de la phrase d'exemple
  const handlePronounceExample = useCallback(
    (e?: React.MouseEvent, forceSlow?: boolean) => {
      if (e) e.stopPropagation();
      if (!currentCard || !currentCard.example || !db) return;
      const slow = forceSlow !== undefined ? forceSlow : isSlowMode;
      speakText(currentCard.example, {
        accent: voiceAccent,
        speed: db.settings.voiceSpeed || 1.0,
        isSlow: slow,
        preferredVoiceId: db.settings.preferredVoiceId,
      });
    },
    [currentCard, db, voiceAccent, isSlowMode]
  );

  // Lecture automatique à l'affichage si face en anglais révélée
  useEffect(() => {
    if (!currentCard || sessionCompleted || !db?.settings.autoPronounce) return;
    const isEnglishRevealed = (!isFrenchOnFront && !isFlipped) || (isFrenchOnFront && isFlipped);
    if (isEnglishRevealed) {
      handlePronounce();
    }
  }, [currentIndex, isFlipped, isFrenchOnFront, currentCard, sessionCompleted, db?.settings.autoPronounce, handlePronounce]);

  // Inversion globale du sens de lecture
  const toggleDirection = () => {
    const nextDir = direction === 'fr_to_en' ? 'en_to_fr' : 'fr_to_en';
    updateSettings({ cardDirection: nextDir });
  };

  // Retourner la carte
  const handleFlip = useCallback(() => {
    if (!currentCard) return;
    playSfx('flip');
    setIsFlipped((prev) => !prev);
  }, [currentCard, playSfx]);

  // Réponse utilisateur (Maîtrisé / Pas encore)
  const handleAnswer = useCallback(
    async (success: boolean) => {
      if (!currentCard) return;

      playSfx(success ? 'success' : 'wrong');

      if (isDailyMode) {
        const nextResults = [...dailyResults, { wordId: currentCard.id, success }];
        setDailyResults(nextResults);

        if (currentIndex + 1 >= cards.length) {
          // Fin du test quotidien
          await recordDailyTest(nextResults);
          setSessionCompleted(true);
          if (onFinishDaily) onFinishDaily();
        } else {
          setIsFlipped(false);
          setCurrentIndex((prev) => prev + 1);
        }
      } else {
        // Mode révision libre
        await recordReview(currentCard.id, success, 'flashcard');

        if (currentIndex + 1 >= cards.length) {
          setSessionCompleted(true);
        } else {
          setIsFlipped(false);
          setCurrentIndex((prev) => prev + 1);
        }
      }
    },
    [currentCard, isDailyMode, dailyResults, currentIndex, cards.length, recordDailyTest, recordReview, playSfx, onFinishDaily]
  );

  // Raccourcis clavier (Espace, Flèches, I, P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si l'utilisateur est dans un champ texte
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (sessionCompleted || !currentCard) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (isFlipped) handleAnswer(true);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (isFlipped) handleAnswer(false);
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        toggleDirection();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        const isEnglishRevealed = (!isFrenchOnFront && !isFlipped) || (isFrenchOnFront && isFlipped);
        if (isEnglishRevealed) {
          handlePronounce();
        } else {
          replayLastAudio();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleAnswer, isFlipped, sessionCompleted, currentCard, isFrenchOnFront, handlePronounce]);

  // Couleurs de badges selon la boîte Leitner
  const getBoxBadge = (box: LeitnerBox) => {
    const colors: Record<LeitnerBox, { bg: string; text: string; label: string }> = {
      1: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Boîte 1 (Nouveau)' },
      2: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'Boîte 2 (En cours)' },
      3: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Boîte 3 (En cours)' },
      4: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', label: 'Boîte 4 (En cours)' },
      5: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Boîte 5 (Maîtrisé)' },
    };
    return colors[box] || colors[1];
  };

  if (!db) return null;

  // Aucune carte disponible
  if (cards.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px',
          textAlign: 'center',
          gap: '16px',
        }}
      >
        <Mascot mood="thinking" size={100} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Aucune flashcard trouvée</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>
          Cette playlist ou votre dictionnaire ne contient pas encore de mots. Ajoutez votre premier mot pour commencer !
        </p>
      </div>
    );
  }

  // Écran de fin de session
  if (sessionCompleted) {
    const correctCount = isDailyMode
      ? dailyResults.filter((r) => r.success).length
      : cards.length; // En mode libre
    const totalCount = cards.length;
    const scorePct = Math.round((correctCount / totalCount) * 100);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          padding: '32px',
          gap: '24px',
          maxWidth: '600px',
          margin: '0 auto',
          textAlign: 'center',
          animation: 'fadeInScale 0.3s ease',
        }}
      >
        <Mascot mood={isFreePracticeRun ? 'happy' : 'celebrate'} size={120} className="animate-float" />

        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isFreePracticeRun ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-success-light)',
              color: isFreePracticeRun ? '#f59e0b' : 'var(--color-success)',
              borderRadius: '999px',
              padding: '4px 14px',
              fontSize: '0.85rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            <Sparkles size={16} />
            <span>{isFreePracticeRun ? 'Entraînement libre terminé !' : 'Session terminée !'}</span>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {isFreePracticeRun ? 'Bien joué pour cet entraînement ! ⚡' : 'Félicitations ! ⚡'}
          </h2>
          {isFreePracticeRun && (
            <div
              style={{
                display: 'inline-block',
                marginTop: '6px',
                marginBottom: '6px',
                padding: '6px 14px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                color: '#f59e0b',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              ⚠️ Entraînement libre : aucune XP aujourd'hui
            </div>
          )}
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '4px' }}>
            {isDailyMode
              ? isFreePracticeRun
                ? `Score de la session : ${correctCount} / ${totalCount} (${scorePct} %)`
                : `Votre test quotidien est validé ! Score : ${correctCount} / ${totalCount} (${scorePct} %)`
              : `Vous avez révisé ${totalCount} flashcards avec succès.`}
          </p>
        </div>

        {/* Bilan du score */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            width: '100%',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>RÉUSSITE</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-success)' }}>
              {scorePct} %
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>STREAK</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ff5722', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Flame size={20} />
              <span>{db.streak.currentStreak} j</span>
            </div>
            {isFreePracticeRun && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Déjà validé aujourd'hui</span>
            )}
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>XP GAGNÉS</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isFreePracticeRun ? 'var(--text-muted)' : 'var(--color-primary)' }}>
              {isFreePracticeRun ? '+0' : `+${isDailyMode ? 50 + correctCount * 5 : totalCount * 15}`}
            </div>
            {isFreePracticeRun && (
              <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>0 XP aujourd'hui</span>
            )}
          </div>
        </div>

        <button
          onClick={prepareCards}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff',
            padding: '14px 28px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 800,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <RotateCw size={18} />
          <span>Recommencer une session</span>
        </button>
      </div>
    );
  }

  const boxBadge = getBoxBadge(currentCard.leitnerBox);

  // Côté affiché selon direction & flip
  const isFront = !isFlipped;

  const frontText = isFrenchOnFront ? currentCard.french : currentCard.english;
  const backText = isFrenchOnFront ? currentCard.english : currentCard.french;
  const frontLang = isFrenchOnFront ? 'Français' : 'Anglais';
  const backLang = isFrenchOnFront ? 'Anglais' : 'Français';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 'calc(100vh - 68px)',
        padding: '24px 32px 32px',
        maxWidth: '860px',
        margin: '0 auto',
        width: '100%',
        userSelect: 'none',
      }}
    >
      {/* Barre d'outils supérieure : Progression, Filtre de playlist, Inversion FR ⇄ EN */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {/* Indicateur de progression X / Total */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '280px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Carte {currentIndex + 1} / {cards.length}
          </span>
          <div
            style={{
              flex: 1,
              height: '8px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${((currentIndex + 1) / cards.length) * 100}%`,
                height: '100%',
                backgroundColor: 'var(--color-primary)',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Badge d'avertissement en mode entraînement libre */}
        {isDailyMode && isFreePracticeRun && (
          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 800,
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⚠️ Entraînement libre : aucune XP aujourd'hui</span>
          </div>
        )}

        {/* Sélecteur de playlist si mode libre */}
        {!isDailyMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              value={activePlaylistId || ''}
              onChange={(e) => setActivePlaylistId(e.target.value || null)}
              style={{
                fontSize: '0.85rem',
                padding: '6px 12px',
              }}
            >
              <option value="">Toutes les flashcards</option>
              {db.playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.wordIds.length} mots)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Bouton unique pour inverser le sens de lecture (FR ⇄ EN) avec mémorisation */}
        <button
          onClick={toggleDirection}
          title="Inverser le sens de toutes les flashcards (Raccourci : I)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          <ArrowLeftRight size={16} color="var(--color-primary)" />
          <span>{direction === 'fr_to_en' ? 'FR ➔ EN' : 'EN ➔ FR'}</span>
          <kbd
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              padding: '1px 5px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
            }}
          >
            I
          </kbd>
        </button>
      </div>

      {/* ZONE CENTRALE : La Flashcard 3D */}
      <div
        className="perspective-1000"
        style={{
          width: '100%',
          maxWidth: '640px',
          height: '380px',
          cursor: 'pointer',
          margin: '20px 0',
        }}
        onClick={handleFlip}
      >
        <div
          className={`transform-style-preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* RECTO */}
          <div
            className="backface-hidden"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'var(--bg-card)',
              border: '2px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Haut : Boîte Leitner & Langue */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  backgroundColor: boxBadge.bg,
                  color: boxBadge.text,
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                {boxBadge.label}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {frontLang}
              </span>
            </div>

            {/* Centre : Mot principal */}
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <h2
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  marginBottom: '12px',
                }}
              >
                {frontText}
              </h2>

              {/* Bouton prononciation si le recto est en anglais */}
              {!isFrenchOnFront && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={(e) => handlePronounce(e)}
                    title="Écouter la prononciation (Touche P)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '999px',
                      padding: '6px 14px',
                      fontSize: '0.85rem',
                      color: 'var(--color-primary)',
                      fontWeight: 700,
                    }}
                  >
                    <Volume2 size={16} />
                    <span>Écouter ({voiceAccent === 'en-US' ? 'US' : 'UK'})</span>
                    {audioSource === 'fallback' && (
                      <span
                        title="Voix de secours : qualité réduite"
                        style={{
                          fontSize: '0.65rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.25)',
                          color: '#f59e0b',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 800,
                          marginLeft: '2px',
                        }}
                      >
                        ⚠️ Secours
                      </span>
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSlowMode((prev) => !prev);
                    }}
                    title="Activer ou désactiver le mode ralenti (0.7x)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: isSlowMode ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-secondary)',
                      border: isSlowMode ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
                      color: isSlowMode ? '#f59e0b' : 'var(--text-muted)',
                      borderRadius: '999px',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    <span>🐢 Lent {isSlowMode ? '0.7x' : '1.0x'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bas : Tags & invite retournement */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {currentCard.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Cliquer ou</span>
                <kbd style={{ backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>Espace</kbd>
                <span>pour retourner</span>
              </span>
            </div>
          </div>

          {/* VERSO */}
          <div
            className="backface-hidden rotate-y-180"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'var(--bg-card)',
              border: '2px solid var(--color-primary)',
              borderRadius: 'var(--radius-xl)',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            {/* Haut : Boîte Leitner & Langue */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  backgroundColor: boxBadge.bg,
                  color: boxBadge.text,
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                {boxBadge.label}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                {backLang} (Traduction)
              </span>
            </div>

            {/* Centre : Mot traduit & Prononciation */}
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <h2
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  marginBottom: '10px',
                }}
              >
                {backText}
              </h2>

              {/* Bouton audio si le verso est en anglais */}
              {isFrenchOnFront && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <button
                    onClick={(e) => handlePronounce(e)}
                    title="Écouter la prononciation (Touche P)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '999px',
                      padding: '6px 14px',
                      fontSize: '0.85rem',
                      color: 'var(--color-primary)',
                      fontWeight: 700,
                    }}
                  >
                    <Volume2 size={16} />
                    <span>Écouter ({voiceAccent === 'en-US' ? 'US' : 'UK'})</span>
                    {audioSource === 'fallback' && (
                      <span
                        title="Voix de secours : qualité réduite"
                        style={{
                          fontSize: '0.65rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.25)',
                          color: '#f59e0b',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 800,
                          marginLeft: '2px',
                        }}
                      >
                        ⚠️ Secours
                      </span>
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSlowMode((prev) => !prev);
                    }}
                    title="Activer ou désactiver le mode ralenti (0.7x)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: isSlowMode ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-secondary)',
                      border: isSlowMode ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
                      color: isSlowMode ? '#f59e0b' : 'var(--text-muted)',
                      borderRadius: '999px',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    <span>🐢 Lent {isSlowMode ? '0.7x' : '1.0x'}</span>
                  </button>
                </div>
              )}

              {/* Exemple de phrase si disponible avec badge de source et contrôles (Régénérer / Modifier / Supprimer) */}
              {currentCard.example ? (
                <div
                  style={{
                    marginTop: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEditingExample ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '480px' }}>
                      <input
                        type="text"
                        value={editedExampleText}
                        onChange={(e) => setEditedExampleText(e.target.value)}
                        placeholder="Votre phrase d'exemple personnalisée..."
                        autoFocus
                        style={{
                          width: '100%',
                          fontSize: '0.9rem',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-primary)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            updateWord({
                              ...currentCard,
                              example: editedExampleText.trim(),
                              exampleSource: 'user',
                            });
                            setIsEditingExample(false);
                          } else if (e.key === 'Escape') {
                            setIsEditingExample(false);
                          }
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => setIsEditingExample(false)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => {
                            updateWord({
                              ...currentCard,
                              example: editedExampleText.trim(),
                              exampleSource: 'user',
                            });
                            setIsEditingExample(false);
                          }}
                          style={{
                            padding: '3px 10px',
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--color-primary)',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Enregistrer (Ma phrase)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <p
                          style={{
                            fontSize: '0.95rem',
                            fontStyle: 'italic',
                            color: 'var(--text-secondary)',
                            margin: 0,
                            textAlign: 'center',
                          }}
                        >
                          "{currentCard.example}"
                        </p>

                        {/* Badge de source de la phrase */}
                        {currentCard.exampleSource === 'local_llm' && (
                          <span
                            title="Phrase générée hors ligne par le modèle local"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              backgroundColor: 'rgba(99, 102, 241, 0.15)',
                              color: 'var(--color-primary)',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                            }}
                          >
                            <Bot size={11} />
                            <span>Générée par IA (locale)</span>
                          </span>
                        )}

                        {currentCard.exampleSource === 'api' && (
                          <span
                            title="Phrase générée par l'API distante"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              backgroundColor: 'rgba(236, 72, 153, 0.15)',
                              color: '#ec4899',
                              padding: '2px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            <Sparkles size={11} />
                            <span>IA</span>
                          </span>
                        )}

                        {currentCard.exampleSource === 'dictionary' && (
                          <span
                            title="Exemple issu du dictionnaire en ligne"
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-muted)',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            📖 Dictionnaire
                          </span>
                        )}

                        {currentCard.exampleSource === 'user' && (
                          <span
                            title="Votre phrase personnalisée (ne sera jamais écrasée)"
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            ✍️ Ma phrase
                          </span>
                        )}
                      </div>

                      {/* Boutons d'action pour la phrase */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={(e) => handlePronounceExample(e)}
                          title="Écouter la phrase d'exemple"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '999px',
                            padding: '3px 10px',
                            fontSize: '0.72rem',
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Volume2 size={12} color="var(--color-primary)" />
                          <span>Écouter</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            regenerateWordSentence(currentCard.id);
                          }}
                          title="Régénérer cette phrase avec l'IA"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '999px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          <RotateCw size={11} />
                          <span>Régénérer</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditedExampleText(currentCard.example || '');
                            setIsEditingExample(true);
                          }}
                          title="Modifier cette phrase (devient 'ma phrase')"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '999px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          <Edit3 size={11} />
                          <span>Modifier</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteWordSentence(currentCard.id);
                          }}
                          title="Supprimer la phrase d'exemple"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '999px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            color: 'var(--color-danger, #ef4444)',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={11} />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Aucune phrase actuellement */
                <div style={{ marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => regenerateWordSentence(currentCard.id)}
                    title="Générer une phrase d'exemple en arrière-plan"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px dashed rgba(99, 102, 241, 0.4)',
                      borderRadius: '999px',
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      color: 'var(--color-primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Sparkles size={12} />
                    <span>Générer un exemple (IA)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bas : Note & Raccourcis */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {currentCard.note ? `Note : ${currentCard.note}` : 'Sélectionnez votre niveau de maîtrise'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                Verso dévoilé ✔️
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ZONE INFÉRIEURE : Boutons d'Action (Je maîtrise / Je ne maîtrise pas encore) */}
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
        }}
      >
        <button
          onClick={() => handleAnswer(false)}
          disabled={!isFlipped}
          style={{
            backgroundColor: !isFlipped ? 'var(--bg-secondary)' : 'var(--color-danger-light)',
            border: !isFlipped ? '1px solid var(--border-subtle)' : '2px solid var(--color-danger)',
            color: !isFlipped ? 'var(--text-muted)' : 'var(--color-danger)',
            padding: '16px 24px',
            borderRadius: 'var(--radius-lg)',
            fontWeight: 800,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: !isFlipped ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <X size={20} strokeWidth={3} />
          <span>Pas encore (Boîte 1)</span>
          <kbd
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '0.75rem',
            }}
          >
            ←
          </kbd>
        </button>

        <button
          onClick={() => handleAnswer(true)}
          disabled={!isFlipped}
          style={{
            backgroundColor: !isFlipped ? 'var(--bg-secondary)' : 'var(--color-success-light)',
            border: !isFlipped ? '1px solid var(--border-subtle)' : '2px solid var(--color-success)',
            color: !isFlipped ? 'var(--text-muted)' : 'var(--color-success)',
            padding: '16px 24px',
            borderRadius: 'var(--radius-lg)',
            fontWeight: 800,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: !isFlipped ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Check size={20} strokeWidth={3} />
          <span>Je maîtrise ! (+1 Boîte)</span>
          <kbd
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '0.75rem',
            }}
          >
            →
          </kbd>
        </button>
      </div>
    </div>
  );
};
