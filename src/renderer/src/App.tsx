import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, ScreenTab } from './components/Sidebar';
import { AccueilScreen } from './screens/AccueilScreen';
import { EtudierScreen } from './screens/EtudierScreen';
import { PlaylistsScreen } from './screens/PlaylistsScreen';
import { MesMotsScreen } from './screens/MesMotsScreen';
import { EvaluationScreen } from './screens/EvaluationScreen';
import { ProgressionScreen } from './screens/ProgressionScreen';
import { ParametresScreen } from './screens/ParametresScreen';

import { QuickAddModal } from './components/QuickAddModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { BadgeUnlockModal } from './components/BadgeUnlockModal';
import { LevelUpModal } from './components/LevelUpModal';
import { UpdateModal } from './components/UpdateModal';
import { WhatsNewModal } from './components/WhatsNewModal';
import { LocalModelCleanupModal } from './components/LocalModelCleanupModal';
import { useApp } from './contexts/AppContext';
import { UpdateInfo } from '../../preload/types';

export const App: React.FC = () => {
  const {
    db,
    loading,
    newBadgeUnlocked,
    clearNewBadge,
    levelUpData,
    clearLevelUpData,
    updateSettings,
    navigationTabRequest,
    clearNavigationTabRequest,
  } = useApp();

  const [currentTab, setCurrentTab] = useState<ScreenTab>('accueil');
  const [selectedPlaylistForStudy, setSelectedPlaylistForStudy] = useState<string | null>(null);
  const [isDailyModeActive, setIsDailyModeActive] = useState<boolean>(false);

  // Synchronisation avec les requêtes de navigation globales (ex: ouvrir Centre IA depuis n'importe où)
  useEffect(() => {
    if (navigationTabRequest) {
      setCurrentTab(navigationTabRequest as ScreenTab);
      clearNavigationTabRequest();
    }
  }, [navigationTabRequest, clearNavigationTabRequest]);

  // Modales globales
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');

  // Vérification de version et nouveautés au lancement
  useEffect(() => {
    if (window.api) {
      window.api.getAppVersion().then((ver) => {
        setCurrentVersion(ver);
        if (db && db.settings.lastSeenVersion && db.settings.lastSeenVersion !== ver) {
          setIsWhatsNewOpen(true);
        }
      });
    }
  }, [db]);

  const handleCloseWhatsNew = () => {
    setIsWhatsNewOpen(false);
    if (db) {
      updateSettings({ lastSeenVersion: currentVersion });
    }
  };

  // Raccourcis clavier globaux (Ctrl+N, ?)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsQuickAddOpen(true);
      } else if (!isInput && e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleStartDailyTest = () => {
    setIsDailyModeActive(true);
    setSelectedPlaylistForStudy(null);
    setCurrentTab('etudier');
  };

  const handleStartStudyPlaylist = (playlistId: string) => {
    setIsDailyModeActive(false);
    setSelectedPlaylistForStudy(playlistId);
    setCurrentTab('etudier');
  };

  const handleOpenUpdateModal = (info: UpdateInfo) => {
    setUpdateInfo(info);
    setIsUpdateModalOpen(true);
  };

  if (loading || !db) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--color-primary)',
          fontSize: '1.2rem',
          fontWeight: 700,
          gap: '12px',
        }}
      >
        <span>Chargement d'ENflash ⚡...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* En-tête fixe */}
      <Header
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Conteneur principal (Sidebar + Écran actif) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar currentTab={currentTab} onSelectTab={(tab) => {
          if (tab === 'etudier' && currentTab !== 'etudier') {
            setIsDailyModeActive(false);
            setSelectedPlaylistForStudy(null);
          }
          setCurrentTab(tab);
        }} />

        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
          {currentTab === 'accueil' && (
            <AccueilScreen
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
              onStartDailyTest={handleStartDailyTest}
            />
          )}

          {currentTab === 'etudier' && (
            <EtudierScreen
              initialDailyMode={isDailyModeActive}
              selectedPlaylistId={selectedPlaylistForStudy}
              onFinishDaily={() => setIsDailyModeActive(false)}
            />
          )}

          {currentTab === 'playlists' && (
            <PlaylistsScreen onStartStudyPlaylist={handleStartStudyPlaylist} />
          )}

          {currentTab === 'mots' && (
            <MesMotsScreen onOpenQuickAdd={() => setIsQuickAddOpen(true)} />
          )}

          {currentTab === 'evaluation' && <EvaluationScreen />}

          {currentTab === 'progression' && <ProgressionScreen />}

          {currentTab === 'parametres' && (
            <ParametresScreen onOpenUpdateModal={handleOpenUpdateModal} />
          )}
        </main>
      </div>

      {/* MODALES GLOBALES */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <BadgeUnlockModal
        badgeId={newBadgeUnlocked}
        onClose={clearNewBadge}
      />

      <LevelUpModal
        data={levelUpData}
        onClose={clearLevelUpData}
      />

      <UpdateModal
        isOpen={isUpdateModalOpen}
        updateInfo={updateInfo}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      <WhatsNewModal
        isOpen={isWhatsNewOpen}
        version={currentVersion}
        onClose={handleCloseWhatsNew}
      />

      <LocalModelCleanupModal />
    </div>
  );
};
