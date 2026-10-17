import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import { Mascot } from '../assets/Mascot';

interface WhatsNewModalProps {
  isOpen: boolean;
  version: string;
  onClose: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, version, onClose }) => {
  if (!isOpen) return null;

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
        animation: 'modalBackdropFade 0.15s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '520px',
          maxWidth: '92vw',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 28px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '18px',
        }}
      >
        <Mascot mood="celebrate" size={90} className="animate-float" />

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
          }}
        >
          <Sparkles size={14} />
          <span>Mise à jour réussie !</span>
        </div>

        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Bienvenue dans ENflash v{version} ! ⚡
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Votre application d'apprentissage est à jour avec les dernières améliorations.
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            textAlign: 'left',
            width: '100%',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 700 }}>
            <Check size={16} color="#10b981" />
            <span>Système de répétition espacée Leitner (5 boîtes)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 700 }}>
            <Check size={16} color="#10b981" />
            <span>Test quotidien de 20 mots & Évaluation hebdomadaire écrite</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 700 }}>
            <Check size={16} color="#10b981" />
            <span>Streak avec jokers de gel & Heatmap d'activité</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 700 }}>
            <Check size={16} color="#10b981" />
            <span>Sauvegarde automatique hors ligne et mise à jour transparente</span>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 800,
            fontSize: '1rem',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          C'est parti !
        </button>
      </div>
    </div>
  );
};
