import React, { useState, useEffect } from 'react';
import { Trash2, HardDrive, CheckCircle2 } from 'lucide-react';

export const LocalModelCleanupModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sizeFormatted, setSizeFormatted] = useState('1,60 Go');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (window.api?.checkLocalModelCleanup) {
      window.api.checkLocalModelCleanup().then((res) => {
        if (mounted && res?.needsCleanup) {
          setSizeFormatted(res.sizeFormatted || '1,60 Go');
          setIsOpen(true);
        }
      }).catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, []);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (window.api?.deleteLocalModelFiles) {
        await window.api.deleteLocalModelFiles();
      }
      setIsOpen(false);
    } catch (err) {
      console.error('Erreur lors du nettoyage du modèle orphelin:', err);
      setIsOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDismiss = async () => {
    try {
      if (window.api?.dismissLocalModelCleanup) {
        await window.api.dismissLocalModelCleanup();
      }
    } catch {}
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          padding: '28px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <HardDrive size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #fff)' }}>
              Libérer {sizeFormatted} d'espace disque
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
              Nettoyage des anciens fichiers du modèle de langage local
            </p>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary, #cbd5e1)' }}>
          Le modèle de langage local a été définitivement retiré d'ENflash au profit des clés d'API externes (Google Gemini, OpenAI, etc.), bien plus fiables, légères et rapides.
        </p>

        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '0.82rem',
            color: '#10b981',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Sécurité garantie :</strong> Seuls les anciens fichiers du modèle local sont supprimés. Vos voix neuronales Kokoro, votre cache audio et toutes vos données personnelles restent strictement préservés.
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isDeleting}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
              backgroundColor: 'transparent',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Garder les fichiers
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            }}
          >
            <Trash2 size={16} />
            <span>{isDeleting ? 'Suppression en cours...' : `Supprimer et libérer ${sizeFormatted}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
