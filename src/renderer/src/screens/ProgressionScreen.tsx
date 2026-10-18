import React from 'react';
import {
  TrendingUp,
  Award,
  Flame,
  Shield,
  Layers,
  Sparkles,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { calculateLevel, getLevelTitle, BADGE_DEFINITIONS } from '../../../shared/constants';
import { addDaysToDate, getParisDayKey } from '../../../shared/date/parisDate';

export const ProgressionScreen: React.FC = () => {
  const { db, currentDayKey } = useApp();

  if (!db) return null;

  const { streak, gamification, words, playlists, weeklyEvaluations } = db;
  const levelInfo = calculateLevel(gamification.xp);
  const levelTitle = getLevelTitle(levelInfo.level);

  // Statistiques globales
  const totalWords = words.length;
  const box1Count = words.filter((w) => w.leitnerBox === 1).length;
  const box2Count = words.filter((w) => w.leitnerBox === 2).length;
  const box3Count = words.filter((w) => w.leitnerBox === 3).length;
  const box4Count = words.filter((w) => w.leitnerBox === 4).length;
  const box5Count = words.filter((w) => w.leitnerBox === 5).length;

  const masteredCount = box5Count;
  const learningCount = box2Count + box3Count + box4Count;
  const newCount = box1Count;
  const masteredPct = totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;

  // Génération des 30 derniers jours pour la Heatmap dans le fuseau Paris
  const todayStr = currentDayKey || getParisDayKey();
  const last30Days: Array<{ date: string; count: number }> = [];

  for (let i = 29; i >= 0; i--) {
    const d = addDaysToDate(todayStr, -i);
    const count = streak.activityCalendar[d] || 0;
    last30Days.push({ date: d, count });
  }

  return (
    <div
      style={{
        padding: '32px',
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        width: '100%',
        animation: 'fadeInScale 0.25s ease',
      }}
    >
      <div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Tableau de bord de progression 📊
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Suivez votre régularité, vos victoires et l'évolution de vos connaissances
        </p>
      </div>

      {/* 1. CARTE GAMIFICATION : NIVEAU & EXPÉRIENCE */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.8rem',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              {levelInfo.level}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                  Niveau {levelInfo.level} • {levelTitle}
                </h3>
                <span
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: 'var(--color-primary)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  {gamification.xp} XP total
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Plus que {levelInfo.nextLevelXp - levelInfo.currentXp} XP pour atteindre le niveau suivant !
              </p>
            </div>
          </div>
        </div>

        {/* Barre de progression XP */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Progression vers le niveau {levelInfo.level + 1}</span>
            <span style={{ color: 'var(--color-primary)' }}>
              {levelInfo.currentXp} / {levelInfo.nextLevelXp} XP ({levelInfo.progressPercent} %)
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '10px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '5px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${levelInfo.progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #ec4899)',
                borderRadius: '5px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. STREAK ET HEATMAP DES 30 DERNIERS JOURS */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={22} color="#ff5722" />
              <span>Série consécutive (Streak)</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Complétez chaque jour votre test quotidien pour alimenter votre flamme
            </p>
          </div>

          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Série actuelle
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ff5722' }}>
                {streak.currentStreak} jour(s)
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Record personnel
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                {streak.maxStreak} jour(s)
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Jokers de gel
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={18} />
                <span>{streak.streakFreezes}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap d'activité 30 jours */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>
            Activité des 30 derniers jours :
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(15, 1fr)',
              gap: '6px',
            }}
          >
            {last30Days.map((day) => {
              const count = day.count;
              let bg = 'var(--bg-secondary)';
              if (count === 1) bg = 'rgba(99, 102, 241, 0.4)';
              else if (count === 2) bg = 'rgba(99, 102, 241, 0.7)';
              else if (count >= 3) bg = 'var(--color-primary)';

              const dateFormatted = new Date(day.date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              });

              return (
                <div
                  key={day.date}
                  title={`${dateFormatted} : ${count} activité(s)`}
                  style={{
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: bg,
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    color: count > 0 ? '#fff' : 'var(--text-muted)',
                    fontWeight: 700,
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {count > 0 ? count : ''}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. RÉPARTITION LEITNER (5 BOÎTES) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
        }}
      >
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px' }}>
          Répartition de la mémoire (Boîtes Leitner)
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {totalWords} mots au total • {masteredPct} % maîtrisés de façon pérenne (Boîte 5)
        </p>

        {/* Barre globale proportionnelle */}
        <div
          style={{
            height: '18px',
            width: '100%',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '9px',
            display: 'flex',
            overflow: 'hidden',
            marginBottom: '20px',
          }}
        >
          {totalWords > 0 && (
            <>
              <div style={{ width: `${(newCount / totalWords) * 100}%`, backgroundColor: '#ef4444' }} title={`Nouveaux : ${newCount}`} />
              <div style={{ width: `${(learningCount / totalWords) * 100}%`, backgroundColor: '#f59e0b' }} title={`En cours : ${learningCount}`} />
              <div style={{ width: `${(masteredCount / totalWords) * 100}%`, backgroundColor: '#10b981' }} title={`Maîtrisés : ${masteredCount}`} />
            </>
          )}
        </div>

        {/* Détail par boîte 1 à 5 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {[
            { box: 1, name: 'Boîte 1', label: '1 jour', count: box1Count, color: '#ef4444' },
            { box: 2, name: 'Boîte 2', label: '2 jours', count: box2Count, color: '#f59e0b' },
            { box: 3, name: 'Boîte 3', label: '4 jours', count: box3Count, color: '#3b82f6' },
            { box: 4, name: 'Boîte 4', label: '7 jours', count: box4Count, color: '#8b5cf6' },
            { box: 5, name: 'Boîte 5', label: '14 jours (Maîtrisé)', count: box5Count, color: '#10b981' },
          ].map((item) => (
            <div
              key={item.box}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: item.color, textTransform: 'uppercase' }}>
                {item.name}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>
                {item.count}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. GALERIE DES BADGES ET TROPHÉES */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              Trophées et Badges ({gamification.unlockedBadges.length} / {BADGE_DEFINITIONS.length})
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Débloquez des récompenses exclusives en accomplissant vos objectifs
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {BADGE_DEFINITIONS.map((badge) => {
            const isUnlocked = gamification.unlockedBadges.some((b) => b.id === badge.id);
            return (
              <div
                key={badge.id}
                style={{
                  backgroundColor: isUnlocked ? 'var(--bg-secondary)' : 'rgba(255, 255, 255, 0.02)',
                  border: isUnlocked ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  opacity: isUnlocked ? 1 : 0.45,
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: isUnlocked ? 'var(--color-primary-light)' : 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    flexShrink: 0,
                  }}
                >
                  {badge.icon}
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {badge.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: '2px' }}>
                    {badge.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
