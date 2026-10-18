import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Brain,
  Volume2,
  Sparkles,
  Cpu,
  Key,
  ListOrdered,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  ExternalLink,
  FolderOpen,
  Eye,
  EyeOff,
  Check,
  Info,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  CentreIATab,
  VoiceAccent,
  ExampleSourceType,
  SentenceQueueItem,
  AiApiProvider,
} from '../../../shared/types';
import {
  AI_PROVIDERS,
  AI_PROVIDER_LIST,
  detectProviderFromKey,
} from '../../../shared/constants/aiProviders';
import { AudioEngineStatus } from '../../../preload/types';
import { AVAILABLE_KOKORO_VOICES, getDefaultVoiceForAccent } from '../../../shared/audio/kokoroVoices';
import { speakText, runVoiceComparison } from '../utils/audio';

interface CentreIAScreenProps {
  initialTab?: CentreIATab;
  onBack: () => void;
}

export const CentreIAScreen: React.FC<CentreIAScreenProps> = ({ initialTab = 'overview', onBack }) => {
  const { db, updateSettings, sentenceQueueStats, generateMissingSentences } = useApp();

  const [activeTab, setActiveTab] = useState<CentreIATab>(initialTab);

  // Moteur Kokoro & Cache
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

  // Clé API
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testApiResult, setTestApiResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTestingApiKey, setIsTestingApiKey] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTestingGeneration, setIsTestingGeneration] = useState<boolean>(false);
  const [testGenerationResult, setTestGenerationResult] = useState<{
    success?: boolean;
    sentence?: string;
    durationMs?: number;
    error?: string;
  } | null>(null);
  const [isManualModelInput, setIsManualModelInput] = useState<boolean>(false);

  // File de génération
  const [isGeneratingMissing, setIsGeneratingMissing] = useState<boolean>(false);
  const [queueItems, setQueueItems] = useState<SentenceQueueItem[]>([]);
  const [isClearingQueue, setIsClearingQueue] = useState<boolean>(false);
  const [isRetryingQueue, setIsRetryingQueue] = useState<boolean>(false);

  // Cache & Stockage
  const [isClearCacheModalOpen, setIsClearCacheModalOpen] = useState<boolean>(false);
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

  // Message toast temporaire
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Recharger le statut des voix Kokoro et du cache
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

  // Recharger les items détaillés de la file
  const loadQueueItems = useCallback(async () => {
    if (window.api?.getSentenceQueueItems) {
      try {
        const items = await window.api.getSentenceQueueItems();
        setQueueItems(items);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    loadVoicesAndCache();
    loadQueueItems();

    const unsubKokoro = window.api?.onKokoroProgress?.((data) => {
      setKokoroProgress(data);
      if (data.progress >= 100) {
        setIsInstallingKokoro(false);
        loadVoicesAndCache();
      }
    });

    const unsubPreload = window.api?.onPreloadProgress?.((data) => {
      setPreloadProgress(data);
      if (!data.isPreloading) {
        loadVoicesAndCache();
      }
    });

    const unsubQueue = window.api?.onSentenceQueueProgress?.(() => {
      loadQueueItems();
    });

    return () => {
      unsubKokoro?.();
      unsubPreload?.();
      unsubQueue?.();
    };
  }, [loadVoicesAndCache, loadQueueItems]);

  if (!db) return null;
  const settings = db.settings;

  // Actions Kokoro
  const handleRepairOrInstallKokoro = async () => {
    if (!window.api?.installKokoro) return;
    setIsInstallingKokoro(true);
    setKokoroProgress({ progress: 5, label: 'Préparation du modèle Kokoro...' });
    try {
      const res = await window.api.installKokoro();
      if (res.success) {
        showToast('Modèle neuronal Kokoro-82M installé et prêt !');
        loadVoicesAndCache();
      } else {
        alert(`Échec de l’installation : ${res.error}`);
      }
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setIsInstallingKokoro(false);
    }
  };

  const handleRunComparison = async () => {
    if (comparisonPhase !== 'idle' && comparisonPhase !== 'done') return;
    try {
      await runVoiceComparison(
        settings.voiceAccent,
        settings.preferredVoiceId,
        (phase) => setComparisonPhase(phase)
      );
    } catch {
      setComparisonPhase('idle');
    }
  };

  const handleTestVoice = async (voiceId: string) => {
    setVoiceTestingId(voiceId);
    try {
      await speakText('The quick brown fox jumps over the lazy dog.', {
        accent: settings.voiceAccent,
        preferredVoiceId: voiceId,
        speed: settings.voiceSpeed || 1.0,
        volume: settings.voiceVolume ?? 0.8,
      });
    } catch (err) {
      console.warn('Erreur écoute voix:', err);
    } finally {
      setVoiceTestingId(null);
    }
  };

  // Actions Clé API & Fournisseur
  const handleSelectProvider = (newProvider: AiApiProvider) => {
    const config = AI_PROVIDERS[newProvider];
    const newEndpoint = config ? config.defaultEndpoint : '';
    const newModel = config ? config.defaultModel : '';

    // Récupérer la clé déjà enregistrée pour ce fournisseur spécifique (si elle existe)
    const existingKeys: Partial<Record<AiApiProvider, string>> = { ...(settings.aiApiKeys || {}) };
    if (settings.aiApiKey && settings.aiApiProvider) {
      existingKeys[settings.aiApiProvider] = settings.aiApiKey;
    }
    const keyForNewProvider = existingKeys[newProvider] || '';

    updateSettings({
      aiApiProvider: newProvider,
      aiApiEndpoint: newEndpoint,
      aiApiModel: newModel,
      aiApiKey: keyForNewProvider,
      aiApiKeys: existingKeys,
    });
    setTestApiResult(null);
    setTestGenerationResult(null);
    setAvailableModels(config?.recommendedModels || []);
    setIsManualModelInput(false);
  };

  const handleApiKeyChange = (newKey: string) => {
    const trimmed = newKey.trim();
    const detected = detectProviderFromKey(trimmed);
    const currentProvider = settings.aiApiProvider || 'gemini';
    const targetProvider = detected || currentProvider;

    const updatedKeys: Partial<Record<AiApiProvider, string>> = { ...(settings.aiApiKeys || {}) };
    updatedKeys[targetProvider] = newKey;

    const updates: Partial<typeof settings> = {
      aiApiKey: newKey,
      aiApiKeys: updatedKeys,
    };
    if (detected && detected !== currentProvider) {
      const config = AI_PROVIDERS[detected];
      updates.aiApiProvider = detected;
      updates.aiApiEndpoint = config.defaultEndpoint;
      updates.aiApiModel = config.defaultModel;
      setAvailableModels(config.recommendedModels || []);
      showToast(`Fournisseur détecté : ${config.name}`);
    }
    updateSettings(updates);
    setTestApiResult(null);
    setTestGenerationResult(null);
  };

  const handleTestApiKey = async () => {
    const key = (settings.aiApiKey || '').trim();
    if (!key) {
      setTestApiResult({ success: false, message: 'Veuillez saisir une clé API' });
      return;
    }
    const provider = settings.aiApiProvider || 'gemini';
    setIsTestingApiKey(true);
    setTestApiResult(null);
    try {
      if (window.api?.testAiApiKey) {
        const res = await window.api.testAiApiKey({
          provider,
          apiKey: key,
          apiEndpoint: settings.aiApiEndpoint,
        });
        if (res.success) {
          if (res.models && res.models.length > 0) {
            setAvailableModels(res.models);
            if (!settings.aiApiModel || !res.models.includes(settings.aiApiModel)) {
              updateSettings({ aiApiModel: res.models[0] });
            }
          }
          setTestApiResult({
            success: true,
            message: res.message || 'Clé valide ✅',
          });
        } else {
          setTestApiResult({
            success: false,
            message: res.error || 'Échec de validation de la clé API',
          });
        }
      }
    } catch (err: any) {
      setTestApiResult({ success: false, message: `Erreur: ${err.message}` });
    } finally {
      setIsTestingApiKey(false);
    }
  };

  const handleTestAiGeneration = async () => {
    const key = (settings.aiApiKey || '').trim();
    if (!key) {
      setTestGenerationResult({ success: false, error: 'Veuillez saisir une clé API' });
      return;
    }
    const provider = settings.aiApiProvider || 'gemini';
    const model = settings.aiApiModel || AI_PROVIDERS[provider]?.defaultModel || 'gemini-1.5-flash';
    setIsTestingGeneration(true);
    setTestGenerationResult(null);
    try {
      if (window.api?.testAiGeneration) {
        const res = await window.api.testAiGeneration({
          provider,
          apiKey: key,
          apiEndpoint: settings.aiApiEndpoint,
          model,
        });
        setTestGenerationResult(res);
      }
    } catch (err: any) {
      setTestGenerationResult({ success: false, error: err.message });
    } finally {
      setIsTestingGeneration(false);
    }
  };

  // Actions File de génération
  const handleGenerateMissing = async () => {
    setIsGeneratingMissing(true);
    try {
      const count = await generateMissingSentences();
      showToast(`${count} mot(s) ajouté(s) à la file de génération`);
      loadQueueItems();
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMissing(false);
    }
  };

  const handlePauseResumeQueue = async () => {
    if (sentenceQueueStats?.isPaused) {
      await window.api?.resumeSentenceQueue();
    } else {
      await window.api?.pauseSentenceQueue();
    }
  };

  const handleClearQueue = async () => {
    if (!window.confirm('Confirmez-vous le vidage de la file d’attente ? (Vos mots existants ne seront pas modifiés)')) return;
    setIsClearingQueue(true);
    try {
      await window.api?.clearSentenceQueue?.();
      showToast('File d’attente vidée');
      loadQueueItems();
    } finally {
      setIsClearingQueue(false);
    }
  };

  const handleRetryFailed = async () => {
    setIsRetryingQueue(true);
    try {
      const count = (await window.api?.retryFailedSentences?.()) || 0;
      showToast(`${count} tâche(s) en échec relancée(s)`);
      loadQueueItems();
    } finally {
      setIsRetryingQueue(false);
    }
  };

  // Actions Cache
  const handleClearAudioCache = async () => {
    setIsClearingCache(true);
    try {
      if (window.api?.clearCache) {
        await window.api.clearCache();
        showToast('Cache audio supprimé avec succès');
        loadVoicesAndCache();
        setIsClearCacheModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleOpenCacheFolder = async () => {
    if (window.api?.openCacheFolder) {
      await window.api.openCacheFolder();
    }
  };

  const handlePreloadAllVoices = async () => {
    if (!window.api?.preloadWords || !db.words) return;
    const items = db.words.map((w) => ({
      text: w.english,
      accent: settings.voiceAccent,
      voiceId: settings.preferredVoiceId,
      speed: settings.voiceSpeed || 1.0,
    }));
    window.api.preloadWords(items);
  };

  // Calcul du statut global de chaque section pour les badges d'onglet
  const isKokoroReady = !!kokoroStatus?.isKokoroReady;
  const hasApiKey = !!(settings.aiApiKey && settings.aiApiKey.trim().length > 0);
  const queueHasErrors = (sentenceQueueStats?.failed ?? 0) > 0;
  const queueIsRunning = !!sentenceQueueStats?.isProcessing;

  const missingWordsCount = db.words.filter((w) => !w.example || !w.example.trim()).length;
  const withWordsCount = db.words.length - missingWordsCount;

  // Calcul cascade order
  const cascadeOrder: ExampleSourceType[] = settings.exampleCascadeOrder || ['user', 'dictionary', 'api'];

  const moveCascadeSource = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= cascadeOrder.length) return;
    const updated = [...cascadeOrder];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    updateSettings({ exampleCascadeOrder: updated });
  };

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            fontWeight: 700,
            fontSize: '0.9rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* En-tête avec bouton retour */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Revenir aux Paramètres principaux"
          >
            <ArrowLeft size={16} />
            <span>Paramètres</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Centre IA & Synthèse Vocale
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--color-primary)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                100% Hors Ligne
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Configuration avancée du moteur neuronal Kokoro, de la cascade de phrases et des clés d'IA
            </p>
          </div>
        </div>
      </div>

      {/* Navigation par Onglets avec indicateurs d'état */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {[
          { id: 'overview' as CentreIATab, label: 'Vue d’ensemble', icon: <Brain size={15} />, status: 'ok' },
          { id: 'voice' as CentreIATab, label: 'Voix naturelles (Kokoro)', icon: <Volume2 size={15} />, status: isKokoroReady ? 'ok' : 'warning' },
          { id: 'sentences' as CentreIATab, label: 'Phrases d’exemple', icon: <Sparkles size={15} />, status: 'ok' },
          { id: 'api_key' as CentreIATab, label: 'Clé API personnelle', icon: <Key size={15} />, status: hasApiKey ? 'ok' : 'muted' },
          { id: 'queue' as CentreIATab, label: 'File de génération', icon: <ListOrdered size={15} />, status: queueHasErrors ? 'error' : queueIsRunning ? 'info' : 'ok' },
          { id: 'cache' as CentreIATab, label: 'Cache & Stockage', icon: <HardDrive size={15} />, status: 'ok' },
          { id: 'privacy' as CentreIATab, label: 'Confidentialité & Crédits', icon: <ShieldCheck size={15} />, status: 'ok' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {/* Badge indicateur */}
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor:
                    tab.status === 'ok'
                      ? '#10b981'
                      : tab.status === 'warning'
                      ? '#f59e0b'
                      : tab.status === 'error'
                      ? '#ef4444'
                      : tab.status === 'info'
                      ? '#6366f1'
                      : 'var(--text-muted)',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* CONTENU SELON L'ONGLET SÉLECTIONNÉ */}

      {/* 1. VUE D'ENSEMBLE */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Carte Voix Kokoro */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                  <Volume2 size={18} color="var(--color-primary)" />
                  <span>Voix neuronale</span>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: isKokoroReady ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: isKokoroReady ? '#10b981' : '#f59e0b',
                  }}
                >
                  {isKokoroReady ? 'Kokoro prête ✅' : 'Voix système ⚠️'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isKokoroReady
                  ? `Voix active : ${AVAILABLE_KOKORO_VOICES.find((v) => v.id === settings.preferredVoiceId)?.name || 'Heart'} (${settings.voiceAccent})`
                  : 'Modèle Kokoro non installé. Bascule automatique sur la voix système.'}
              </div>
              <button
                onClick={() => setActiveTab('voice')}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  width: 'fit-content',
                }}
              >
                Gérer la voix ➔
              </button>
            </div>

            {/* Carte Phrases d'exemple */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                  <Sparkles size={18} color="#10b981" />
                  <span>Phrases d'exemple</span>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                  }}
                >
                  {withWordsCount} / {db.words.length} complétés
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {missingWordsCount === 0
                  ? 'Tous vos mots possèdent une phrase d’exemple.'
                  : `${missingWordsCount} mot(s) sans phrase en attente.`}
              </div>
              <button
                onClick={() => setActiveTab('sentences')}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  width: 'fit-content',
                }}
              >
                Gérer les phrases ➔
              </button>
            </div>



            {/* Carte Clé API */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                  <Key size={18} color="#06b6d4" />
                  <span>Clé API (Optionnelle)</span>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: hasApiKey ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                    color: hasApiKey ? '#10b981' : 'var(--text-muted)',
                  }}
                >
                  {hasApiKey ? 'Configurée ✅' : 'Non renseignée'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {hasApiKey ? 'Fournisseur configuré pour générer vos phrases.' : 'Connectez Google Gemini (gratuit), OpenAI, Groq, Mistral... pour générer vos phrases.'}
              </div>
              <button
                onClick={() => setActiveTab('api_key')}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  width: 'fit-content',
                }}
              >
                Configurer ➔
              </button>
            </div>
          </div>

          {/* Diagnostic matériel & Ressources */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>État des ressources et du stockage</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Moteur Audio</span>
                <strong>{isKokoroReady ? 'Kokoro-82M v1.0 (ONNX)' : 'Synthèse système'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Générateur de phrases</span>
                <strong>{hasApiKey ? `Clé ${settings.aiApiProvider || 'API'} active` : 'Dictionnaire en ligne'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Cache audio Kokoro</span>
                <strong>{cacheStats.count} fichiers ({cacheStats.formattedSize})</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>File d'attente</span>
                <strong>
                  {sentenceQueueStats?.total || 0} tâches ({sentenceQueueStats?.completed || 0} faites, {sentenceQueueStats?.failed || 0} erreurs)
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. VOIX NATURELLES (KOKORO) */}
      {activeTab === 'voice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Statut de transparence du moteur */}
          <div
            style={{
              backgroundColor: isKokoroReady ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.12)',
              border: isKokoroReady ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Moteur de synthèse vocale actif :</span>
                {isKokoroReady ? (
                  <span style={{ color: '#10b981' }}>Voix naturelle Kokoro-82M ✅ (Hors ligne)</span>
                ) : (
                  <span style={{ color: '#f59e0b' }}>Voix de secours système SAPI ⚠️</span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {isKokoroReady
                  ? 'Moteur neuronal ONNX ultra-rapide (82M paramètres), phonèmes naturels et intonation fluide.'
                  : 'Le modèle neuronal Kokoro n’est pas prêt. L’application utilise la voix système de votre PC.'}
              </div>
            </div>

            <button
              onClick={handleRepairOrInstallKokoro}
              disabled={isInstallingKokoro}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isKokoroReady ? 'var(--bg-secondary)' : 'var(--color-primary)',
                color: isKokoroReady ? 'var(--text-primary)' : '#fff',
                border: '1px solid var(--border-subtle)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: isInstallingKokoro ? 'not-allowed' : 'pointer',
              }}
            >
              <RotateCw size={14} className={isInstallingKokoro ? 'animate-spin' : ''} />
              <span>{isInstallingKokoro ? 'Installation en cours...' : 'Réparer / réinstaller la voix'}</span>
            </button>
          </div>

          {/* Barre de progression installation Kokoro */}
          {isInstallingKokoro && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span>{kokoroProgress.label || 'Téléchargement du modèle Kokoro...'}</span>
                <strong>{kokoroProgress.progress}%</strong>
              </div>
              <div style={{ height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${kokoroProgress.progress}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '3px' }} />
              </div>
            </div>
          )}

          {/* Accent UK / US */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Accent d'apprentissage</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { id: 'en-GB' as VoiceAccent, label: '🇬🇧 Anglais britannique (UK)' },
                { id: 'en-US' as VoiceAccent, label: '🇺🇸 Anglais américain (US)' },
              ].map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => {
                    updateSettings({
                      voiceAccent: acc.id,
                      preferredVoiceId: getDefaultVoiceForAccent(acc.id),
                    });
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: settings.voiceAccent === acc.id ? 'var(--color-primary)' : 'var(--bg-secondary)',
                    color: settings.voiceAccent === acc.id ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Réglages de prononciation (Volume, Vitesse, Auto-prononce) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                Volume de la voix : <strong>{Math.round((settings.voiceVolume ?? 0.8) * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.voiceVolume ?? 0.8}
                onChange={(e) => updateSettings({ voiceVolume: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                Vitesse de prononciation : <strong>{settings.voiceSpeed || 1.0}x</strong>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.2"
                step="0.05"
                value={settings.voiceSpeed || 1.0}
                onChange={(e) => updateSettings({ voiceSpeed: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Lecture automatique</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Prononcer au retournement</div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPronounce}
                onChange={(e) => updateSettings({ autoPronounce: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Liste des voix Kokoro */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
              Choix de la voix Kokoro ({settings.voiceAccent === 'en-GB' ? 'Britannique' : 'Américaine'})
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
              {AVAILABLE_KOKORO_VOICES.filter((v) => v.accent === settings.voiceAccent).map((voice) => {
                const isSelected = (settings.preferredVoiceId || 'af_heart') === voice.id;
                const isTesting = voiceTestingId === voice.id;
                return (
                  <div
                    key={voice.id}
                    style={{
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        {voice.label}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Note: {voice.grade}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {voice.description}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        onClick={() => handleTestVoice(voice.id)}
                        disabled={isTesting}
                        style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Volume2 size={14} className={isTesting ? 'animate-pulse' : ''} />
                        <span>{isTesting ? 'Lecture...' : 'Écouter'}</span>
                      </button>

                      <button
                        onClick={() => updateSettings({ preferredVoiceId: voice.id })}
                        style={{
                          flex: 1,
                          backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                          color: isSelected ? '#fff' : 'var(--text-primary)',
                          border: isSelected ? 'none' : '1px solid var(--border-subtle)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? 'Sélectionnée ✓' : 'Choisir'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Outil de comparaison Kokoro vs Voix Système */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
              Test comparatif : Kokoro vs Voix Système
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Écoutez la même phrase prononcée d’abord avec la voix naturelle Kokoro-82M, puis avec la voix robotique du système pour comparer la fluidité.
            </p>
            <button
              onClick={handleRunComparison}
              disabled={comparisonPhase !== 'idle' && comparisonPhase !== 'done'}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <Play size={14} />
              <span>
                {comparisonPhase === 'kokoro'
                  ? 'Écoute 1/2 : Kokoro en cours...'
                  : comparisonPhase === 'system'
                  ? 'Écoute 2/2 : Voix Système en cours...'
                  : comparisonPhase === 'gap'
                  ? 'Transition...'
                  : 'Lancer le test comparatif'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 3. PHRASES D'EXEMPLE */}
      {activeTab === 'sentences' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Cascade des sources */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Cascade des sources de génération</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                L'application teste les sources dans l'ordre de haut en bas jusqu'à trouver une phrase conforme au contrôle qualité.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cascadeOrder.map((src, index) => {
                const label =
                  src === 'user'
                    ? '1. Phrase personnelle (Priorité absolue, jamais écrasée)'
                    : src === 'dictionary'
                    ? '2. Dictionnaire en ligne (dictionaryapi.dev, gratuit)'
                    : '3. Intelligence Artificielle (Clé API personnelle : Gemini, OpenAI, Groq, Mistral...)';
                return (
                  <div
                    key={src}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{label}</span>
                    {src !== 'user' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => moveCascadeSource(index, 'up')}
                          disabled={index <= 1}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)',
                            cursor: index <= 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveCascadeSource(index, 'down')}
                          disabled={index >= cascadeOrder.length - 1}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)',
                            cursor: index >= cascadeOrder.length - 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Génération en masse pour les mots sans phrase */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Générateur de phrases en masse</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {missingWordsCount === 0
                  ? 'Tous vos mots ont déjà une phrase d’exemple.'
                  : `${missingWordsCount} mot(s) sans phrase détecté(s).`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setActiveTab('queue')}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Voir la file ➔
              </button>

              <button
                onClick={handleGenerateMissing}
                disabled={missingWordsCount === 0 || isGeneratingMissing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: missingWordsCount > 0 ? 'var(--color-primary)' : 'var(--bg-secondary)',
                  color: missingWordsCount > 0 ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: missingWordsCount > 0 && !isGeneratingMissing ? 'pointer' : 'not-allowed',
                }}
              >
                <Sparkles size={14} />
                <span>Générer les phrases manquantes ({missingWordsCount})</span>
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 5. CLÉ API PERSONNELLE */}
      {activeTab === 'api_key' && (() => {
        const currentProvider: AiApiProvider = settings.aiApiProvider || 'gemini';
        const currentConfig = AI_PROVIDERS[currentProvider] || AI_PROVIDERS.gemini;
        const modelsList = availableModels.length > 0 ? availableModels : currentConfig.recommendedModels;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                <div style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={18} color="var(--color-primary)" />
                  <span>Clé API externe (Option Qualité+)</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Connectez votre propre fournisseur d’intelligence artificielle pour générer des phrases d’exemples personnalisées. Google Gemini offre un quota gratuit généreux et rapide.
                </p>
              </div>

              {/* 1. Sélecteur de fournisseur */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Fournisseur d'IA
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={currentProvider}
                    onChange={(e) => handleSelectProvider(e.target.value as AiApiProvider)}
                    style={{
                      flex: 1,
                      minWidth: '240px',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {AI_PROVIDER_LIST.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.name} {prov.id === 'gemini' ? '★ (Recommandé, gratuit)' : ''}
                      </option>
                    ))}
                  </select>

                  {currentConfig.helpUrl && (
                    <a
                      href={currentConfig.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8rem',
                        color: 'var(--color-primary)',
                        textDecoration: 'none',
                        fontWeight: 600,
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      }}
                    >
                      <span>Obtenir une clé {currentConfig.name.split(' ')[0]}</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {currentConfig.description}
                </div>
              </div>

              {/* 2. Endpoint d'API */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    Endpoint de connexion (URL)
                  </label>
                  {!currentConfig.isEndpointEditable && (
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      🔒 Endpoint officiel vérifié
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={settings.aiApiEndpoint || currentConfig.defaultEndpoint}
                  onChange={(e) => {
                    if (currentConfig.isEndpointEditable) {
                      updateSettings({ aiApiEndpoint: e.target.value });
                    }
                  }}
                  readOnly={!currentConfig.isEndpointEditable}
                  placeholder={currentConfig.defaultEndpoint}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: currentConfig.isEndpointEditable ? 'var(--bg-input)' : 'var(--bg-secondary)',
                    color: currentConfig.isEndpointEditable ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    cursor: currentConfig.isEndpointEditable ? 'text' : 'not-allowed',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* 3. Clé API */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Clé API secrète ({currentConfig.name})
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.aiApiKey || ''}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder={`Exemple: ${currentConfig.keyPlaceholder}`}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={showApiKey ? 'Masquer la clé' : 'Afficher la clé'}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {!settings.aiApiKey && (
                  <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>ℹ️ Aucune clé enregistrée pour {currentConfig.name}. Saisissez votre clé ci-dessus pour activer ce fournisseur.</span>
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  🛡️ La clé est chiffrée sur votre PC via safeStorage et n'est jamais transmise à des tiers.
                </div>
              </div>

              {/* 4. Choix du modèle */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    Modèle sélectionné
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManualModelInput(!isManualModelInput)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {isManualModelInput ? '← Choisir dans la liste' : '+ Saisie manuelle'}
                  </button>
                </div>

                {isManualModelInput ? (
                  <input
                    type="text"
                    value={settings.aiApiModel || ''}
                    onChange={(e) => updateSettings({ aiApiModel: e.target.value })}
                    placeholder="Nom exact du modèle (ex: gemini-1.5-flash, gpt-4o-mini)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.85rem',
                    }}
                  />
                ) : (
                  <select
                    value={settings.aiApiModel || currentConfig.defaultModel}
                    onChange={(e) => updateSettings({ aiApiModel: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {modelsList.map((m) => (
                      <option key={m} value={m}>
                        {m} {m === currentConfig.defaultModel ? '★ (Défaut recommandé)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 5. Boutons de test en 2 temps */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                {/* Étape 1 : Tester la clé & charger modèles */}
                <button
                  type="button"
                  onClick={handleTestApiKey}
                  disabled={isTestingApiKey || !settings.aiApiKey}
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: isTestingApiKey || !settings.aiApiKey ? 'not-allowed' : 'pointer',
                    opacity: !settings.aiApiKey ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Key size={14} className={isTestingApiKey ? 'animate-spin' : ''} />
                  <span>{isTestingApiKey ? 'Vérification en cours...' : '1. Tester la clé (vérifier l’accès)'}</span>
                </button>

                {/* Étape 2 : Tester la génération */}
                <button
                  type="button"
                  onClick={handleTestAiGeneration}
                  disabled={isTestingGeneration || !settings.aiApiKey}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    padding: '9px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: isTestingGeneration || !settings.aiApiKey ? 'not-allowed' : 'pointer',
                    opacity: !settings.aiApiKey ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={14} className={isTestingGeneration ? 'animate-spin' : ''} />
                  <span>{isTestingGeneration ? 'Génération...' : '2. Tester la génération d’une phrase'}</span>
                </button>

                {/* Supprimer la clé */}
                {settings.aiApiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentProv = settings.aiApiProvider || 'gemini';
                      const updatedKeys: Partial<Record<AiApiProvider, string>> = { ...(settings.aiApiKeys || {}) };
                      delete updatedKeys[currentProv];
                      updateSettings({ aiApiKey: '', aiApiKeys: updatedKeys });
                      setTestApiResult(null);
                      setTestGenerationResult(null);
                      showToast('Clé API supprimée');
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                  >
                    Supprimer ma clé
                  </button>
                )}
              </div>

              {/* Résultat du test de clé */}
              {testApiResult && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: testApiResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: testApiResult.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    color: testApiResult.success ? '#10b981' : '#ef4444',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '1rem', lineHeight: '1.2' }}>{testApiResult.success ? '✓' : '⚠️'}</span>
                  <div style={{ flex: 1 }}>{testApiResult.message}</div>
                </div>
              )}

              {/* Résultat du test de génération */}
              {testGenerationResult && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: testGenerationResult.success ? 'rgba(99, 102, 241, 0.08)' : 'rgba(239, 68, 68, 0.1)',
                    border: testGenerationResult.success ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '0.84rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {testGenerationResult.success ? (
                    <>
                      <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                        ✓ Phrase générée avec succès en {testGenerationResult.durationMs} ms :
                      </div>
                      <div style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>
                        « {testGenerationResult.sentence} »
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#ef4444', fontWeight: 600 }}>
                      ⚠️ {testGenerationResult.error}
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                🔒 <strong>Confidentialité garantie :</strong> Seuls le mot anglais et sa traduction française sont transmis à l’API choisie pour composer l’exemple. Aucune donnée personnelle, statistique ou historique n'est partagée.
              </div>
            </div>
          </div>
        );
      })()}

      {/* 6. FILE DE GÉNÉRATION */}
      {activeTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Carte d'état de la file */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Statut de la file :</span>
                  {sentenceQueueStats?.isPaused ? (
                    <span style={{ color: '#f59e0b' }}>En pause ⏸️</span>
                  ) : sentenceQueueStats?.isProcessing ? (
                    <span style={{ color: 'var(--color-primary)' }}>En cours de génération ⚡</span>
                  ) : (sentenceQueueStats?.failed || 0) > 0 ? (
                    <span style={{ color: '#ef4444' }}>Terminé avec des erreurs ⚠️</span>
                  ) : (
                    <span style={{ color: '#10b981' }}>Au repos / Terminé ✓</span>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Total tâches : <strong>{sentenceQueueStats?.total || 0}</strong> • Terminées :{' '}
                  <strong style={{ color: '#10b981' }}>{sentenceQueueStats?.completed || 0}</strong> • En échec :{' '}
                  <strong style={{ color: (sentenceQueueStats?.failed || 0) > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                    {sentenceQueueStats?.failed || 0}
                  </strong>{' '}
                  • En attente : <strong>{sentenceQueueStats?.pending || 0}</strong>
                </div>
              </div>

              {/* Boutons d'actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handlePauseResumeQueue}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {sentenceQueueStats?.isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
                  <span>{sentenceQueueStats?.isPaused ? 'Reprendre' : 'Pause'}</span>
                </button>

                {(sentenceQueueStats?.failed || 0) > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    disabled={isRetryingQueue}
                    style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid var(--color-primary)',
                      color: 'var(--color-primary)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <RefreshCw size={13} className={isRetryingQueue ? 'animate-spin' : ''} />
                    <span>Relancer les échecs</span>
                  </button>
                )}

                <button
                  onClick={handleClearQueue}
                  disabled={isClearingQueue}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Supprimer toutes les tâches de la file"
                >
                  <Trash2 size={13} />
                  <span>Vider la file</span>
                </button>
              </div>
            </div>

            {/* Barre de progression */}
            {(sentenceQueueStats?.total || 0) > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round(((sentenceQueueStats?.completed || 0) / Math.max(sentenceQueueStats?.total || 1, 1)) * 100)}%`,
                      height: '100%',
                      backgroundColor: (sentenceQueueStats?.failed || 0) > 0 && (sentenceQueueStats?.completed || 0) === 0 ? '#ef4444' : 'var(--color-primary)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Erreur active ou dernière erreur avec deep link */}
            {sentenceQueueStats?.lastError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} />
                  <span>Dernier motif : {sentenceQueueStats.lastError}</span>
                </div>
                {!hasApiKey && (
                  <button
                    onClick={() => setActiveTab('api_key')}
                    style={{
                      backgroundColor: 'transparent',
                      color: 'var(--color-primary)',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Configurer une clé API (Gemini gratuite) ➔
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Réglage du débit (requêtes par minute) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Cadence de génération</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Régule le délai entre deux générations pour préserver le processeur
              </div>
            </div>
            <select
              value={settings.sentenceRequestsPerMinute || 60}
              onChange={(e) => updateSettings({ sentenceRequestsPerMinute: parseInt(e.target.value, 10) })}
              style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              <option value={30}>30 req/min (Doux ~2s de pause)</option>
              <option value={60}>60 req/min (Standard ~1s de pause)</option>
              <option value={120}>120 req/min (Rapide ~500ms de pause)</option>
            </select>
          </div>

          {/* Liste détaillée des tâches */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Détail des tâches en file ({queueItems.length})</div>

            {queueItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Aucune tâche dans la file d'attente actuellement.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {queueItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div>
                      <strong>{item.english}</strong>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>({item.french})</span>
                      {item.error && (
                        <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '2px' }}>
                          ⚠️ {item.error}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        backgroundColor:
                          item.status === 'done'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : item.status === 'processing'
                            ? 'rgba(99, 102, 241, 0.15)'
                            : item.status === 'failed'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(156, 163, 175, 0.15)',
                        color:
                          item.status === 'done'
                            ? '#10b981'
                            : item.status === 'processing'
                            ? 'var(--color-primary)'
                            : item.status === 'failed'
                            ? '#ef4444'
                            : 'var(--text-muted)',
                      }}
                    >
                      {item.status === 'done'
                        ? 'Terminé'
                        : item.status === 'processing'
                        ? 'En cours'
                        : item.status === 'failed'
                        ? 'Échoué'
                        : 'En attente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. CACHE ET STOCKAGE */}
      {activeTab === 'cache' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Cache audio */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Cache audio Kokoro persistant</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Les fichiers audio déjà prononcés sont stockés localement au format WAV sans perte pour une écoute instantanée à 0 ms.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong>{cacheStats.count}</strong> fichiers audio en cache (Espace disque : <strong>{cacheStats.formattedSize}</strong>)
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleOpenCacheFolder}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <FolderOpen size={14} />
                  <span>Ouvrir le dossier</span>
                </button>

                <button
                  onClick={() => setIsClearCacheModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} />
                  <span>Supprimer le cache audio</span>
                </button>
              </div>
            </div>
          </div>

          {/* Préparation en arrière-plan */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Pré-génération vocale des cartes</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Génère en amont la prononciation de tous vos mots dans la voix choisie pour un confort d'étude maximal.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem' }}>
                {preloadProgress.isPreloading
                  ? `Génération en cours : ${preloadProgress.completed} / ${preloadProgress.total} (« ${preloadProgress.currentText || ''} »)`
                  : 'Prêt pour la génération anticipée.'}
              </div>
              <button
                onClick={handlePreloadAllVoices}
                disabled={preloadProgress.isPreloading}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: preloadProgress.isPreloading ? 'not-allowed' : 'pointer',
                }}
              >
                {preloadProgress.isPreloading ? 'Préparation en cours...' : 'Tout préparer maintenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. CONFIDENTIALITÉ ET CRÉDITS */}
      {activeTab === 'privacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Flux réseau */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#10b981" />
              <span>Transparence des flux réseau</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <strong>🎙️ Voix naturelle Kokoro-82M :</strong> 100% hors ligne. Zéro donnée envoyée sur internet.
              </div>
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <strong>📖 Dictionnaire en ligne :</strong> Requête HTTP anonyme contenant uniquement le mot anglais sur dictionaryapi.dev.
              </div>
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <strong>🔑 Clé API personnelle :</strong> Seuls le mot anglais et sa traduction française sont envoyés à l'endpoint configuré.
              </div>
            </div>
          </div>

          {/* Licences */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Licences libres et crédits</div>
            <div>• <strong>Kokoro-82M :</strong> Licence Apache 2.0 (Hexgrad)</div>
            <div>• <strong>Dictionary API & Wiktionary :</strong> Licence Creative Commons BY-SA 3.0</div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMATION SUPPRESSION DU CACHE */}
      {isClearCacheModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Vider le cache audio ?</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Cette action supprimera {cacheStats.count} fichiers audio ({cacheStats.formattedSize}) de votre disque dur. Vos mots et vos phrases ne seront pas supprimés.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setIsClearCacheModalOpen(false)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleClearAudioCache}
                disabled={isClearingCache}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: isClearingCache ? 'not-allowed' : 'pointer',
                }}
              >
                {isClearingCache ? 'Suppression...' : 'Vider le cache'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
