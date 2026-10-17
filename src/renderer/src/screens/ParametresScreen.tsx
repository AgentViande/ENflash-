import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { VoiceAccent, ThemeMode } from '../../../shared/types';
import { speakWord } from '../utils/audio';
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

  useEffect(() => {
    if (window.api) {
      window.api.getAppVersion().then(setAppVersion);
    }
  }, []);

  if (!db) return null;
  const { settings } = db;

  // Test de prononciation vocale
  const handleTestVoice = (accent: VoiceAccent) => {
    speakWord('Hello! Welcome to ENflash, your English flashcards application.', accent);
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

      {/* 2. AUDIO & VOIX */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Audio & Synthèse vocale</h3>

        {/* Accent vocal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Accent anglais de prononciation</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Utilisé par la synthèse vocale pour prononcer les mots et exemples
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={settings.voiceAccent}
              onChange={(e) => updateSettings({ voiceAccent: e.target.value as VoiceAccent })}
              style={{ fontSize: '0.9rem' }}
            >
              <option value="en-US">Anglais américain (US)</option>
              <option value="en-GB">Anglais britannique (UK)</option>
            </select>
            <button
              onClick={() => handleTestVoice(settings.voiceAccent)}
              title="Tester la voix"
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

        {/* Effets sonores du jeu */}
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
    </div>
  );
};
