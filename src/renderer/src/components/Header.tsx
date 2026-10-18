import React from 'react';
import { Flame, Shield, Sun, Moon, Plus, HelpCircle, Sparkles } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { calculateLevel, getLevelTitle } from '../../../shared/constants';
import { getLevelRank } from '../../../shared/gamification/levelRanks';
import { LevelBadge } from './LevelBadge';

interface HeaderProps {
  onOpenQuickAdd: () => void;
  onOpenShortcuts: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenQuickAdd, onOpenShortcuts }) => {
  const { db, updateSettings } = useApp();

  if (!db) return null;

  const { streak, gamification, settings } = db;
  const levelInfo = calculateLevel(gamification.xp);
  const levelTitle = getLevelTitle(levelInfo.level);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  };

  return (
    <header
      style={{
        height: '68px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-glass)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 20,
      }}
    >
      {/* Logo & Titre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.25rem',
          }}
        >
          ⚡
        </div>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            EN<span style={{ color: 'var(--color-primary)' }}>flash</span>
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Maîtrisez l'anglais mot à mot
          </p>
        </div>
      </div>

      {/* Stats rapides : Streak, Jokers de gel, Niveau & XP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Streak Flame */}
        <div
          title={`Série consécutive : ${streak.currentStreak} jour(s). Record : ${streak.maxStreak} jour(s)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '6px 14px',
            boxShadow: streak.currentStreak > 0 ? '0 0 14px var(--color-flame-glow)' : 'none',
          }}
        >
          <Flame
            size={22}
            className={streak.currentStreak > 0 ? 'animate-flame' : ''}
            color={streak.currentStreak > 0 ? '#ff5722' : '#64748b'}
            fill={streak.currentStreak > 0 ? '#ff5722' : 'none'}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: streak.currentStreak > 0 ? '#ff5722' : 'var(--text-muted)' }}>
              {streak.currentStreak}
            </span>
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Jours
            </span>
          </div>
        </div>

        {/* Jokers de gel (Streak Freezes) */}
        <div
          title={`${streak.streakFreezes} joker(s) de gel disponible(s). Protège votre série si vous manquez un jour ! (+1 tous les 7 jours de streak)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '6px 12px',
          }}
        >
          <Shield size={18} color="#06b6d4" fill={streak.streakFreezes > 0 ? '#06b6d4' : 'none'} />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: streak.streakFreezes > 0 ? '#06b6d4' : 'var(--text-muted)' }}>
            {streak.streakFreezes}
          </span>
        </div>

        {/* Niveau & Jauge d'XP */}
        {(() => {
          const rankInfo = getLevelRank(levelInfo.level);
          return (
            <div
              title={`Niveau ${levelInfo.level} • Rang ${rankInfo.tier.name} (${levelTitle}) : ${levelInfo.currentXp} / ${levelInfo.nextLevelXp} XP`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '6px 14px',
              }}
            >
              <LevelBadge level={levelInfo.level} size={32} showSubProgress={false} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '95px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700 }}>
                  <span style={{ color: rankInfo.tier.themeColor }}>{rankInfo.tier.name}</span>
                  <span style={{ color: 'var(--color-primary)' }}>{levelInfo.progressPercent}%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    background: 'var(--border-subtle)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${levelInfo.progressPercent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                      borderRadius: '3px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Bouton d'ajout rapide (Ctrl+N) */}
        <button
          onClick={onOpenQuickAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: '0.9rem',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>Ajouter un mot</span>
          <span
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600,
            }}
          >
            Ctrl+N
          </span>
        </button>

        {/* Raccourcis clavier info */}
        <button
          onClick={onOpenShortcuts}
          title="Raccourcis clavier (?)"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HelpCircle size={18} />
        </button>

        {/* Thème clair / sombre */}
        <button
          onClick={toggleTheme}
          title={`Passer en mode ${settings.theme === 'dark' ? 'clair' : 'sombre'}`}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {settings.theme === 'dark' ? <Sun size={18} color="#f59e0b" /> : <Moon size={18} color="#6366f1" />}
        </button>
      </div>
    </header>
  );
};
