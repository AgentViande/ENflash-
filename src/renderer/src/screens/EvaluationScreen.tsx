import React, { useState, useEffect, useRef } from 'react';
import {
  PenTool,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  TrendingUp,
  Award,
  Sparkles,
  History,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Word, WeeklyAnswer, LevenshteinStatus } from '../../../shared/types';
import { evaluateAnswer } from '../../../shared/levenshtein/correction';
import { Mascot } from '../assets/Mascot';
import { shuffleArray } from '../../../shared/picker/weightedPicker';
import { speakText, preloadAudioList } from '../utils/audio';

export const EvaluationScreen: React.FC = () => {
  const { db, recordWeeklyEvaluation, playSfx, isWeeklyDoneThisWeek } = useApp();

  const [inTest, setInTest] = useState(false);
  const [testWords, setTestWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [answers, setAnswers] = useState<WeeklyAnswer[]>([]);
  const [currentAnswerResult, setCurrentAnswerResult] = useState<WeeklyAnswer | null>(null);
  const [testCompleted, setTestCompleted] = useState(false);
  const [isFreePracticeRun, setIsFreePracticeRun] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus automatique
  useEffect(() => {
    if (inTest && !currentAnswerResult) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [inTest, currentIndex, currentAnswerResult]);

  if (!db) return null;

  const currentWord: Word | undefined = testWords[currentIndex];
  const previousEvaluations = db.weeklyEvaluations;
  const lastEval = previousEvaluations[0];

  const startEvaluation = () => {
    if (db.words.length === 0) return;

    setIsFreePracticeRun(isWeeklyDoneThisWeek);

    // Sélectionne jusqu'à 15 mots du dictionnaire
    const count = Math.min(15, db.words.length);
    const shuffled = shuffleArray(db.words).slice(0, count);

    setTestWords(shuffled);
    setCurrentIndex(0);
    setCurrentInput('');
    setAnswers([]);
    setCurrentAnswerResult(null);
    setTestCompleted(false);
    setInTest(true);

    // Préchargement en arrière-plan des audios de l'évaluation
    if (shuffled.length > 0) {
      preloadAudioList(
        shuffled.map((w) => w.english),
        db.settings.voiceAccent,
        db.settings.preferredVoiceId
      );
    }
  };

  const handleValidateAnswer = () => {
    if (!currentWord || currentAnswerResult) return;

    // Analyse intelligente via Levenshtein
    const evaluated = evaluateAnswer(
      currentWord.id,
      currentWord.french,
      currentWord.english,
      currentInput
    );

    setCurrentAnswerResult(evaluated);

    if (evaluated.status === 'exact') {
      playSfx('success');
    } else if (evaluated.status === 'almost') {
      playSfx('success');
    } else {
      playSfx('wrong');
    }
  };

  const handleNextWord = async () => {
    if (!currentAnswerResult) return;

    const nextAnswers = [...answers, currentAnswerResult];
    setAnswers(nextAnswers);
    setCurrentAnswerResult(null);
    setCurrentInput('');

    if (currentIndex + 1 >= testWords.length) {
      // Fin de l'évaluation
      await recordWeeklyEvaluation(nextAnswers);
      setTestCompleted(true);
      setInTest(false);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!currentAnswerResult) {
        handleValidateAnswer();
      } else {
        handleNextWord();
      }
    } else if (e.key.toLowerCase() === 'p' && currentAnswerResult) {
      e.preventDefault();
      speakText(currentAnswerResult.expected, {
        accent: db.settings.voiceAccent,
        speed: db.settings.voiceSpeed || 1.0,
        preferredVoiceId: db.settings.preferredVoiceId,
      });
    }
  };

  // ÉCRAN 1 : PENDANT L'ÉVALUATION (Saisie écrite mot par mot)
  if (inTest && currentWord) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 'calc(100vh - 68px)',
          padding: '28px 32px 40px',
          maxWidth: '720px',
          margin: '0 auto',
          width: '100%',
          animation: 'fadeInScale 0.2s ease',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Progression */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Question {currentIndex + 1} / {testWords.length}
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
                width: `${((currentIndex + 1) / testWords.length) * 100}%`,
                height: '100%',
                backgroundColor: 'var(--color-primary)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Question & Champ de réponse */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '24px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Traduisez en anglais :
            </span>
            <h2
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginTop: '6px',
              }}
            >
              {currentWord.french}
            </h2>
            {currentWord.tags && currentWord.tags.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '6px' }}>
                {currentWord.tags.map((t, i) => (
                  <span key={i} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Champ de saisie */}
          <div style={{ width: '100%', maxWidth: '440px' }}>
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              disabled={!!currentAnswerResult}
              placeholder="Tapez la traduction ici..."
              style={{
                width: '100%',
                fontSize: '1.25rem',
                padding: '14px 20px',
                textAlign: 'center',
                fontWeight: 600,
                borderRadius: 'var(--radius-lg)',
              }}
            />
          </div>

          {/* RÉSULTAT ET ANALYSE INTELLIGENTE */}
          {currentAnswerResult && (
            <div
              style={{
                width: '100%',
                maxWidth: '480px',
                padding: '16px 20px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor:
                  currentAnswerResult.status === 'exact'
                    ? 'var(--color-success-light)'
                    : currentAnswerResult.status === 'almost'
                    ? 'var(--color-warning-light)'
                    : 'var(--color-danger-light)',
                border: `1px solid ${
                  currentAnswerResult.status === 'exact'
                    ? 'var(--color-success)'
                    : currentAnswerResult.status === 'almost'
                    ? 'var(--color-warning)'
                    : 'var(--color-danger)'
                }`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                animation: 'fadeInScale 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800 }}>
                {currentAnswerResult.status === 'exact' && (
                  <>
                    <CheckCircle2 size={20} color="var(--color-success)" />
                    <span style={{ color: 'var(--color-success)' }}>Exact ! Bravo !</span>
                  </>
                )}
                {currentAnswerResult.status === 'almost' && (
                  <>
                    <AlertCircle size={20} color="var(--color-warning)" />
                    <span style={{ color: 'var(--color-warning)' }}>
                      Presque ! (Petite faute de frappe acceptée)
                    </span>
                  </>
                )}
                {currentAnswerResult.status === 'wrong' && (
                  <>
                    <XCircle size={20} color="var(--color-danger)" />
                    <span style={{ color: 'var(--color-danger)' }}>Incorrect</span>
                  </>
                )}
              </div>

              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Réponse attendue :{' '}
                <strong style={{ color: 'var(--color-primary)' }}>{currentAnswerResult.expected}</strong>
              </div>

              {/* Bouton audio pour écouter la prononciation correcte (après réponse seulement) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() =>
                    speakText(currentAnswerResult.expected, {
                      accent: db.settings.voiceAccent,
                      speed: db.settings.voiceSpeed || 1.0,
                      preferredVoiceId: db.settings.preferredVoiceId,
                    })
                  }
                  title="Écouter la prononciation anglaise (Touche P)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '999px',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                  }}
                >
                  <Volume2 size={15} />
                  <span>Écouter ({db.settings.voiceAccent === 'en-US' ? 'US' : 'UK'})</span>
                </button>

                {currentWord.example && (
                  <button
                    type="button"
                    onClick={() =>
                      speakText(currentWord.example!, {
                        accent: db.settings.voiceAccent,
                        speed: db.settings.voiceSpeed || 1.0,
                        preferredVoiceId: db.settings.preferredVoiceId,
                      })
                    }
                    title="Écouter la phrase d'exemple"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '999px',
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    <Volume2 size={14} color="var(--color-primary)" />
                    <span>Écouter l'exemple</span>
                  </button>
                )}
              </div>

              {currentWord.example && (
                <div style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  "{currentWord.example}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bouton Suivant ou Valider */}
        <div style={{ width: '100%', maxWidth: '440px' }}>
          {!currentAnswerResult ? (
            <button
              onClick={handleValidateAnswer}
              disabled={!currentInput.trim()}
              style={{
                width: '100%',
                background: !currentInput.trim()
                  ? 'var(--bg-secondary)'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: !currentInput.trim() ? 'var(--text-muted)' : '#ffffff',
                border: 'none',
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: !currentInput.trim() ? 'not-allowed' : 'pointer',
                boxShadow: !currentInput.trim() ? 'none' : 'var(--shadow-glow)',
              }}
            >
              Valider ma réponse (Entrée)
            </button>
          ) : (
            <button
              onClick={handleNextWord}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                border: 'none',
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
                fontWeight: 800,
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>{currentIndex + 1 >= testWords.length ? 'Voir mon bilan final' : 'Mot suivant'}</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ÉCRAN 2 : BILAN FINAL DU TEST TERMINÉ
  if (testCompleted && answers.length > 0) {
    const exactCount = answers.filter((a) => a.status === 'exact').length;
    const almostCount = answers.filter((a) => a.status === 'almost').length;
    const scorePct = Math.round(((exactCount + almostCount * 0.5) / answers.length) * 100);

    // Comparaison avec l'évaluation précédente si existante
    const prevScore = previousEvaluations[1]?.scorePercentage;
    const diffText =
      prevScore !== undefined
        ? scorePct >= prevScore
          ? `+${scorePct - prevScore} % vs la semaine passée`
          : `${scorePct - prevScore} % vs la semaine passée`
        : 'Première évaluation enregistrée !';

    return (
      <div
        style={{
          padding: '32px',
          maxWidth: '820px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          animation: 'fadeInScale 0.25s ease',
        }}
      >
        <Mascot mood="celebrate" size={110} className="animate-float" />

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              borderRadius: '999px',
              padding: '4px 14px',
              fontSize: '0.8rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            <Sparkles size={14} />
            <span>Bilan de l'évaluation</span>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Résultats de votre test écrit 📝
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{diffText}</p>
        </div>

        {/* Cartes métriques */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%' }}>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>SCORE OBTENU</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {scorePct} %
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {exactCount} exact(s), {almostCount} faute(s) de frappe
            </span>
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>NIVEAU ESTIMÉ</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>
              {lastEval ? lastEval.estimatedLevel : 'A1'}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Selon vocabulaire & précision
            </span>
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>XP ATTRIBUÉS</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: isFreePracticeRun ? 'var(--text-muted)' : '#f59e0b' }}>
              {isFreePracticeRun ? '+0' : `+${100 + Math.round(scorePct * 0.8)}`}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isFreePracticeRun ? 'Entraînement libre : déjà validée cette semaine' : "Bonus d'évaluation écrite"}
            </span>
          </div>
        </div>

        {/* Détail des réponses */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>
            Détail de vos réponses :
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {answers.map((ans, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-secondary)',
                  borderLeft: `4px solid ${
                    ans.status === 'exact'
                      ? 'var(--color-success)'
                      : ans.status === 'almost'
                      ? 'var(--color-warning)'
                      : 'var(--color-danger)'
                  }`,
                }}
              >
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{ans.french}</strong> ➔{' '}
                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{ans.expected}</span>
                  {ans.status !== 'exact' && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Votre saisie : "{ans.given}"
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color:
                      ans.status === 'exact'
                        ? 'var(--color-success)'
                        : ans.status === 'almost'
                        ? 'var(--color-warning)'
                        : 'var(--color-danger)',
                  }}
                >
                  {ans.status === 'exact'
                    ? 'Exact'
                    : ans.status === 'almost'
                    ? 'Presque (Faute de frappe)'
                    : 'Faux'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setTestCompleted(false)}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
          }}
        >
          Retour à l'accueil des évaluations
        </button>
      </div>
    );
  }

  // ÉCRAN 3 : ACCUEIL DES ÉVALUATIONS & HISTORIQUE
  return (
    <div
      style={{
        padding: '32px',
        maxWidth: '1000px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        width: '100%',
        animation: 'fadeInScale 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Évaluation hebdomadaire 📝
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Mesurez votre niveau réel en écrivant vous-même les traductions au clavier
          </p>
          {isWeeklyDoneThisWeek && (
            <div
              style={{
                marginTop: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#f59e0b',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              <span>ℹ️ Évaluation officielle déjà validée cette semaine (+XP). Mode entraînement libre actif.</span>
            </div>
          )}
        </div>

        <button
          onClick={startEvaluation}
          disabled={db.words.length === 0}
          style={{
            background:
              db.words.length === 0
                ? 'var(--bg-secondary)'
                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: db.words.length === 0 ? 'var(--text-muted)' : '#ffffff',
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 800,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: db.words.length === 0 ? 'none' : 'var(--shadow-glow)',
            cursor: db.words.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <PenTool size={18} />
          <span>{isWeeklyDoneThisWeek ? "S'entraîner (Entraînement libre)" : "Démarrer l'évaluation écrite"}</span>
        </button>
      </div>

      {/* Résumé du niveau actuel */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase' }}>
            Estimation CECRL actuelle
          </div>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
            Niveau {lastEval ? lastEval.estimatedLevel : 'A1'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Basé sur vos évaluations hebdomadaires et les {db.words.filter((w) => w.leitnerBox === 5).length} mots maîtrisés en Boîte 5.
          </p>
        </div>

        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.5rem',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          {lastEval ? lastEval.estimatedLevel : 'A1'}
        </div>
      </div>

      {/* Historique des évaluations */}
      <div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '14px' }}>
          Historique des évaluations ({previousEvaluations.length})
        </h3>

        {previousEvaluations.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '36px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            Vous n'avez pas encore passé d'évaluation hebdomadaire. Lancez votre première session pour établir votre score de référence !
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {previousEvaluations.map((ev, index) => (
              <div
                key={ev.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Évaluation du {new Date(ev.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {ev.answers.length} mots testés • +{ev.xpEarned} XP
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {ev.scorePercentage} %
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-success)' }}>
                      Niveau {ev.estimatedLevel}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
