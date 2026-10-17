import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, AlertTriangle, Check, Sparkles } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Word } from '../../../shared/types';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose }) => {
  const { db, addWord } = useApp();

  const [french, setFrench] = useState('');
  const [english, setEnglish] = useState('');
  const [example, setExample] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [note, setNote] = useState('');
  const [chainMode, setChainMode] = useState(true);

  const [duplicateWarning, setDuplicateWarning] = useState<Word | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const frenchInputRef = useRef<HTMLInputElement>(null);

  // Focus automatique à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        frenchInputRef.current?.focus();
      }, 50);
      setDuplicateWarning(null);
      setSuccessToast(null);
    }
  }, [isOpen]);

  // Détection des doublons en temps réel lors de la saisie
  useEffect(() => {
    if (!db || (!french.trim() && !english.trim())) {
      setDuplicateWarning(null);
      return;
    }

    const normFr = french.trim().toLowerCase();
    const normEn = english.trim().toLowerCase();

    const found = db.words.find(
      (w) =>
        (normFr.length > 1 && w.french.trim().toLowerCase() === normFr) ||
        (normEn.length > 1 && w.english.trim().toLowerCase() === normEn)
    );

    setDuplicateWarning(found || null);
  }, [french, english, db]);

  if (!isOpen) return null;

  const handleSubmit = async (force: boolean = false) => {
    if (!french.trim() || !english.trim()) return;

    const tags = tagsInput
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const result = await addWord(
      {
        french,
        english,
        example,
        tags,
        note,
      },
      force
    );

    if (result.isDuplicate && !force) {
      setDuplicateWarning(result.duplicateWord || null);
      return;
    }

    // Réinitialisation et feedback
    setSuccessToast(`Mot "${english.trim()}" ajouté avec succès !`);
    setTimeout(() => setSuccessToast(null), 2500);

    setFrench('');
    setEnglish('');
    setExample('');
    setNote('');
    setDuplicateWarning(null);

    if (chainMode) {
      frenchInputRef.current?.focus();
    } else {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (!example && !note))) {
      e.preventDefault();
      handleSubmit();
    }
  };

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
        style={{
          width: '560px',
          maxWidth: '92vw',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          animation: 'modalContentPop 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* En-tête de la modale */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Ajout rapide de mot</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Saisie express avec génération automatique de la flashcard
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

        {/* Toast de succès enchaîné */}
        {successToast && (
          <div
            style={{
              backgroundColor: 'var(--color-success-light)',
              border: '1px solid var(--color-success)',
              color: 'var(--color-success)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Check size={16} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Alerte doublon */}
        {duplicateWarning && (
          <div
            style={{
              backgroundColor: 'var(--color-warning-light)',
              border: '1px solid var(--color-warning)',
              color: 'var(--color-warning)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <AlertTriangle size={18} />
              <span>Attention : un mot similaire existe déjà !</span>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>
              Mot existant : <strong>{duplicateWarning.french}</strong> ➔ <strong>{duplicateWarning.english}</strong> (Boîte {duplicateWarning.leitnerBox})
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => handleSubmit(true)}
                style={{
                  background: 'var(--color-warning)',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                Ajouter quand même en doublon
              </button>
            </div>
          </div>
        )}

        {/* Formulaire */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Français <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                ref={frenchInputRef}
                type="text"
                value={french}
                onChange={(e) => setFrench(e.target.value)}
                placeholder="Ex : une pomme"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Anglais <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={english}
                onChange={(e) => setEnglish(e.target.value)}
                placeholder="Ex : an apple"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Phrase d'exemple (optionnelle)
            </label>
            <input
              type="text"
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="Ex : An apple a day keeps the doctor away."
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Catégorie / Tags (séparés par virgules)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Ex : Nourriture, Fruits"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Note mémo (optionnelle)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex : Nom dénombrable"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Options de pied de page */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={chainMode}
              onChange={(e) => setChainMode(e.target.checked)}
              style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
            <span>Enchaîner les ajouts sans fermer</span>
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Fermer
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={!french.trim() || !english.trim()}
              style={{
                background:
                  !french.trim() || !english.trim()
                    ? 'var(--bg-card-hover)'
                    : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: !french.trim() || !english.trim() ? 'var(--text-muted)' : '#ffffff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow:
                  !french.trim() || !english.trim() ? 'none' : 'var(--shadow-glow)',
                cursor: !french.trim() || !english.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <Plus size={18} />
              <span>Ajouter (Entrée)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
