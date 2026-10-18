import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Volume2,
  Bell,
  RefreshCw,
  Download,
  Upload,
  Sun,
  Moon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Play,
  Check,
  Info,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { VoiceAccent, ThemeMode, PiperVoiceModel } from '../../../shared/types';
import { speakWord, speakText } from '../utils/audio';
import { UpdateInfo } from '../../../preload/types';

interface ParametresScreenProps {
  onOpenUpdateModal: (info: UpdateInfo) => void;
}

export const ParametresScreen: React.FC<ParametresScreenProps> = ({ onOpenUpdateModal }) => {
  const { db, updateSettings, playSfx, refreshDatabase } = useApp();

  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [checkingUpdates, setCheckingUpdates] = useState<boolean>(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  // Voix neuronales & Cache
  const [piperVoices, setPiperVoices] = useState<PiperVoiceModel[]>([]);
  const [downloadingVoiceId, setDownloadingVoiceId] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState<Record<string, number>>({});
  const [cacheStats, setCacheStats] = useState<{ count: number; formattedSize: string }>({
    count: 0,
    formattedSize: '0 Mo',
  });

  const loadVoicesAndCache = useCallback(async () => {
    if (window.api?.getVoicesStatus) {
      try {
        const voices = await window.api.getVoicesStatus();
        setPiperVoices(voices);
      } catch {}
    }
    if (window.api?.getCacheStats) {
      try {
        const stats = await window.api.getCacheStats();
        setCacheStats({ count: stats.count, formattedSize: stats.formattedSize });
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (window.api) {
      window.api.getAppVersion().then(setAppVersion);
      loadVoicesAndCache();

      const unsubscribe = window.api.onVoiceDownloadProgress?.(({ voiceId, progress }) => {
        setVoiceProgress((prev) => ({ ...prev, [voiceId]: progress }));
        if (progress >= 100) {
          setDownloadingVoiceId(null);
          loadVoicesAndCache();
        }
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [loadVoicesAndCache]);

  if (!db) return null;
  const { settings } = db;

  // Test d'une voix spécifique
  const handleTestVoiceSample = (voiceId: string, accent: VoiceAccent) => {
    speakText('Hello! Welcome to ENflash, your English flashcards application.', {
      accent,
      preferredVoiceId: voiceId,
      speed: settings.voiceSpeed || 1.0,
    });
  };

  // Télécharger une voix Piper
  const handleDownloadVoice = async (voiceId: string) => {
    if (!window.api?.downloadVoice) return;
    setDownloadingVoiceId(voiceId);
    setVoiceProgress((prev) => ({ ...prev, [voiceId]: 5 }));
    try {
      const res = await window.api.downloadVoice(voiceId);
      if (res.success) {
        await loadVoicesAndCache();
      } else if (res.error) {
        alert('Erreur lors du téléchargement : ' + res.error);
      }
    } catch (err: any) {
      alert('Erreur : ' + err.message);
    } finally {
      setDownloadingVoiceId(null);
    }
  };

  // Supprimer une voix Piper
  const handleDeleteVoice = async (voiceId: string) => {
    if (!window.api?.deleteVoice) return;
    if (!window.confirm('Voulez-vous supprimer ce modèle de voix pour libérer de l’espace ?')) return;
    await window.api.deleteVoice(voiceId);
    await loadVoicesAndCache();
  };

  // Vider le cache audio
  const handleClearCache = async () => {
    if (!window.api?.clearCache) return;
    await window.api.clearCache();
    await loadVoicesAndCache();
    setBackupMessage('Cache audio vidé avec succès !');
    setTimeout(() => setBackupMessage(null), 3000);
  };

  // Test du son
  const handleTestSound = () => {
    playSfx('success');
  };

  // Test de notification de bureau
  const handleTestNotification = async () => {
    if (window.api) {
      await window.api.sendNotification({
        title: 'ENflash ⚡ Test de rappel',
        body: 'Les notifications de rappel fonctionnent parfaitement ! Prêt pour votre session du jour.',
      });
    }
  };

  // Vérifier les mises à jour GitHub
  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateMessage(null);

    if (window.api) {
      try {
        const res = await window.api.checkForUpdates();
        if (res.available && res.info) {
          onOpenUpdateModal(res.info);
        } else {
          setUpdateMessage('Votre application est à jour (v' + appVersion + '). Aucune nouvelle version disponible.');
        }
      } catch (err: any) {
        setUpdateMessage('Impossible de vérifier les mises à jour : ' + err.message);
      } finally {
        setCheckingUpdates(false);
      }
    } else {
      setCheckingUpdates(false);
      setUpdateMessage('Vérification disponible dans l’application de bureau packagée.');
    }
  };

  // Exporter une sauvegarde JSON complète
  const handleExportBackup = async () => {
    if (window.api) {
      const res = await window.api.exportBackup();
      if (res.success) {
        setBackupMessage('Sauvegarde JSON exportée avec succès !');
        setTimeout(() => setBackupMessage(null), 3000);
      }
    }
  };

  // Importer une sauvegarde JSON complète
  const handleImportBackup = async () => {
    if (!window.confirm('Attention : l’import d’une sauvegarde va remplacer vos données actuelles. Une sauvegarde de sécurité sera automatiquement créée. Continuer ?')) {
      return;
    }

    if (window.api) {
      const res = await window.api.importBackup();
      if (res.success) {
        await refreshDatabase();
        setBackupMessage('Sauvegarde restaurée avec succès !');
        setTimeout(() => setBackupMessage(null), 3000);
      } else if (res.error) {
        setBackupMessage('Erreur lors de la restauration : ' + res.error);
      }
    }
  };

  return (
    <div
      style={{
        padding: '32px',
        maxWidth: '880px',
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
          Paramètres de l'application ⚙️
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Personnalisez votre confort d'apprentissage et gérez vos données
        </p>
      </div>

      {backupMessage && (
        <div
          style={{
            backgroundColor: 'var(--color-success-light)',
            border: '1px solid var(--color-success)',
            color: 'var(--color-success)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{backupMessage}</span>
        </div>
      )}

      {/* 1. APPARENCE ET THÈME */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Apparence</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Thème visuel</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Basculez entre le mode sombre immersif et le mode clair
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => updateSettings({ theme: 'dark' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: settings.theme === 'dark' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                color: settings.theme === 'dark' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <Moon size={16} />
              <span>Sombre</span>
            </button>
            <button
              onClick={() => updateSettings({ theme: 'light' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: settings.theme === 'light' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                color: settings.theme === 'light' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <Sun size={16} />
              <span>Clair</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. AUDIO & VOIX DE HAUTE QUALITÉ */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Synthèse vocale & Qualité des voix 🎙️</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Architecture en cascade : Cache local ➔ Voix neuronales Piper ➔ Enregistrements réels ➔ Voix système
            </p>
          </div>
        </div>

        {/* 2.1 Accent vocal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Accent d'apprentissage</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Détermine l'accent prioritaire pour les cartes, les tests et le dictionnaire
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={settings.voiceAccent}
              onChange={(e) => updateSettings({ voiceAccent: e.target.value as VoiceAccent })}
              style={{ fontSize: '0.9rem', fontWeight: 600 }}
            >
              <option value="en-US">Anglais américain (US)</option>
              <option value="en-GB">Anglais britannique (UK)</option>
            </select>

            <button
              onClick={() => handleTestVoiceSample(settings.preferredVoiceId || '', settings.voiceAccent)}
              title="Tester la prononciation avec cet accent"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--color-primary)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <Volume2 size={16} />
              <span>Tester</span>
            </button>
          </div>
        </div>

        {/* 2.2 Vitesse de lecture (0.6x à 1.2x) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Vitesse de prononciation normale :{' '}
              <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                {(settings.voiceSpeed || 1.0).toFixed(1)}x
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Ajustez l'élocution (un bouton "Mode lent 0.7x" est aussi disponible directement sur les cartes)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0.6x</span>
            <input
              type="range"
              min="0.6"
              max="1.2"
              step="0.05"
              value={settings.voiceSpeed || 1.0}
              onChange={(e) => updateSettings({ voiceSpeed: parseFloat(e.target.value) })}
              style={{ width: '130px', accentColor: 'var(--color-primary)' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1.2x</span>
          </div>
        </div>

        {/* 2.3 Lecture automatique à l'affichage */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Lecture automatique de l'audio</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Prononce automatiquement le mot dès qu'une face en anglais est affichée
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!settings.autoPronounce}
              onChange={(e) => updateSettings({ autoPronounce: e.target.checked })}
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Activer</span>
          </label>
        </div>

        {/* 2.4 Voix neuronales Piper (Moteur local haute fidélité) */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>
                  Voix neuronales hors ligne (Piper TTS)
                </h4>
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                >
                  Sans connexion requise
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Téléchargez les voix de votre choix à la demande pour garder l'installateur léger
              </p>
            </div>

            {/* Voix préférée */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Voix active :
              </span>
              <select
                value={settings.preferredVoiceId || 'auto'}
                onChange={(e) => updateSettings({ preferredVoiceId: e.target.value })}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="auto">Automatique selon l'accent</option>
                {piperVoices
                  .filter((v) => v.isDownloaded)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Liste des 4 modèles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {piperVoices.map((v) => {
              const isDownloading = downloadingVoiceId === v.id;
              const progress = voiceProgress[v.id] || 0;

              return (
                <div
                  key={v.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: v.isDownloaded
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {v.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {v.accent === 'en-US' ? 'Accent américain' : 'Accent britannique'} • {v.sizeFormatted}
                      </div>
                    </div>

                    {v.isDownloaded ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#10b981',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <Check size={14} />
                        Installée
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Non installée
                      </span>
                    )}
                  </div>

                  {/* Barre de progression si en cours de téléchargement */}
                  {isDownloading && (
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                        <span>Téléchargement...</span>
                        <span>{progress}%</span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          backgroundColor: 'var(--border-subtle)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: 'var(--color-primary)',
                            borderRadius: '3px',
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions par voix */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <button
                      onClick={() => handleTestVoiceSample(v.id, v.accent)}
                      style={{
                        flex: 1,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Play size={13} fill="currentColor" />
                      <span>Écouter un exemple</span>
                    </button>

                    {v.isDownloaded ? (
                      <button
                        onClick={() => handleDeleteVoice(v.id)}
                        title="Supprimer la voix pour libérer l'espace disque"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          borderRadius: 'var(--radius-sm)',
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownloadVoice(v.id)}
                        disabled={isDownloading}
                        style={{
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#fff',
                          borderRadius: 'var(--radius-sm)',
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <Download size={13} />
                        <span>Télécharger</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Espace disque & Gestion du cache audio */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Cache local des audios générés : <strong>{cacheStats.formattedSize}</strong> ({cacheStats.count} fichiers mémorisés)
            </div>

            <button
              onClick={handleClearCache}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Vider le cache audio
            </button>
          </div>
        </div>

        {/* Message d'aide si aucune voix neuronale Piper n'est encore installée */}
        {piperVoices.every((v) => !v.isDownloaded) && (
          <div
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Astuce pour une prononciation optimale :</strong>
              <br />
              Tant qu'aucune voix neuronale n'est téléchargée, ENflash joue gratuitement les enregistrements humains du dictionnaire pour chaque mot individuel, ou la meilleure voix anglaise naturelle de votre système.
              Sur Windows, vous pouvez aussi ajouter des voix anglaises naturelles gratuites via :{' '}
              <em>Paramètres Windows &gt; Heure et langue &gt; Voix &gt; Ajouter des voix</em>.
            </div>
          </div>
        )}

        {/* 2.5 Bruitages et effets sonores ludiques */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Effets sonores (bruitages ludiques)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Retournements de cartes, succès, erreurs et passages de niveau
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={(e) => updateSettings({ soundEffects: e.target.checked })}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Activer</span>
            </label>

            {settings.soundEffects && (
              <button
                onClick={handleTestSound}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                Tester le son
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. NOTIFICATIONS DE BUREAU */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Rappel quotidien de révision</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Notification de bureau de rappel</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Vous envoie un message motivant à heure fixe si votre test du jour n'est pas encore fait
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.dailyReminder}
              onChange={(e) => updateSettings({ dailyReminder: e.target.checked })}
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Activer le rappel</span>
          </label>
        </div>

        {settings.dailyReminder && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Heure du rappel quotidien :
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="time"
                value={settings.dailyReminderTime || '18:00'}
                onChange={(e) => updateSettings({ dailyReminderTime: e.target.value })}
                style={{ fontSize: '0.95rem', padding: '6px 12px' }}
              />
              <button
                onClick={handleTestNotification}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                Envoyer une notification test
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. SAUVEGARDE & RESTAURATION INTÉGRALE */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Sauvegarde des données</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Vos données sont stockées de façon sécurisée et hors ligne dans votre dossier utilisateur. Vous pouvez exporter une sauvegarde intégrale à tout moment.
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleExportBackup}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Download size={16} />
            <span>Exporter une sauvegarde (JSON)</span>
          </button>

          <button
            onClick={handleImportBackup}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Upload size={16} />
            <span>Restaurer une sauvegarde (JSON)</span>
          </button>
        </div>
      </div>

      {/* 5. MISES À JOUR & VERSION */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Mises à jour de l'application</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Version actuelle : <strong>v{appVersion}</strong>
            </p>
          </div>

          <button
            onClick={handleCheckUpdates}
            disabled={checkingUpdates}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow-glow)',
              cursor: checkingUpdates ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={16} className={checkingUpdates ? 'animate-spin' : ''} />
            <span>{checkingUpdates ? 'Vérification...' : 'Vérifier les mises à jour'}</span>
          </button>
        </div>

        {updateMessage && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}
          >
            {updateMessage}
          </div>
        )}
      </div>

      {/* 6. CRÉDITS ET LICENCES DES VOIX ET DONNÉES */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={20} color="var(--color-primary)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Crédits, sources et licences libres</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          ENflash privilégie exclusivement des technologies ouvertes, gratuites et respectueuses de vos données personnelles :
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <strong>Piper TTS :</strong> Moteur de synthèse neuronale locale ultra-rapide par Michael Hansen / Rhasspy (Licence MIT).
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <strong>Modèles vocaux neuronaux :</strong> Jeux de données Lessac, Ryan, Alba et Alan (Licences libres Domaine Public / ODbL / MIT).
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <strong>Prononciations humaines du dictionnaire :</strong> Free Dictionary API & contributeurs Wikimedia Commons (Licences Creative Commons BY-SA).
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <strong>Effets sonores :</strong> Synthèse procédurale originale temps réel via la Web Audio API (100% libre de droit).
          </div>
        </div>
      </div>
    </div>
  );
};
