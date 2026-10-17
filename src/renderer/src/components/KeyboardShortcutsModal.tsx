import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Espace', desc: 'Retourner la flashcard active (recto / verso)' },
    { key: '➔ (Flèche Droite)', desc: 'Valider la flashcard ("Je maîtrise")' },
    { key: '⬅ (Flèche Gauche)', desc: 'Répéter la flashcard ("Je ne maîtrise pas encore")' },
    { key: 'I', desc: 'Inverser le sens de toutes les flashcards (FR ⇄ EN)' },
    { key: 'Ctrl + N', desc: 'Ouvrir l’ajout rapide de mot depuis n’importe quel écran' },
    { key: 'Entrée', desc: 'Valider un formulaire ou soumettre une réponse écrite' },
    { key: '?', desc: 'Afficher la liste des raccourcis clavier' },
    { key: 'Échap', desc: 'Fermer la modale courante' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
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
          padding: '28px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Keyboard size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Raccourcis clavier</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Pour une utilisation fluide et ultra-rapide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {shortcuts.map((sc, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                {sc.desc}
              </span>
              <kbd
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  boxShadow: '0 2px 0 var(--border-subtle)',
                  whiteSpace: 'nowrap',
                }}
              >
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            marginTop: '4px',
          }}
        >
          Fermer (Échap)
        </button>
      </div>
    </div>
  );
};
