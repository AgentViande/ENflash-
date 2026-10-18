import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Sun,
  Moon,
  Sparkles,
  CheckCircle2,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { UpdateInfo, AudioEngineStatus } from '../../../preload/types';
import { playSuccessSound } from '../utils/audio';
import { CentreIAScreen } from './CentreIAScreen';

interface ParametresScreenProps {
  onOpenUpdateModal: (info: UpdateInfo) => void;
}

export const ParametresScreen: React.FC<ParametresScreenProps> = ({ onOpenUpdateModal }) => {
  const {
    db,
    updateSettings,
    playSfx,
    refreshDatabase,
    sentenceQueueStats,
    generateMissingSentences,
    centreIaTab,
    openCentreIA,
    closeCentreIA,
  } = useApp();

  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [checkingUpdates, setCheckingUpdates] = useState<boolean>(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  // Statuts minimaux pour la carte compacte Centre IA
  const [kokoroStatus, setKokoroStatus] = useState<AudioEngineStatus | null>(null);
  const [isLlmInstalled, setIsLlmInstalled] = useState<boolean>(false);

  const loadAiOverviewStatus = useCallback(async () => {
    if (!db?.settings) return;
    try {
      if (window.api?.getKokoroStatus) {
        const kStatus = await window.api.getKokoroStatus({
          accent: db.settings.voiceAccent,
          preferredVoiceId: db.settings.preferredVoiceId,
        });
        setKokoroStatus(kStatus);
      }
      if (window.api?.getLlmStatus) {
        const [std, lgt] = await Promise.all([
          window.api.getLlmStatus('standard'),
          window.api.getLlmStatus('light'),
        ]);
        setIsLlmInstalled(!!std?.isInstalled || !!lgt?.isInstalled);
      }
    } catch {}
  }, [db?.settings]);

  useEffect(() => {
    if (window.api) {
      window.api.getAppVersion().then(setAppVersion);
    }
    loadAiOverviewStatus();
  }, [loadAiOverviewStatus]);

  if (!db) return null;

  // Si le Centre IA est ouvert, afficher l'écran dédié
  if (centreIaTab) {
    return <CentreIAScreen initialTab={centreIaTab} onBack={closeCentreIA} />;
  }

  const settings = db.settings;
  const missingWordsCount = db.words.filter((w) => !w.example || !w.example.trim()).length;
  const hasApiKey = !!(settings.aiApiKey && settings.aiApiKey.trim().length > 0);

  // Actions
  const handleTestNotification = async () => {
    if (window.api?.sendNotification) {
      await window.api.sendNotification({
        title: 'ENflash - Rappel de révision',
        body: 'C’est l’heure de votre session quotidienne de vocabulaire !',
      });
    }
  };

  const handleExportBackup = async () => {
    if (!window.api?.exportBackup) return;
    const res = await window.api.exportBackup();
    if (res.success) {
      setBackupMessage(`Sauvegarde exportée avec succès !`);
      setTimeout(() => setBackupMessage(null), 3500);
    }
  };

  const handleImportBackup = async () => {
    if (!window.api?.importBackup) return;
    const res = await window.api.importBackup();
    if (res.success) {
      await refreshDatabase();
      setBackupMessage('Sauvegarde restaurée avec succès !');
      setTimeout(() => setBackupMessage(null), 3500);
    }
  };

  const handleCheckUpdates = async () => {
    if (!window.api?.checkForUpdates) return;
    setCheckingUpdates(true);
    setUpdateMessage(null);
    try {
      const res = await window.api.checkForUpdates();
      if (res && res.available && res.info) {
        onOpenUpdateModal(res.info);
      } else {
        setUpdateMessage('Votre application ENflash est à jour !');
        setTimeout(() => setUpdateMessage(null), 3500);
      }
    } catch {
      setUpdateMessage('Impossible de vérifier les mises à jour.');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleGenerateMissing = async () => {
    try {
      const count = await generateMissingSentences();
      setBackupMessage(`${count} mot(s) ajouté(s) à la file de génération`);
      setTimeout(() => setBackupMessage(null), 3500);
    } catch (err) {
      console.error(err);
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
          Personnalisez votre confort d'apprentissage et vos préférences générales
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

      {/* 1. CARTE COMPACTE CENTRE IA */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.16))',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.08)',
        }}
      >
        <div style={{ maxWidth: '580px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain size={24} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Centre d'Intelligence Artificielle & Synthèse Vocale
            </h3>
          </div>
          <p style={{ margin: '6px 0 10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Gérez la voix neuronale Kokoro, les modèles locaux de phrases d'exemple, le cache et vos clés d'API.
          </p>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {`Voix naturelle : ${kokoroStatus?.isKokoroReady ? 'Kokoro prête ✅' : 'Voix système ⚠️'} • Phrases : ${isLlmInstalled ? 'Modèle local ✅' : 'Non installé'} • Clé API : ${hasApiKey ? 'Configurée ✅' : 'Non configurée'}`}
          </div>
        </div>

        <button
          onClick={() => openCentreIA('overview')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            padding: '12px 22px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-glow)',
            transition: 'transform 0.15s ease',
          }}
        >
          <Sparkles size={18} />
          <span>Ouvrir le Centre IA ➔</span>
        </button>
      </div>

      {/* 2. RÉSUMÉ MINIMAL : Compléter les mots sans phrase d'exemple */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
            Compléter les mots sans phrase d'exemple
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {missingWordsCount === 0
              ? 'Tous vos mots ont déjà une phrase d’exemple !'
              : `${missingWordsCount} mot(s) dans votre vocabulaire n'ont pas encore de phrase d’exemple.`}
          </div>
          {sentenceQueueStats && sentenceQueueStats.total > 0 && (
            <div style={{ marginTop: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>
                File de génération :{' '}
                <strong style={{ color: 'var(--color-primary)' }}>
                  {sentenceQueueStats.completed} / {sentenceQueueStats.total}
                </strong>
                {sentenceQueueStats.failed > 0 && (
                  <span style={{ color: '#ef4444', marginLeft: '6px' }}>({sentenceQueueStats.failed} échecs)</span>
                )}
              </span>
              <button
                onClick={() => openCentreIA('queue')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '0.8rem',
                }}
              >
                Gérer la file détaillée ➔
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleGenerateMissing}
          disabled={missingWordsCount === 0 || sentenceQueueStats?.isProcessing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: missingWordsCount > 0 ? 'var(--color-primary)' : 'var(--bg-secondary)',
            color: missingWordsCount > 0 ? '#fff' : 'var(--text-muted)',
            border: missingWordsCount > 0 ? 'none' : '1px solid var(--border-subtle)',
            padding: '9px 18px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: missingWordsCount > 0 && !sentenceQueueStats?.isProcessing ? 'pointer' : 'not-allowed',
          }}
        >
          <Sparkles size={14} />
          <span>Générer les phrases manquantes</span>
        </button>
      </div>

      {/* 3. APPARENCE ET THÈME */}
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
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
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
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              <Sun size={16} />
              <span>Clair</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. BRUITAGES ET EFFETS SONORES LUDIQUES */}
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
                style={{ accentColor: 'var(--color-primary)', width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Activer</span>
            </label>

            {settings.soundEffects && (
              <button
                onClick={() => playSuccessSound(settings.soundVolume ?? 0.6)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Tester le son
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. NOTIFICATIONS DE BUREAU */}
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
              style={{ accentColor: 'var(--color-primary)', width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Activer</span>
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
                  cursor: 'pointer',
                }}
              >
                Envoyer une notification test
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. SAUVEGARDE & RESTAURATION INTÉGRALE */}
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
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
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
              cursor: 'pointer',
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
              cursor: 'pointer',
            }}
          >
            <Upload size={16} />
            <span>Restaurer une sauvegarde (JSON)</span>
          </button>
        </div>
      </div>

      {/* 7. MISES À JOUR & VERSION */}
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

      {/* 8. CRÉDITS ET LICENCES DES VOIX ET DONNÉES */}
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
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          ENflash privilégie exclusivement des technologies ouvertes, gratuites et respectueuses de vos données personnelles. Retrouvez le détail complet des flux réseau et des licences dans le Centre IA.
        </p>
      </div>
    </div>
  );
};
