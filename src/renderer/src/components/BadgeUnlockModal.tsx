import React from 'react';
import { Award, Sparkles } from 'lucide-react';
import { BADGE_DEFINITIONS } from '../../../shared/constants';
import { Mascot } from '../assets/Mascot';

interface BadgeUnlockModalProps {
  badgeId: string | null;
  onClose: () => void;
}

export const BadgeUnlockModal: React.FC<BadgeUnlockModalProps> = ({ badgeId, onClose }) => {
  if (!badgeId) return null;

  const badge = BADGE_DEFINITIONS.find((b) => b.id === badgeId);
  if (!badge) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 110,
        animation: 'fadeInScale 0.25s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '420px',
          maxWidth: '92vw',
          backgroundColor: 'var(--bg-card)',
          border: '2px solid var(--color-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 24px',
          boxShadow: 'var(--shadow-glow)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '16px',
        }}
      >
        <Mascot mood="celebrate" size={100} className="animate-float" />

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#f59e0b',
            borderRadius: '999px',
            padding: '4px 12px',
            fontSize: '0.8rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <Sparkles size={14} />
          <span>Nouveau trophée débloqué !</span>
        </div>

        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-secondary)',
            border: '3px solid var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          {badge.icon}
        </div>

        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {badge.title}
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {badge.description}
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 800,
            fontSize: '1rem',
            boxShadow: 'var(--shadow-glow)',
            marginTop: '8px',
          }}
        >
          Génial, continuer !
        </button>
      </div>
    </div>
  );
};
