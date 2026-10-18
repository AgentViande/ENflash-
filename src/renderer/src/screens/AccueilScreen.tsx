import React from 'react';
import {
  Sparkles,
  Flame,
  CheckCircle2,
  Play,
  ArrowRight,
  BookOpen,
  Plus,
  TrendingUp,
  Award,
  PenTool,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Mascot } from '../assets/Mascot';
import { getParisDayKey, getMsUntilNextParisMidnight, formatCountdown } from '../../../shared/date/parisDate';
import { ScreenTab } from '../components/Sidebar';

interface AccueilScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onOpenQuickAdd: () => void;
  onStartDailyTest: () => void;
}

export const AccueilScreen: React.FC<AccueilScreenProps> = ({
  onNavigate,
  onOpenQuickAdd,
  onStartDailyTest,
}) => {
  const { db, currentDayKey, isDailyDoneToday, getTodayOfficialSession } = useApp();

  const [countdownText, setCountdownText] = React.useState<string>(() =>
    formatCountdown(getMsUntilNextParisMidnight())
  );

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCountdownText(formatCountdown(getMsUntilNextParisMidnight()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!db) return null;

  const todayStr = currentDayKey || getParisDayKey();
  const todaySession = getTodayOfficialSession();

  const totalWords = db.words.length;
  const masteredWords = db.words.filter((w) => w.leitnerBox === 5).length;
  const learningWords = db.words.filter((w) => w.leitnerBox >= 2 && w.leitnerBox <= 4).length;
  const newOrDueWords = db.words.filter(
    (w) => w.leitnerBox === 1 || (w.nextReviewDate && w.nextReviewDate <= todayStr)
  ).length;

  const masteredPercent = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;

  // Dernière évaluation hebdomadaire
  const lastEval = db.weeklyEvaluations[0];

  return (
    <div
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
        animation: 'fadeInScale 0.25s ease',
      }}
    >
      {/* Bannière de Bienvenue avec Flashy */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '650px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: 800, fontSize: '0.85rem' }}>
            <Sparkles size={16} />
            <span>SESSION DU JOUR</span>
          </div>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {isDailyDoneToday
              ? 'Superbe travail ! Votre streak est sécurisé ! 🔥'
              : 'Bienvenue sur ENflash ! Prêt pour votre défi ? ⚡'}
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {isDailyDoneToday
              ? `Vous avez brillamment réussi votre test quotidien. Continuez à enrichir votre vocabulaire ou explorez vos playlists personnalisées !`
              : `Révisez vos 20 flashcards du jour pour ancrer vos mots dans la mémoire à long terme et prolonger votre série !`}
          </p>
        </div>

        <div style={{ flexShrink: 0 }}>
          <Mascot mood={isDailyDoneToday ? 'celebrate' : 'happy'} size={110} className="animate-float" />
        </div>
      </div>

      {/* Cartes Clés : Défi du Jour & Évaluation Hebdo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
        {/* CARTE DÉFI DU JOUR */}
        <div
          style={{
            background: isDailyDoneToday
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.1) 100%)',
            border: isDailyDoneToday ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '18px',
            boxShadow: isDailyDoneToday ? 'none' : 'var(--shadow-glow)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    backgroundColor: isDailyDoneToday ? 'var(--color-success)' : 'var(--color-primary)',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  {isDailyDoneToday ? 'Test du jour : fait ✅ (prochain à 00h00)' : 'Test du jour : à faire'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  ⏳ Prochain à minuit dans {countdownText} (Europe/Paris)
                </span>
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {isDailyDoneToday ? 'Test quotidien validé' : 'Test Quotidien du Jour'}
              </h3>
            </div>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: isDailyDoneToday ? 'var(--color-success-light)' : 'var(--color-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDailyDoneToday ? 'var(--color-success)' : 'var(--color-primary)',
              }}
            >
              {isDailyDoneToday ? <CheckCircle2 size={24} /> : <Flame size={24} />}
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isDailyDoneToday && todaySession
              ? `Score officiel du jour : ${todaySession.score} / ${todaySession.total} (${Math.round(
                  (todaySession.score / todaySession.total) * 100
                )} %). +${todaySession.xpEarned} XP remportés !`
              : 'Tirage pondéré intelligent : priorité maximale accordée aux mots que vous maîtrisez le moins et à ceux en retard de révision.'}
          </p>

          {isDailyDoneToday && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f59e0b',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              <span>ℹ️ Entraînement libre : aucune XP aujourd'hui</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onStartDailyTest}
              style={{
                background: isDailyDoneToday
                  ? 'var(--bg-card)'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: isDailyDoneToday ? 'var(--text-primary)' : '#ffffff',
                border: isDailyDoneToday ? '1px solid var(--border-subtle)' : 'none',
                padding: '12px 24px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 800,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: isDailyDoneToday ? 'none' : 'var(--shadow-glow)',
              }}
            >
              <Play size={18} fill="currentColor" />
              <span>{isDailyDoneToday ? 'Rejouer en entraînement libre' : 'Lancer le test (20 mots)'}</span>
            </button>
          </div>
        </div>

        {/* CARTE ÉVALUATION HEBDOMADAIRE */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '18px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                Hebdomadaire
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Saisie écrite
              </span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Évaluation Écrite
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Testez votre orthographe avec correction intelligente tolérante aux fautes de frappe.
            </p>
          </div>

          {lastEval && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dernier score :</span>
              <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                {lastEval.scorePercentage} % (Niveau {lastEval.estimatedLevel})
              </span>
            </div>
          )}

          <button
            onClick={() => onNavigate('evaluation')}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Passer l'évaluation</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Raccourcis et Actions rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {/* Total Mots */}
        <div
          onClick={() => onNavigate('mots')}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Dictionnaire</span>
            <BookOpen size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalWords} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>mots</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
            Gérer mon vocabulaire ➔
          </span>
        </div>

        {/* Mots Maîtrisés (Boîte 5) */}
        <div
          onClick={() => onNavigate('progression')}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-success)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Maîtrisés</span>
            <Award size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-success)' }}>
            {masteredPercent} %
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {masteredWords} mots en boîte 5
          </span>
        </div>

        {/* En Cours d'Apprentissage (Boîtes 2 à 4) */}
        <div
          onClick={() => onNavigate('etudier')}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-warning)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-warning)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>En cours</span>
            <TrendingUp size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-warning)' }}>
            {learningWords} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>mots</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Boîtes 2 à 4 Leitner
          </span>
        </div>

        {/* À réviser / Nouveaux */}
        <div
          onClick={onOpenQuickAdd}
          style={{
            background: 'var(--bg-card)',
            border: '1px dashed var(--color-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            gap: '6px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary-light)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={18} />
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Ajout rapide (Ctrl+N)
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Saisir un mot vu en cours
          </span>
        </div>
      </div>
    </div>
  );
};
