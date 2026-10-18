import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, ArrowRight, Award, Check } from 'lucide-react';
import { LevelBadge } from './LevelBadge';
import { RankTierDefinition, checkRankEvolution, getLevelRank } from '../../../shared/gamification/levelRanks';
import { getLevelTitle } from '../../../shared/constants';

export interface LevelUpModalData {
  oldLevel: number;
  newLevel: number;
}

interface LevelUpModalProps {
  data: LevelUpModalData | null;
  onClose: () => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ data, onClose }) => {
  const [morphPhase, setMorphPhase] = useState<'old' | 'morphing' | 'new'>('old');

  useEffect(() => {
    if (!data) return;

    // Confettis de célébration
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'],
    });

    const evo = checkRankEvolution(data.oldLevel, data.newLevel);

    if (evo.hasEvolved) {
      setMorphPhase('old');
      const t1 = setTimeout(() => setMorphPhase('morphing'), 1000);
      const t2 = setTimeout(() => {
        setMorphPhase('new');
        confetti({
          particleCount: 120,
          spread: 100,
          origin: { y: 0.5 },
          colors: evo.newTier.gradientColors,
        });
      }, 2200);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      setMorphPhase('new');
    }
  }, [data]);

  if (!data) return null;

  const evo = checkRankEvolution(data.oldLevel, data.newLevel);
  const newRank = getLevelRank(data.newLevel);
  const title = getLevelTitle(data.newLevel);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'modalBackdropFade 0.25s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `2px solid ${evo.newTier.themeColor}`,
          borderRadius: 'var(--radius-xl)',
          padding: '36px 32px',
          maxWidth: '520px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '24px',
          boxShadow: `0 20px 50px ${evo.newTier.glowColor}`,
          animation: 'modalContentPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          position: 'relative',
        }}
      >
        {/* En-tête */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: evo.hasEvolved ? `${evo.newTier.themeColor}22` : 'rgba(99, 102, 241, 0.15)',
              color: evo.newTier.themeColor,
              borderRadius: '999px',
              padding: '4px 14px',
              fontSize: '0.85rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            <Sparkles size={16} />
            <span>{evo.hasEvolved ? 'Évolution de Rang Débloquée !' : 'Niveau Supérieur !'}</span>
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {evo.hasEvolved
              ? `Vous atteignez le rang ${evo.newTier.name} !`
              : `Félicitations pour le Niveau ${data.newLevel} !`}
          </h2>

          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {evo.hasEvolved
              ? `Votre badge évolue vers un palier supérieur : ${evo.newTier.subtitle}`
              : `Vous devenez ${title}. Continuez sur cette belle lancée !`}
          </p>
        </div>

        {/* Animation d'évolution ou Badge central */}
        {evo.hasEvolved ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              padding: '16px 0',
              minHeight: '130px',
            }}
          >
            {/* Ancien badge */}
            <div
              style={{
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: morphPhase === 'old' ? 1 : morphPhase === 'morphing' ? 0.3 : 0.2,
                transform: morphPhase === 'old' ? 'scale(1)' : 'scale(0.85)',
                filter: morphPhase === 'new' ? 'grayscale(0.8)' : undefined,
              }}
            >
              <LevelBadge level={data.oldLevel} size={90} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '6px' }}>
                {evo.oldTier.name} (Niv. {data.oldLevel})
              </div>
            </div>

            {/* Flèche d'évolution */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: evo.newTier.themeColor,
                animation: 'pulseGlow 1.5s infinite ease-in-out',
              }}
            >
              <ArrowRight size={32} strokeWidth={3} />
            </div>

            {/* Nouveau badge avec montée en puissance */}
            <div
              style={{
                transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: morphPhase === 'old' ? 0.25 : 1,
                transform:
                  morphPhase === 'new'
                    ? 'scale(1.2)'
                    : morphPhase === 'morphing'
                    ? 'scale(1.05)'
                    : 'scale(0.85)',
              }}
            >
              <LevelBadge level={data.newLevel} size={96} />
              <div
                style={{
                  fontSize: '0.9rem',
                  color: evo.newTier.themeColor,
                  fontWeight: 900,
                  marginTop: '6px',
                }}
              >
                {evo.newTier.name} (Niv. {data.newLevel})
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px 0' }}>
            <LevelBadge level={data.newLevel} size={110} />
            <div
              style={{
                fontSize: '0.9rem',
                color: evo.newTier.themeColor,
                fontWeight: 800,
                marginTop: '12px',
              }}
            >
              Rang {newRank.tier.name} • {newRank.subStars}/4 étoiles
            </div>
          </div>
        )}

        {/* Bouton Continuer */}
        <button
          onClick={onClose}
          style={{
            background: `linear-gradient(135deg, ${evo.newTier.gradientColors[1]}, ${evo.newTier.gradientColors[2] || '#6366f1'})`,
            color: '#ffffff',
            padding: '12px 36px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 800,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: `0 4px 16px ${evo.newTier.glowColor}`,
            cursor: 'pointer',
          }}
        >
          <Check size={20} strokeWidth={3} />
          <span>Continuer à apprendre</span>
        </button>
      </div>
    </div>
  );
};
