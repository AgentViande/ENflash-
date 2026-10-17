import React from 'react';
import {
  Home,
  BookOpen,
  FolderHeart,
  Layers,
  PenTool,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { Mascot } from '../assets/Mascot';

export type ScreenTab =
  | 'accueil'
  | 'etudier'
  | 'playlists'
  | 'mots'
  | 'evaluation'
  | 'progression'
  | 'parametres';

interface SidebarProps {
  currentTab: ScreenTab;
  onSelectTab: (tab: ScreenTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const navItems: Array<{ id: ScreenTab; label: string; icon: React.ReactNode }> = [
    { id: 'accueil', label: 'Accueil', icon: <Home size={20} /> },
    { id: 'etudier', label: 'Étudier', icon: <BookOpen size={20} /> },
    { id: 'playlists', label: 'Playlists', icon: <FolderHeart size={20} /> },
    { id: 'mots', label: 'Mes mots', icon: <Layers size={20} /> },
    { id: 'evaluation', label: 'Évaluation', icon: <PenTool size={20} /> },
    { id: 'progression', label: 'Progression', icon: <TrendingUp size={20} /> },
    { id: 'parametres', label: 'Paramètres', icon: <Settings size={20} /> },
  ];

  return (
    <aside
      style={{
        width: '230px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 12px',
        userSelect: 'none',
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.95rem',
                textAlign: 'left',
                width: '100%',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mascotte Flashy en bas de la sidebar */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '16px 12px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Mascot mood="happy" size={75} className="animate-float" />
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Flashy ⚡
          </span>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Prêt pour briller en anglais !
          </p>
        </div>
      </div>
    </aside>
  );
};
