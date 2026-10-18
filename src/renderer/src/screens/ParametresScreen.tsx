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
  FolderOpen,
  AlertTriangle,
  Cpu,
  Zap,
  Brain,
  Bot,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Key,
  Pause,
  HardDrive,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  VoiceAccent,
  ThemeMode,
  AudioEngineStatus,
  LocalLlmStatus,
  SystemHardwareInfo,
  SpeedTestResult,
  LocalLlmModelType,
  ExampleSourceType,
} from '../../../shared/types';
import { AVAILABLE_KOKORO_VOICES, getDefaultVoiceForAccent } from '../../../shared/audio/kokoroVoices';
import { speakWord, speakText, runVoiceComparison, stopAllAudio } from '../utils/audio';
import { UpdateInfo } from '../../../preload/types';

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
  } = useApp();

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
  const [voiceTestingId, setVoiceTestingId] = useState<string | null>(null);
  const [voiceErrorMap, setVoiceErrorMap] = useState<Record<string, string>>({});
  const [voiceSuccessMap, setVoiceSuccessMap] = useState<Record<string, boolean>>({});

  // Modèle local LLM & Phrases d'exemple
  const [llmStatusStandard, setLlmStatusStandard] = useState<LocalLlmStatus | null>(null);
  const [llmStatusLight, setLlmStatusLight] = useState<LocalLlmStatus | null>(null);
  const [hardwareInfo, setHardwareInfo] = useState<SystemHardwareInfo | null>(null);
  const [isDownloadingLlm, setIsDownloadingLlm] = useState<boolean>(false);
  const [downloadLlmProgress, setDownloadLlmProgress] = useState<{
    modelType: LocalLlmModelType;
    progress: number;
    loadedBytes: number;
    totalBytes: number;
    speedFormatted?: string;
  } | null>(null);
  const [speedTestResult, setSpeedTestResult] = useState<SpeedTestResult | null>(null);
  const [isTestingSpeed, setIsTestingSpeed] = useState<boolean>(false);
  const [speedTestError, setSpeedTestError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isGeneratingMissing, setIsGeneratingMissing] = useState<boolean>(false);

  // Modale de suppression et régénération du cache
  const [isClearCacheModalOpen, setIsClearCacheModalOpen] = useState<boolean>(false);
  const [regenerateAfterClear, setRegenerateAfterClear] = useState<boolean>(true);
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [preloadProgress, setPreloadProgress] = useState<{
    isPreloading: boolean;
    completed: number;
    total: number;
    currentText?: string;
  }>({
    isPreloading: false,
    completed: 0,
    total: 0,
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

  const loadLlmStatus = useCallback(async () => {
    if (window.api?.getLlmStatus) {
      try {
        const [std, lgt] = await Promise.all([
          window.api.getLlmStatus('standard'),
          window.api.getLlmStatus('light'),
        ]);
        setLlmStatusStandard(std);
        setLlmStatusLight(lgt);
      } catch (err) {
        console.error('Erreur getLlmStatus:', err);
      }
    }
    if (window.api?.getHardwareInfo) {
      try {
        const hw = await window.api.getHardwareInfo();
        setHardwareInfo(hw);
      } catch (err) {
        console.error('Erreur getHardwareInfo:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (window.api) {
      window.api.getAppVersion().then(setAppVersion);
      loadVoicesAndCache();
      loadLlmStatus();

      const unsubscribe = window.api.onKokoroProgress?.((data) => {
        setKokoroProgress(data);
        if (data.progress >= 100) {
          setIsInstallingKokoro(false);
          loadVoicesAndCache();
        }
      });

      const unsubPreload = window.api.onPreloadProgress?.((data) => {
        setPreloadProgress(data);
        if (!data.isPreloading) {
          loadVoicesAndCache();
        }
      });

      const unsubLlm = window.api.onLlmDownloadProgress?.((data) => {
        setDownloadLlmProgress(data);
        if (data.progress >= 100) {
          setIsDownloadingLlm(false);
          loadLlmStatus();
        }
      });

      return () => {
        if (unsubscribe) unsubscribe();
        if (unsubPreload) unsubPreload();
        if (unsubLlm) unsubLlm();
      };
    }
  }, [loadVoicesAndCache, loadLlmStatus]);

  if (!db) return null;
  const { settings } = db;

  // Test d'une voix spécifique (échantillon court, net et rapide à synthétiser)
  const handleTestVoiceSample = async (voiceId: string, accent: VoiceAccent) => {
    if (voiceTestingId) return;
    setVoiceTestingId(voiceId);
    setVoiceErrorMap((prev) => {
      const copy = { ...prev };
      delete copy[voiceId];
      return copy;
    });

    try {
      await speakText('Welcome to ENflash.', {
        accent,
        preferredVoiceId: voiceId,
        speed: settings.voiceSpeed || 1.0,
        volume: settings.voiceVolume ?? 0.8,
      });
      setVoiceSuccessMap((prev) => ({ ...prev, [voiceId]: true }));
      await loadVoicesAndCache();
    } catch (err: any) {
      console.error(`[Parametres] Erreur synthèse voix ${voiceId}:`, err);
      setVoiceErrorMap((prev) => ({
        ...prev,
        [voiceId]: err?.message || 'Erreur lors de la génération audio',
      }));
    } finally {
      setVoiceTestingId(null);
    }
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

  // Ouvrir le dossier du cache dans l'explorateur de fichiers
  const handleOpenCacheFolder = async () => {
    if (!window.api?.openCacheFolder) return;
    try {
      const res = await window.api.openCacheFolder();
      if (!res.success && res.error) {
        alert('Impossible d’ouvrir le dossier du cache : ' + res.error);
      }
    } catch (err: any) {
      alert('Erreur lors de l’ouverture du dossier : ' + err.message);
    }
  };

  // Annuler la génération anticipée en arrière-plan
  const handleCancelPreload = async () => {
    if (window.api?.cancelPreload) {
      await window.api.cancelPreload();
      setPreloadProgress((prev) => ({ ...prev, isPreloading: false }));
    }
  };

  // Suppression atomique et complète du cache audio avec gestion d'erreurs Windows
  const handleConfirmClearCache = async () => {
    if (!window.api?.clearCache) return;
    setIsClearingCache(true);
    try {
      // 1. Arrêter immédiatement toute lecture audio en cours
      stopAllAudio();

      // 2. Supprimer les fichiers audio et l'index du cache
      const res = await window.api.clearCache();

      // 3. Mise à jour immédiate du compteur à 0
      setCacheStats({ count: 0, formattedSize: '0 Ko' });
      setIsClearCacheModalOpen(false);

      if (res.success) {
        setBackupMessage(`Cache supprimé : ${res.freedFormatted} libérés (${res.deletedCount} audios)`);
        setTimeout(() => setBackupMessage(null), 4000);
      }

      if (res.failedFiles && res.failedFiles.length > 0) {
        alert(
          `Certains fichiers n'ont pas pu être supprimés immédiatement (fichiers verrouillés par Windows) :\n` +
            res.failedFiles.slice(0, 5).join('\n') +
            (res.failedFiles.length > 5 ? `\n... et ${res.failedFiles.length - 5} autres` : '')
        );
      }

      // 4. Relancer la génération anticipée en arrière-plan si la case est cochée
      if (regenerateAfterClear && window.api?.preloadWords && db.words.length > 0) {
        const itemsToPreload = db.words.flatMap((w) => [
          {
            text: w.english,
            accent: settings.voiceAccent,
            preferredVoiceId: settings.preferredVoiceId,
            speed: settings.voiceSpeed || 1.0,
          },
          ...(w.example
            ? [
                {
                  text: w.example,
                  accent: settings.voiceAccent,
                  preferredVoiceId: settings.preferredVoiceId,
                  speed: settings.voiceSpeed || 1.0,
                },
              ]
            : []),
        ]);
        await window.api.preloadWords(itemsToPreload);
      }

      await loadVoicesAndCache();
    } catch (err: any) {
      console.error('Erreur suppression cache:', err);
      alert('Erreur lors de la suppression du cache : ' + err.message);
    } finally {
      setIsClearingCache(false);
    }
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

  // Handlers pour le modèle local LLM et les phrases d'exemple
  const handleDownloadModel = async (modelType: LocalLlmModelType) => {
    if (!window.api?.downloadLlmModel || isDownloadingLlm) return;
    setIsDownloadingLlm(true);
    setDownloadLlmProgress({
      modelType,
      progress: 0,
      loadedBytes: 0,
      totalBytes: modelType === 'standard' ? 1118000000 : 491000000,
      speedFormatted: 'Démarrage...',
    });
    try {
      const res = await window.api.downloadLlmModel(modelType);
      if (res.success) {
        await updateSettings({ localLlmModel: modelType, localLlmEnabled: true });
        setBackupMessage(
          `Modèle ${modelType === 'standard' ? 'Standard (1.5B)' : 'Léger (0.5B)'} installé et activé !`
        );
        setTimeout(() => setBackupMessage(null), 3500);
      } else if (res.error) {
        alert('Erreur lors du téléchargement : ' + res.error);
      }
      await loadLlmStatus();
    } catch (err: any) {
      alert('Erreur : ' + err.message);
    } finally {
      setIsDownloadingLlm(false);
      setDownloadLlmProgress(null);
    }
  };

  const handleCancelLlmDownload = async () => {
    if (window.api?.cancelLlmDownload) {
      await window.api.cancelLlmDownload();
      setIsDownloadingLlm(false);
      setDownloadLlmProgress(null);
      await loadLlmStatus();
    }
  };

  const handleDeleteModel = async (modelType: LocalLlmModelType) => {
    if (!window.api?.deleteLlmModel) return;
    const modelName = modelType === 'standard' ? 'Standard (Qwen2.5-1.5B)' : 'Léger (Qwen2.5-0.5B)';
    if (!window.confirm(`Supprimer le modèle local ${modelName} du disque ? Vous pourrez le retélécharger à tout moment.`)) {
      return;
    }
    try {
      const ok = await window.api.deleteLlmModel(modelType);
      if (ok) {
        setBackupMessage(`Modèle ${modelName} supprimé`);
        setTimeout(() => setBackupMessage(null), 3000);
        await loadLlmStatus();
      }
    } catch (err: any) {
      alert('Erreur suppression modèle : ' + err.message);
    }
  };

  const handleRunSpeedTest = async () => {
    if (!window.api?.testLlmSpeed || isTestingSpeed) return;
    setIsTestingSpeed(true);
    setSpeedTestError(null);
    try {
      const currentModel = settings.localLlmModel || 'standard';
      const res = await window.api.testLlmSpeed(currentModel);
      setSpeedTestResult(res);
    } catch (err: any) {
      setSpeedTestError(err.message || 'Erreur lors du test de vitesse');
    } finally {
      setIsTestingSpeed(false);
    }
  };

  const handleGenerateMissing = async () => {
    if (isGeneratingMissing) return;
    setIsGeneratingMissing(true);
    try {
      const count = await generateMissingSentences();
      setBackupMessage(`${count} mots sans exemple ajoutés à la file de génération`);
      setTimeout(() => setBackupMessage(null), 4000);
    } catch (err: any) {
      alert('Erreur lors du lancement : ' + err.message);
    } finally {
      setIsGeneratingMissing(false);
    }
  };

  const handlePauseResumeQueue = async () => {
    if (!window.api) return;
    if (sentenceQueueStats?.isPaused) {
      await window.api.resumeSentenceQueue();
    } else {
      await window.api.pauseSentenceQueue();
    }
  };

  const handleCancelQueue = async () => {
    if (!window.api?.cancelSentenceQueue) return;
    await window.api.cancelSentenceQueue();
  };

  const handleMoveCascade = (fromIndex: number, direction: 'up' | 'down') => {
    const current = [...(settings.exampleCascadeOrder || ['user', 'dictionary', 'local_llm', 'api'])];
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 1 || toIndex >= current.length) return;
    const temp = current[fromIndex];
    current[fromIndex] = current[toIndex];
    current[toIndex] = temp;
    updateSettings({ exampleCascadeOrder: current });
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

        {/* 2.1 Accent d'apprentissage */}
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
              style={{ fontSize: '0.9rem', fontWeight: 600, padding: '8px 12px', borderRadius: 'var(--radius-md)' }}
            >
              <option value="en-US">🇺🇸 Anglais américain (US)</option>
              <option value="en-GB">🇬🇧 Anglais britannique (UK)</option>
            </select>

            <button
              onClick={() => handleTestVoiceSample(settings.preferredVoiceId || '', settings.voiceAccent)}
              disabled={voiceTestingId !== null}
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
                cursor: voiceTestingId !== null ? 'not-allowed' : 'pointer',
              }}
            >
              <Volume2 size={16} />
              <span>{voiceTestingId ? 'Génération...' : 'Tester'}</span>
            </button>
          </div>
        </div>

        {/* 2.2 Curseur de volume de lecture audio */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Volume de lecture audio :{' '}
              <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                {Math.round((settings.voiceVolume ?? 0.8) * 100)}%
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Niveau sonore de prononciation (défaut 80%, plafonné à 100% avec marge de sécurité anti-saturation)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>10%</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={settings.voiceVolume ?? 0.8}
              onChange={(e) => updateSettings({ voiceVolume: parseFloat(e.target.value) })}
              style={{ width: '140px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>100%</span>
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
              Ajustez l'élocution (un bouton ralenti "0.7x" reste accessible sur chaque flashcard)
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
              style={{ width: '140px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1.2x</span>
          </div>
        </div>

        {/* 2.4 Liste dynamique des voix neuronales disponibles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Voix neuronales Kokoro disponibles ({AVAILABLE_KOKORO_VOICES.length} voix vérifiées)
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Chaque voix dispose de son propre modèle acoustique local, d'un bouton d'écoute instantané et d'un indicateur d'état.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => updateSettings({ preferredVoiceId: 'auto' })}
                style={{
                  backgroundColor: (!settings.preferredVoiceId || settings.preferredVoiceId === 'auto')
                    ? 'var(--color-primary)'
                    : 'var(--bg-secondary)',
                  color: (!settings.preferredVoiceId || settings.preferredVoiceId === 'auto')
                    ? '#fff'
                    : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Auto ({settings.voiceAccent === 'en-GB' ? 'Emma 🇬🇧' : 'Heart 🇺🇸'})
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            {AVAILABLE_KOKORO_VOICES.map((voice) => {
              const isSelected =
                (settings.preferredVoiceId === voice.id) ||
                ((!settings.preferredVoiceId || settings.preferredVoiceId === 'auto') &&
                  getDefaultVoiceForAccent(settings.voiceAccent) === voice.id);
              const isTesting = voiceTestingId === voice.id;
              const hasError = Boolean(voiceErrorMap[voice.id]);
              const hasSuccess = Boolean(voiceSuccessMap[voice.id]);

              return (
                <div
                  key={voice.id}
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-secondary)' : 'var(--bg-card)',
                    border: `1.5px solid ${
                      isSelected
                        ? 'var(--color-primary)'
                        : hasError
                        ? 'var(--color-danger, #ef4444)'
                        : 'var(--border-subtle)'
                    }`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: isSelected ? '0 0 0 1px var(--color-primary)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {voice.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {voice.accent === 'en-GB' ? '🇬🇧 UK' : '🇺🇸 US'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: voice.gender === 'female' ? '#f43f5e22' : '#3b82f622',
                            color: voice.gender === 'female' ? '#f43f5e' : '#3b82f6',
                          }}
                        >
                          {voice.gender === 'female' ? 'Féminin ♀' : 'Masculin ♂'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {voice.description}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: 'var(--color-warning, #f59e0b)',
                      }}
                    >
                      {voice.grade}
                    </span>
                  </div>

                  {/* État / message d'erreur si la voix a échoué */}
                  {hasError && (
                    <div
                      style={{
                        backgroundColor: '#ef444415',
                        border: '1px solid #ef444455',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <AlertCircle size={14} />
                      <span>{voiceErrorMap[voice.id]}</span>
                    </div>
                  )}

                  {/* Statut OK */}
                  {!hasError && hasSuccess && (
                    <div
                      style={{
                        backgroundColor: '#10b98115',
                        border: '1px solid #10b98155',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 700,
                      }}
                    >
                      <Check size={13} />
                      <span>Audio vérifié et net</span>
                    </div>
                  )}

                  {/* Boutons d'action : Écouter un exemple + Sélectionner */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <button
                      onClick={() => handleTestVoiceSample(voice.id, voice.accent)}
                      disabled={isTesting || voiceTestingId !== null}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: (isTesting || voiceTestingId !== null) ? 'not-allowed' : 'pointer',
                        opacity: (voiceTestingId !== null && !isTesting) ? 0.6 : 1,
                      }}
                    >
                      <Play size={13} fill="currentColor" />
                      <span>{isTesting ? 'Génération...' : 'Écouter'}</span>
                    </button>

                    <button
                      onClick={() => updateSettings({ preferredVoiceId: voice.id })}
                      style={{
                        backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isSelected ? <Check size={14} /> : null}
                      <span>{isSelected ? 'Active' : 'Choisir'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2.5 Lecture automatique */}
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

        {/* 2.6 OUTIL DE COMPARAISON : Kokoro vs Voix Système */}
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

        {/* 2.7 Cache audio persistant (v2) & Espace disque */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Cache audio persistant :{' '}
                <span style={{ color: 'var(--color-primary)' }}>
                  {cacheStats.count} audios • {cacheStats.formattedSize}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Audios conservés sur disque (userData) avec index JSON instantané pour une écoute sans aucune latence.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={handleOpenCacheFolder}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Ouvrir le dossier du cache dans l'explorateur Windows"
              >
                <FolderOpen size={15} />
                <span>Ouvrir le dossier du cache</span>
              </button>

              <button
                onClick={() => setIsClearCacheModalOpen(true)}
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--color-danger, #ef4444)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Trash2 size={15} />
                <span>Supprimer le cache audio</span>
              </button>
            </div>
          </div>

          {/* Indicateur de génération anticipée en arrière-plan */}
          {preloadProgress.isPreloading && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                  <RefreshCw size={14} className="animate-spin" color="var(--color-primary)" />
                  <span>
                    Génération en arrière-plan :{' '}
                    <strong style={{ color: 'var(--color-primary)' }}>
                      {preloadProgress.completed} / {preloadProgress.total} audios prêts
                    </strong>
                    {preloadProgress.currentText && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                        {' '}(« {preloadProgress.currentText.slice(0, 24)}{preloadProgress.currentText.length > 24 ? '...' : ''} »)
                      </span>
                    )}
                  </span>
                </div>

                <button
                  onClick={handleCancelPreload}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Arrêter
                </button>
              </div>

              <div
                style={{
                  height: '6px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round((preloadProgress.completed / Math.max(preloadProgress.total, 1)) * 100)}%`,
                    height: '100%',
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: '3px',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}
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

      {/* 3. PHRASES D'EXEMPLE & MODÈLE LOCAL (HORS LIGNE) 🧠 */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain size={22} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              Phrases d'exemple & IA locale (Hors ligne)
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
            Générez automatiquement des phrases d'exemple contextuelles, courtes et naturelles pour chaque mot de votre vocabulaire (y compris l'aéronautique et les termes techniques), sans compte et sans connexion Internet requise.
          </p>
        </div>

        {/* 3.1 Diagnostic matériel & recommandation */}
        {hardwareInfo && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: `1px solid ${
                hardwareInfo.ramTier === 'optimal' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'
              }`,
              borderRadius: 'var(--radius-lg)',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
                <Cpu size={18} color="var(--color-primary)" />
                <span>Diagnostic matériel de votre ordinateur</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>CPU : <strong>{hardwareInfo.cpuModel}</strong> ({hardwareInfo.cpuCores} cœurs)</span>
                <span>•</span>
                <span>RAM : <strong>{hardwareInfo.totalRamGB} Go</strong> (libre : {hardwareInfo.freeRamGB} Go)</span>
              </div>
            </div>

            <div
              style={{
                fontSize: '0.82rem',
                color: hardwareInfo.ramTier === 'optimal' ? '#10b981' : '#f59e0b',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                lineHeight: 1.45,
              }}
            >
              {hardwareInfo.ramTier === 'optimal' ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
              <span>{hardwareInfo.recommendation}</span>
            </div>
          </div>
        )}

        {/* 3.2 Interrupteur général de l'IA locale */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '4px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Activer le modèle de langage local pour les phrases
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Utilise le modèle local sur votre processeur lorsque le dictionnaire en ligne ne contient pas d'exemple ou en mode hors ligne
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.localLlmEnabled !== false}
              onChange={(e) => updateSettings({ localLlmEnabled: e.target.checked })}
              style={{ accentColor: 'var(--color-primary)', width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              {settings.localLlmEnabled !== false ? 'Activé' : 'Désactivé'}
            </span>
          </label>
        </div>

        {/* 3.3 Choix du modèle et téléchargement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            Modèle d'IA local embarqué (Qwen2.5-Instruct, Apache 2.0)
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '14px',
            }}
          >
            {/* CARTE MODÈLE STANDARD (1.5B) */}
            {(() => {
              const isSelected = (settings.localLlmModel || 'standard') === 'standard';
              const isInstalled = !!llmStatusStandard?.isInstalled;
              const isDownloadingThis = isDownloadingLlm && downloadLlmProgress?.modelType === 'standard';

              return (
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative',
                    boxShadow: isSelected ? '0 0 16px rgba(99, 102, 241, 0.15)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                          Standard : Qwen2.5-1.5B
                        </h4>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--color-primary)',
                          }}
                        >
                          ⭐ Recommandé
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Inférence CPU q4_k_m • Taille : ~1.04 Go • RAM requise : ~1.4 Go
                      </p>
                    </div>

                    {isInstalled ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#10b981',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Check size={12} /> Prêt
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Non installé
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    Excellente richesse de vocabulaire, formulations idiomatiques parfaites et compréhension fine des termes techniques d'aéronautique.
                  </p>

                  {/* Barre de progression si téléchargement en cours */}
                  {isDownloadingThis && downloadLlmProgress && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                        <span>Téléchargement ({downloadLlmProgress.progress}%)</span>
                        <span>{downloadLlmProgress.speedFormatted || ''}</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${downloadLlmProgress.progress}%`,
                            height: '100%',
                            backgroundColor: 'var(--color-primary)',
                            borderRadius: '3px',
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                        <button
                          onClick={handleCancelLlmDownload}
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-danger, #ef4444)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 6px',
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Boutons d'action */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', alignItems: 'center' }}>
                    {!isInstalled ? (
                      <button
                        onClick={() => handleDownloadModel('standard')}
                        disabled={isDownloadingLlm}
                        style={{
                          flex: 1,
                          backgroundColor: 'var(--color-primary)',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 14px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: isDownloadingLlm ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Download size={14} />
                        <span>Télécharger (1.04 Go)</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => updateSettings({ localLlmModel: 'standard' })}
                          style={{
                            flex: 1,
                            backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--bg-card)',
                            color: isSelected ? '#fff' : 'var(--text-primary)',
                            border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                            padding: '8px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          {isSelected ? <Check size={14} /> : null}
                          <span>{isSelected ? 'Modèle actif' : 'Activer ce modèle'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteModel('standard')}
                          title="Supprimer le fichier du modèle pour libérer l'espace disque"
                          style={{
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* CARTE MODÈLE LÉGER (0.5B) */}
            {(() => {
              const isSelected = (settings.localLlmModel || 'standard') === 'light';
              const isInstalled = !!llmStatusLight?.isInstalled;
              const isDownloadingThis = isDownloadingLlm && downloadLlmProgress?.modelType === 'light';

              return (
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative',
                    boxShadow: isSelected ? '0 0 16px rgba(99, 102, 241, 0.15)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                          Léger : Qwen2.5-0.5B
                        </h4>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                          }}
                        >
                          ⚡ Ultra-rapide
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Inférence CPU q4_k_m • Taille : ~468 Mo • RAM requise : ~700 Mo
                      </p>
                    </div>

                    {isInstalled ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#10b981',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Check size={12} /> Prêt
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Non installé
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    Conçu pour les configurations modestes ou avec moins de 4 Go de RAM. Génération ultra-rapide et phrases courtes et directes.
                  </p>

                  {/* Barre de progression si téléchargement en cours */}
                  {isDownloadingThis && downloadLlmProgress && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                        <span>Téléchargement ({downloadLlmProgress.progress}%)</span>
                        <span>{downloadLlmProgress.speedFormatted || ''}</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${downloadLlmProgress.progress}%`,
                            height: '100%',
                            backgroundColor: 'var(--color-primary)',
                            borderRadius: '3px',
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                        <button
                          onClick={handleCancelLlmDownload}
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-danger, #ef4444)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 6px',
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Boutons d'action */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', alignItems: 'center' }}>
                    {!isInstalled ? (
                      <button
                        onClick={() => handleDownloadModel('light')}
                        disabled={isDownloadingLlm}
                        style={{
                          flex: 1,
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-subtle)',
                          padding: '8px 14px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: isDownloadingLlm ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Download size={14} />
                        <span>Télécharger (468 Mo)</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => updateSettings({ localLlmModel: 'light' })}
                          style={{
                            flex: 1,
                            backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--bg-card)',
                            color: isSelected ? '#fff' : 'var(--text-primary)',
                            border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                            padding: '8px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          {isSelected ? <Check size={14} /> : null}
                          <span>{isSelected ? 'Modèle actif' : 'Activer ce modèle'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteModel('light')}
                          title="Supprimer le fichier du modèle pour libérer l'espace disque"
                          style={{
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 3.4 Bouton de benchmark "Tester la vitesse de mon PC" */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 800 }}>
                <Zap size={18} color="var(--color-warning, #f59e0b)" />
                <span>Tester la vitesse de mon PC</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Mesure le temps de réponse et le débit d'inférence réel (tokens/seconde) sur votre processeur.
              </p>
            </div>

            <button
              onClick={handleRunSpeedTest}
              disabled={isTestingSpeed}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isTestingSpeed ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
              }}
            >
              {isTestingSpeed ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Test en cours...</span>
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  <span>Lancer le test de vitesse</span>
                </>
              )}
            </button>
          </div>

          {speedTestError && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--color-danger, #ef4444)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: '0.8rem',
              }}
            >
              {speedTestError}
            </div>
          )}

          {speedTestResult && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                  Résultat : {speedTestResult.tokensPerSec} tokens/s • {speedTestResult.durationMs} ms ({speedTestResult.ramUsageMB} Mo RAM)
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: speedTestResult.rating === 'fast' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: speedTestResult.rating === 'fast' ? '#10b981' : '#f59e0b',
                  }}
                >
                  {speedTestResult.rating === 'fast' ? '⚡ Très rapide' : speedTestResult.rating === 'acceptable' ? '✅ Fluide' : '🐢 Modéré'}
                </span>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '3px solid var(--color-primary)', paddingLeft: '8px' }}>
                Phrase générée : « {speedTestResult.sentence} »
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {speedTestResult.recommendation}
              </div>
            </div>
          )}
        </div>

        {/* 3.5 Générateur en masse pour les mots sans phrase d'exemple */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Compléter les mots sans phrase d'exemple
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {(() => {
                  const missingCount = db.words.filter((w) => !w.example || !w.example.trim()).length;
                  return missingCount === 0
                    ? 'Tous vos mots ont déjà une phrase d’exemple !'
                    : `${missingCount} mot(s) dans votre vocabulaire n'ont pas encore de phrase d’exemple.`;
                })()}
              </div>
            </div>

            {(() => {
              const missingCount = db.words.filter((w) => !w.example || !w.example.trim()).length;
              const isProcessing = !!sentenceQueueStats?.isProcessing;

              return (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isProcessing && (
                    <>
                      <button
                        onClick={handlePauseResumeQueue}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        {sentenceQueueStats?.isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
                        <span>{sentenceQueueStats?.isPaused ? 'Reprendre' : 'Pause'}</span>
                      </button>

                      <button
                        onClick={handleCancelQueue}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: 'var(--color-danger, #ef4444)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                        title="Annuler les générations restantes"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}

                  <button
                    onClick={handleGenerateMissing}
                    disabled={missingCount === 0 || isProcessing || isGeneratingMissing}
                    style={{
                      background: missingCount > 0 ? 'var(--color-primary)' : 'var(--bg-card)',
                      color: missingCount > 0 ? '#fff' : 'var(--text-muted)',
                      border: missingCount > 0 ? 'none' : '1px solid var(--border-subtle)',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: (missingCount === 0 || isProcessing || isGeneratingMissing) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Sparkles size={14} />
                    <span>Générer les phrases manquantes</span>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Statut de la file en arrière-plan */}
          {sentenceQueueStats && sentenceQueueStats.total > 0 && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                  <RefreshCw
                    size={14}
                    className={sentenceQueueStats.isProcessing && !sentenceQueueStats.isPaused ? 'animate-spin' : ''}
                    color="var(--color-primary)"
                  />
                  <span>
                    File de génération :{' '}
                    <strong style={{ color: 'var(--color-primary)' }}>
                      {sentenceQueueStats.completed} / {sentenceQueueStats.total}
                    </strong>
                    {sentenceQueueStats.isPaused && (
                      <span style={{ color: '#f59e0b', marginLeft: '6px' }}>(En pause)</span>
                    )}
                    {sentenceQueueStats.currentWord && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                        {' '}(En cours : « {sentenceQueueStats.currentWord} »)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div style={{ height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.round((sentenceQueueStats.completed / Math.max(sentenceQueueStats.total, 1)) * 100)}%`,
                    height: '100%',
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: '3px',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3.6 Ordre de cascade des 4 sources */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Cascade de recherche des phrases (ordre de priorité)
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              L'application teste chaque source dans l'ordre indiqué jusqu'à obtenir une phrase courte et pertinente.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(settings.exampleCascadeOrder || ['user', 'dictionary', 'local_llm', 'api']).map((source, index) => {
              const info = {
                user: {
                  title: '✍️ Ma phrase personnalisée',
                  desc: 'Vos phrases manuelles ne sont JAMAIS écrasées (priorité absolue)',
                  isFixed: true,
                },
                dictionary: {
                  title: '📖 Dictionnaire certifié (Free Dictionary API)',
                  desc: 'Phrases réelles en ligne de qualité dictionnaire',
                  isFixed: false,
                },
                local_llm: {
                  title: '🤖 Modèle de langage local (Qwen2.5 hors ligne)',
                  desc: 'Génération instantanée locale sans compte ni internet (termes techniques & aéro)',
                  isFixed: false,
                },
                api: {
                  title: '✨ Clé API distante (Option Qualité+)',
                  desc: 'Optionnel : synthèse via votre propre clé OpenAI/Groq',
                  isFixed: false,
                },
              }[source];

              if (!info) return null;

              return (
                <div
                  key={source}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: 'var(--color-primary)',
                      }}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {info.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {info.desc}
                      </div>
                    </div>
                  </div>

                  {!info.isFixed && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleMoveCascade(index, 'up')}
                        disabled={index <= 1}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px',
                          color: index <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: index <= 1 ? 'not-allowed' : 'pointer',
                          opacity: index <= 1 ? 0.3 : 1,
                        }}
                        title="Monter la priorité"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        onClick={() => handleMoveCascade(index, 'down')}
                        disabled={index >= 3}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px',
                          color: index >= 3 ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: index >= 3 ? 'not-allowed' : 'pointer',
                          opacity: index >= 3 ? 0.3 : 1,
                        }}
                        title="Descendre la priorité"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 3.7 Option Qualité+ : Clé API externe (Facultatif) */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--color-primary)" />
            <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
              Option Qualité+ : Clé API distante (Facultatif)
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Totalement optionnel. Si vous possédez une clé OpenAI ou compatible (Groq, OpenRouter), vous pouvez la renseigner ici pour enrichir vos phrases.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={settings.aiApiKey || ''}
                onChange={(e) => updateSettings({ aiApiKey: e.target.value })}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
                title={showApiKey ? 'Masquer la clé' : 'Afficher la clé'}
              >
                {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '120px' }}>
                Point d'accès API :
              </span>
              <input
                type="text"
                placeholder="https://api.openai.com/v1 (ou https://api.groq.com/openai/v1)"
                value={settings.aiApiEndpoint || ''}
                onChange={(e) => updateSettings({ aiApiEndpoint: e.target.value })}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. NOTIFICATIONS DE BUREAU */}
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
            <strong>Qwen2.5-Instruct (0.5B / 1.5B) :</strong> Modèles de langage locaux pour phrases d'exemple par Alibaba Cloud & Qwen Team (Licence Apache 2.0).
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <strong>node-llama-cpp :</strong> Inférence native C++ GGML/llama.cpp optimisée CPU sous Node.js par withcatai (Licence MIT).
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

      {/* MODAL DE CONFIRMATION DE SUPPRESSION DU CACHE AUDIO */}
      {isClearCacheModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            animation: 'modalBackdropFade 0.15s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isClearingCache) {
              setIsClearCacheModalOpen(false);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '490px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-danger, #ef4444)',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Supprimer le cache audio ?
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {cacheStats.count} audios en cache ({cacheStats.formattedSize})
                </p>
              </div>
            </div>

            <div
              style={{
                fontSize: '0.92rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}
            >
              Supprimer les <strong>{cacheStats.count} audios</strong> en cache (<strong>{cacheStats.formattedSize}</strong>) ? Ils seront régénérés automatiquement au besoin.
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              🛡️ <strong>Sécurité des données :</strong> Ne supprime JAMAIS le modèle Kokoro ni les voix installées, ni vos mots, playlists, XP, streak ou réglages. Seuls les fichiers audio temporaires générés sont effacés.
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                padding: '4px 0',
              }}
            >
              <input
                type="checkbox"
                checked={regenerateAfterClear}
                onChange={(e) => setRegenerateAfterClear(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <span>Régénérer ensuite en arrière-plan</span>
            </label>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '6px',
              }}
            >
              <button
                onClick={() => setIsClearCacheModalOpen(false)}
                disabled={isClearingCache}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: isClearingCache ? 'not-allowed' : 'pointer',
                }}
              >
                Annuler
              </button>

              <button
                onClick={handleConfirmClearCache}
                disabled={isClearingCache}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-danger, #ef4444)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: isClearingCache ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
                }}
              >
                {isClearingCache ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Supprimer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
