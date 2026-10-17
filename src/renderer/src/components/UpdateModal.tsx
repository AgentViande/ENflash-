import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { UpdateInfo } from '../../../preload/types';

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, updateInfo, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; bytesPerSecond: number } | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);

  useEffect(() => {
    if (!window.api) return;

    const unsubProgress = window.api.onUpdateDownloadProgress((progress) => {
      setDownloading(true);
      setDownloadProgress(progress);
    });

    const unsubDownloaded = window.api.onUpdateDownloaded(() => {
      setDownloading(false);
      setDownloadComplete(true);
    });

    return () => {
      unsubProgress();
      unsubDownloaded();
    };
  }, []);

  if (!isOpen || !updateInfo) return null;

  const handleStartDownload = async () => {
    setDownloading(true);
    if (window.api) {
      await window.api.startUpdateDownload();
    }
  };

  const handleInstallNow = async () => {
    if (window.api) {
      await window.api.installDownloadedUpdate();
    }
  };

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
        if (e.target === e.currentTarget && !downloading) onClose();
      }}
    >
      <div
        style={{
          width: '540px',
          maxWidth: '92vw',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Download size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Mise à jour disponible !</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Nouvelle version : <strong>v{updateInfo.version}</strong>
              </p>
            </div>
          </div>
          {!downloading && (
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
          )}
        </div>

        {/* Notes de version en français */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            maxHeight: '220px',
            overflowY: 'auto',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Notes de version (Patch notes) :
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {updateInfo.releaseNotes || 'Améliorations de performances, corrections et optimisations diverses.'}
          </div>
        </div>

        {/* Progression du téléchargement */}
        {downloading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
              <span style={{ color: 'var(--text-primary)' }}>Téléchargement en cours...</span>
              <span style={{ color: 'var(--color-primary)' }}>
                {downloadProgress?.percent || 0} %
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${downloadProgress?.percent || 0}%`,
                  height: '100%',
                  backgroundColor: 'var(--color-primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Succès du téléchargement */}
        {downloadComplete && (
          <div
            style={{
              backgroundColor: 'var(--color-success-light)',
              border: '1px solid var(--color-success)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--color-success)',
              fontSize: '0.9rem',
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={20} />
            <span>Mise à jour prête à être installée !</span>
          </div>
        )}

        {/* Boutons d'action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {!downloadComplete && !downloading && (
            <>
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
                Plus tard
              </button>
              <button
                onClick={handleStartDownload}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Download size={18} />
                <span>Télécharger</span>
              </button>
            </>
          )}

          {downloadComplete && (
            <>
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
                Au prochain redémarrage
              </button>
              <button
                onClick={handleInstallNow}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <RefreshCw size={18} />
                <span>Installer et redémarrer</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
