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
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Word, LeitnerBox } from '../../../shared/types';
import { speakWord } from '../utils/audio';
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
  const { db, recordReview, recordDailyTest, updateSettings, playSfx } = useApp();

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(selectedPlaylistId);
  const [isDailyMode, setIsDailyMode] = useState<boolean>(initialDailyMode);

  const [cards, setCards] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [dailyResults, setDailyResults] = useState<Array<{ wordId: string; success: boolean }>>([]);

  const direction = db?.settings.cardDirection || 'fr_to_en';
  const voiceAccent = db?.settings.voiceAccent || 'en-US';

  // Préparation du jeu de cartes selon le mode choisi
  const prepareCards = useCallback(() => {
    if (!db || db.words.length === 0) {
      setCards([]);
      return;
    }

    if (isDailyMode) {
      // 20 cartes tirées de manière pondérée
      const picked = pickDailyTestWords(db.words, 20, getTodayDateString());
      setCards(picked);
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
  }, [db, isDailyMode, activePlaylistId]);

  useEffect(() => {
    prepareCards();
  }, [prepareCards]);

  const currentCard: Word | undefined = cards[currentIndex];

  // Inversion globale du sens de lecture
  const toggleDirection = () => {
    const nextDir = direction === 'fr_to_en' ? 'en_to_fr' : 'fr_to_en';
    updateSettings({ cardDirection: nextDir });
  };

  // Prononciation audio
  const handlePronounce = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentCard) return;
    speakWord(currentCard.english, voiceAccent);
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

  // Raccourcis clavier (Espace, Flèches, I)
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleAnswer, isFlipped, sessionCompleted, currentCard]);

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
        <Mascot mood="celebrate" size={120} className="animate-float" />

        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-success-light)',
              color: 'var(--color-success)',
              borderRadius: '999px',
              padding: '4px 14px',
              fontSize: '0.85rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            <Sparkles size={16} />
            <span>Session terminée !</span>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Félicitations ! ⚡
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '4px' }}>
            {isDailyMode
              ? `Votre test quotidien est validé ! Score : ${correctCount} / ${totalCount} (${scorePct} %)`
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
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              +{isDailyMode ? 50 + correctCount * 5 : totalCount * 15}
            </div>
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
  const isFrenchOnFront = direction === 'fr_to_en';

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
                <button
                  onClick={handlePronounce}
                  title="Écouter la prononciation"
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
                </button>
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
                <button
                  onClick={handlePronounce}
                  title="Écouter la prononciation"
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
                    marginBottom: '10px',
                  }}
                >
                  <Volume2 size={16} />
                  <span>Écouter ({voiceAccent === 'en-US' ? 'US' : 'UK'})</span>
                </button>
              )}

              {/* Exemple de phrase si disponible */}
              {currentCard.example && (
                <p
                  style={{
                    fontSize: '0.95rem',
                    fontStyle: 'italic',
                    color: 'var(--text-secondary)',
                    marginTop: '8px',
                    padding: '0 20px',
                  }}
                >
                  "{currentCard.example}"
                </p>
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
