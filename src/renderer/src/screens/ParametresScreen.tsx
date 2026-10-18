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
  Wrench,
  Headphones,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { VoiceAccent, ThemeMode, AudioEngineStatus } from '../../../shared/types';
import { AVAILABLE_KOKORO_VOICES, getDefaultVoiceForAccent } from '../../../shared/audio/kokoroVoices';
import { speakWord, speakText, runVoiceComparison } from '../utils/audio';
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

  // Moteur neuronal Kokoro & Cache
  const [kokoroStatus, setKokoroStatus] = useState<AudioEngineStatus | null>(null);
  const [isInstallingKokoro, setIsInstallingKokoro] = useState<boolean>(false);
  const [kokoroProgress, setKokoroProgress] = useState<{ progress: number; label: string }>({
    progress: 0,
    label: '',
  });
  const [comparisonPhase, setComparisonPhase] = useState<'idle' | 'kokoro' | 'gap' | 'system' | 'done'>('idle');
  const [cacheStats, setCacheStats] = useState<{ count: number; formattedSize: string }>({
    count: 0,
    formattedSize: '0 Mo',
  });

  const loadVoicesAndCache = useCallback(async () => {
    if (window.api?.getKokoroStatus && db?.settings) {
      try {
        const status = await window.api.getKokoroStatus({
          accent: db.settings.voiceAccent,
          preferredVoiceId: db.settings.preferredVoiceId,
        });
        setKokoroStatus(status);
      } catch {}
    }
    if (window.api?.getCacheStats) {
      try {
        const stats = await window.api.getCacheStats();
        setCacheStats({ count: stats.count, formattedSize: stats.formattedSize });
      } catch {}
    }
  }, [db?.settings]);

  useEffect(() => {
    if (window.api) {
      window.api.getAppVersion().then(setAppVersion);
      loadVoicesAndCache();

      const unsubscribe = window.api.onKokoroProgress?.((data) => {
        setKokoroProgress(data);
        if (data.progress >= 100) {
          setIsInstallingKokoro(false);
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

  // Réinstaller ou réparer le modèle Kokoro
  const handleRepairOrInstallKokoro = async () => {
    if (!window.api?.installKokoro) return;
    setIsInstallingKokoro(true);
    setKokoroProgress({ progress: 5, label: 'Préparation du téléchargement...' });
    try {
      const res = await window.api.installKokoro();
      if (res.success) {
        await loadVoicesAndCache();
        setBackupMessage('Modèle neuronal Kokoro-82M installé et prêt !');
        setTimeout(() => setBackupMessage(null), 3500);
      } else if (res.error) {
        alert('Erreur lors de l’installation : ' + res.error);
      }
    } catch (err: any) {
      alert('Erreur : ' + err.message);
    } finally {
      setIsInstallingKokoro(false);
    }
  };

  // Comparaison audio Kokoro vs Voix Système
  const handleRunComparison = async () => {
    if (comparisonPhase !== 'idle' && comparisonPhase !== 'done') return;
    try {
      await runVoiceComparison(
        settings.voiceAccent,
        settings.preferredVoiceId,
        (phase) => setComparisonPhase(phase)
      );
    } catch (err) {
      setComparisonPhase('idle');
    }
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

      {/* 2. AUDIO & MOTEUR NEURONAL KOKORO */}
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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Synthèse vocale neuronale & Prononciation 🎙️</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Cascade : Cache local ➔ Voix naturelle Kokoro-82M (Hors ligne) ➔ Dictionnaire humain ➔ Voix de secours
            </p>
          </div>
        </div>

        {/* 2.0 Statut de transparence du moteur (Kokoro vs Voix de secours) */}
        <div
          style={{
            backgroundColor: kokoroStatus?.isKokoroReady
              ? 'rgba(16, 185, 129, 0.08)'
              : 'rgba(245, 158, 11, 0.12)',
            border: kokoroStatus?.isKokoroReady
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {kokoroStatus?.isKokoroReady ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#10b981',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  <Check size={14} />
                  <span>Voix naturelle Kokoro ✅</span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#f59e0b',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>Voix de secours ⚠️</span>
                </div>
              )}

              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {kokoroStatus?.isKokoroReady
                  ? 'Moteur neuronal actif (modèle 82M quantifié q8 opérationnel 100% hors ligne)'
                  : 'Qualité réduite : modèle neuronal non prêt, bascule automatique sur la synthèse Windows'}
              </span>
            </div>

            <button
              onClick={handleRepairOrInstallKokoro}
              disabled={isInstallingKokoro}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: isInstallingKokoro ? 'not-allowed' : 'pointer',
              }}
            >
              <Wrench size={14} color="var(--color-primary)" />
              <span>{isInstallingKokoro ? 'Installation en cours...' : 'Réparer / réinstaller la voix'}</span>
            </button>
          </div>

          {/* Barre de progression pendant l'installation ou réparation */}
          {isInstallingKokoro && (
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                <span>{kokoroProgress.label || 'Téléchargement du modèle Kokoro-82M...'}</span>
                <strong>{kokoroProgress.progress}%</strong>
              </div>
              <div
                style={{
                  height: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${kokoroProgress.progress}%`,
                    height: '100%',
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: '4px',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 2.1 Accent d'apprentissage & Voix par défaut */}
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

        {/* 2.2 Choix de la voix Kokoro */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Voix neuronale naturelle</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Personnalisez la voix Kokoro (féminines & masculines disponibles)
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={settings.preferredVoiceId || 'auto'}
              onChange={(e) => updateSettings({ preferredVoiceId: e.target.value })}
              style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '220px' }}
            >
              <option value="auto">
                Automatique ({settings.voiceAccent === 'en-GB' ? 'Emma - UK ⭐⭐⭐' : 'Heart - US ⭐⭐⭐'})
              </option>
              <optgroup label="🇺🇸 Voix américaines (US)">
                {AVAILABLE_KOKORO_VOICES.filter((v) => v.accent === 'en-US').map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🇬🇧 Voix britanniques (UK)">
                {AVAILABLE_KOKORO_VOICES.filter((v) => v.accent === 'en-GB').map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
            </select>

            <button
              onClick={() => handleTestVoiceSample(settings.preferredVoiceId || '', settings.voiceAccent)}
              title="Écouter un exemple de la voix sélectionnée"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                fontSize: '0.8rem',
              }}
            >
              <Play size={14} fill="currentColor" />
              <span>Exemple</span>
            </button>
          </div>
        </div>

        {/* 2.3 Vitesse de prononciation normale */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Vitesse de prononciation :{' '}
              <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                {(settings.voiceSpeed || 1.0).toFixed(1)}x
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Ajustez l'élocution (un bouton ralenti "0.7x" est aussi accessible sur chaque carte)
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

        {/* 2.4 Lecture automatique */}
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

        {/* 2.5 OUTIL DE COMPARAISON : Kokoro vs Voix Système */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Headphones size={18} color="var(--color-primary)" />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                  Test comparatif : Kokoro vs Voix Système (SAPI)
                </h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Écoutez la même phrase successivement avec le moteur neuronal puis avec la voix robotique Windows pour entendre le saut qualitatif.
              </p>
            </div>

            <button
              onClick={handleRunComparison}
              disabled={comparisonPhase !== 'idle' && comparisonPhase !== 'done'}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: 'var(--shadow-glow)',
                cursor: (comparisonPhase !== 'idle' && comparisonPhase !== 'done') ? 'not-allowed' : 'pointer',
              }}
            >
              <Play size={14} fill="currentColor" />
              <span>
                {comparisonPhase === 'idle' || comparisonPhase === 'done'
                  ? 'Lancer le test comparatif'
                  : 'Comparaison en cours...'}
              </span>
            </button>
          </div>

          {/* État de la comparaison en temps réel */}
          {comparisonPhase !== 'idle' && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {comparisonPhase === 'kokoro' && (
                <>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>🔊 Étape 1/2 :</span>
                  <span>Lecture avec la voix naturelle Kokoro-82M (modèle neuronal local)...</span>
                </>
              )}
              {comparisonPhase === 'gap' && (
                <>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>⏸️ Pause (1s)...</span>
                  <span>Passage à la voix système...</span>
                </>
              )}
              {comparisonPhase === 'system' && (
                <>
                  <span style={{ color: '#f59e0b', fontWeight: 800 }}>🤖 Étape 2/2 :</span>
                  <span>Lecture avec la voix système Windows (SAPI)...</span>
                </>
              )}
              {comparisonPhase === 'done' && (
                <>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✅ Test terminé !</span>
                  <span>La voix Kokoro est bien plus fluide et humaine.</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* 2.6 Cache audio & Espace disque */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '6px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Espace utilisé par les audios en cache : <strong>{cacheStats.formattedSize}</strong> ({cacheStats.count} fichiers mémorisés pour relecture instantanée)
          </div>

          <button
            onClick={handleClearCache}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            Vider le cache audio
          </button>
        </div>

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
            <strong>Kokoro-82M :</strong> Moteur de synthèse vocale neuronale locale ultra-naturelle par hexgrad (Licence Apache 2.0).
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <strong>Phonemizer & Transformers.js :</strong> Phonémisation et inférence ONNX Runtime Web/Node par Xenova (Licences Apache 2.0 / MIT).
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
