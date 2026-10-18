import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, AlertTriangle, Check, Sparkles, Volume2, RotateCw } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Word, ExampleSourceType } from '../../../shared/types';
import { speakText } from '../utils/audio';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose }) => {
  const { db, addWord, openCentreIA } = useApp();

  const [french, setFrench] = useState('');
  const [english, setEnglish] = useState('');
  const [example, setExample] = useState('');
  const [exampleSource, setExampleSource] = useState<ExampleSourceType | undefined>(undefined);
  const [isGeneratingExample, setIsGeneratingExample] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [note, setNote] = useState('');
  const [chainMode, setChainMode] = useState(true);

  const [duplicateWarning, setDuplicateWarning] = useState<Word | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const frenchInputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef<boolean>(false);
  const [backgroundOffer, setBackgroundOffer] = useState<{ sentence: string; source: ExampleSourceType } | null>(null);

  // Écoute des phrases générées en tâche de fond
  useEffect(() => {
    if (!isOpen) return;

    const unsubBgReady = window.api?.onSentenceGenerated?.((data) => {
      if (data.english && data.english.trim().toLowerCase() === english.trim().toLowerCase()) {
        setBackgroundOffer({ sentence: data.sentence, source: data.source });
      }
    });

    return () => {
      unsubBgReady?.();
    };
  }, [isOpen, english]);

  // Focus automatique à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        frenchInputRef.current?.focus();
      }, 50);
      setDuplicateWarning(null);
      setSuccessToast(null);
      setGenerationError(null);
      setBackgroundOffer(null);
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

  // Générer une phrase d'exemple en direct avec priorité absolue et timeouts séparés
  const handleGenerateExample = async (skipCurrent: boolean = false) => {
    if (!english.trim() || isGeneratingExample) return;
    setIsGeneratingExample(true);
    setGenerationError(null);
    setBackgroundOffer(null);
    isCancelledRef.current = false;

    // Timeout de sécurité global généreux (80s max pour le premier chargement disque)
    const timeoutPromise = new Promise<{ sentence?: string; source?: ExampleSourceType; error?: string } | null>(
      (_, reject) => setTimeout(() => reject(new Error('Délai maximal dépassé')), 80000)
    );

    try {
      if (window.api?.resolveSentenceCascade) {
        const generationPromise = window.api.resolveSentenceCascade({
          english: english.trim(),
          french: french.trim(),
          existingExample: skipCurrent ? undefined : example.trim(),
          skipSentence: skipCurrent ? example.trim() : undefined,
          cascadeOrder: db?.settings.exampleCascadeOrder,
          aiApiProvider: db?.settings.aiApiProvider,
          aiApiKey: db?.settings.aiApiKey,
          aiApiEndpoint: db?.settings.aiApiEndpoint,
          aiApiModel: db?.settings.aiApiModel,
          priority: 'immediate',
        });

        const res = await Promise.race([generationPromise, timeoutPromise]);

        if (isCancelledRef.current) return;

        if (res && res.sentence) {
          setExample(res.sentence);
          setExampleSource(res.source);
          setGenerationError(null);
        } else {
          setGenerationError(res?.error || 'Aucune source disponible pour générer un exemple.');
        }
      }
    } catch (err: any) {
      if (!isCancelledRef.current) {
        setGenerationError(err.message || 'Erreur lors de la génération');
      }
    } finally {
      setIsGeneratingExample(false);
    }
  };

  const handleCancelGenerate = () => {
    isCancelledRef.current = true;
    setIsGeneratingExample(false);
  };

  // Écouter la phrase d'exemple avec Kokoro
  const handlePlayExample = async () => {
    if (!example.trim() || isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      await speakText(example.trim(), {
        accent: db?.settings.voiceAccent,
        preferredVoiceId: db?.settings.preferredVoiceId,
        speed: db?.settings.voiceSpeed || 1.0,
        volume: db?.settings.voiceVolume ?? 0.8,
      });
    } catch (err) {
      console.error('Erreur lecture audio:', err);
    } finally {
      setIsPlayingAudio(false);
    }
  };

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
        exampleSource,
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
    setExampleSource(undefined);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Phrase d'exemple (optionnelle)
                </label>
                {exampleSource && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor:
                        exampleSource === 'dictionary'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(99, 102, 241, 0.15)',
                      color:
                        exampleSource === 'dictionary'
                          ? '#10b981'
                          : 'var(--color-primary)',
                    }}
                  >
                    {exampleSource === 'dictionary'
                      ? '📖 Source : dictionnaire'
                      : '✨ Générée par IA'}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {example.trim() && (
                  <button
                    type="button"
                    onClick={handlePlayExample}
                    disabled={isPlayingAudio}
                    title="Écouter la phrase d'exemple"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <Volume2 size={13} />
                    <span>Écouter</span>
                  </button>
                )}

                {/* Bouton ✨ Générer une phrase (prioritaire) */}
                <button
                  type="button"
                  onClick={() => handleGenerateExample(false)}
                  disabled={!english.trim() || isGeneratingExample}
                  title={
                    !english.trim()
                      ? "Saisissez d'abord le mot en anglais"
                      : "Générer immédiatement une phrase d'exemple"
                  }
                  style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.22))',
                    border: '1px solid var(--color-primary)',
                    color: 'var(--color-primary)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: !english.trim() || isGeneratingExample ? 'not-allowed' : 'pointer',
                    opacity: !english.trim() ? 0.6 : 1,
                  }}
                >
                  {isGeneratingExample ? (
                    <>
                      <RotateCw size={13} className="animate-spin" />
                      <span>Génération en cours…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>✨ Générer une phrase</span>
                    </>
                  )}
                </button>

                {/* Bouton ↻ Autre phrase */}
                {example.trim() && (
                  <button
                    type="button"
                    onClick={() => handleGenerateExample(true)}
                    disabled={!english.trim() || isGeneratingExample}
                    title="Obtenir un autre exemple du dictionnaire ou de l'IA"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: !english.trim() || isGeneratingExample ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <RotateCw size={12} className={isGeneratingExample ? 'animate-spin' : ''} />
                    <span>↻ Autre phrase</span>
                  </button>
                )}

                {/* Bouton Annuler si génération en cours */}
                {isGeneratingExample && (
                  <button
                    type="button"
                    onClick={handleCancelGenerate}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#ef4444',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Annuler
                  </button>
                )}
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={example}
                onChange={(e) => {
                  setExample(e.target.value);
                  setExampleSource(undefined); // Le badge disparaît dès que l'utilisateur modifie
                  setGenerationError(null);
                  setBackgroundOffer(null);
                }}
                placeholder="Ex : An apple a day keeps the doctor away. (ou cliquez sur ✨ Générer une phrase)"
                style={{ width: '100%' }}
              />
            </div>

            {/* Proposition de remplacement par la phrase IA arrivée en tâche de fond */}
            {backgroundOffer && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                  <Sparkles size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  <span>
                    Une phrase IA est prête : <em>« {backgroundOffer.sentence} »</em>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setExample(backgroundOffer.sentence);
                      setExampleSource(backgroundOffer.source || 'api');
                      setBackgroundOffer(null);
                    }}
                    style={{
                      background: 'var(--color-primary)',
                      color: '#fff',
                      border: 'none',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Remplacer
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundOffer(null)}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: 'none',
                      padding: '3px 6px',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                    }}
                  >
                    Ignorer
                  </button>
                </div>
              </div>
            )}

            {/* Message d'erreur lisible avec lien Centre IA */}
            {generationError && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <span style={{ color: '#ef4444' }}>⚠️ {generationError}</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openCentreIA('api_key');
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ouvrir le Centre IA ➔
                </button>
              </div>
            )}

            <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {!example.trim() ? (
                <>
                  💡 <em>Laissez vide pour générer automatiquement via le dictionnaire ou l'IA en tâche de fond.</em>
                </>
              ) : (
                <>
                  ✏️ <em>Vous pouvez retoucher librement cette phrase ou cliquer sur Régénérer.</em>
                </>
              )}
            </p>
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
