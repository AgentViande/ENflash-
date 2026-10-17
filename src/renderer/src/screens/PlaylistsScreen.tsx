import React, { useState } from 'react';
import {
  FolderHeart,
  Plus,
  Play,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Playlist } from '../../../shared/types';

interface PlaylistsScreenProps {
  onStartStudyPlaylist: (playlistId: string) => void;
}

export const PlaylistsScreen: React.FC<PlaylistsScreenProps> = ({ onStartStudyPlaylist }) => {
  const { db, createPlaylist, updatePlaylist, deletePlaylist, toggleWordInPlaylist } = useApp();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [managingWordsPlaylist, setManagingWordsPlaylist] = useState<Playlist | null>(null);

  // Formulaire création / édition
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [wordSearchFilter, setWordSearchFilter] = useState('');

  if (!db) return null;

  // Calcul des listes automatiques intelligentes
  const difficultWords = db.words.filter(
    (w) => w.totalReviews > 0 && w.failureCount / w.totalReviews >= 0.4
  );
  const newWords = db.words.filter((w) => w.leitnerBox === 1);

  const colorsList = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6'];

  const handleOpenCreate = () => {
    setName('');
    setDescription('');
    setColor('#6366f1');
    setSelectedWordIds([]);
    setEditingPlaylist(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (pl: Playlist) => {
    setName(pl.name);
    setDescription(pl.description);
    setColor(pl.color);
    setSelectedWordIds(pl.wordIds);
    setEditingPlaylist(pl);
    setIsCreateModalOpen(true);
  };

  const handleSavePlaylist = async () => {
    if (!name.trim()) return;

    if (editingPlaylist) {
      await updatePlaylist({
        ...editingPlaylist,
        name: name.trim(),
        description: description.trim(),
        color,
        wordIds: selectedWordIds,
      });
    } else {
      await createPlaylist({
        name: name.trim(),
        description: description.trim(),
        color,
        icon: 'FolderHeart',
        wordIds: selectedWordIds,
      });
    }

    setIsCreateModalOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Supprimer définitivement la playlist "${name}" ? (Les mots ne seront pas supprimés)`)) {
      await deletePlaylist(id);
    }
  };

  return (
    <div
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
        animation: 'fadeInScale 0.25s ease',
      }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Playlists de révision
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Organisez votre vocabulaire par thèmes, cours ou objectifs spécifiques
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <Plus size={18} />
          <span>Nouvelle playlist</span>
        </button>
      </div>

      {/* SECTION 1 : Playlists automatiques intelligentes */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>
          Playlists automatiques intelligentes ⚡
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Mots difficiles */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(220, 38, 38, 0.05) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-xl)',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                >
                  Automatique
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {difficultWords.length} mot(s)
                </span>
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Mots difficiles
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Regroupe les termes que vous ratez le plus souvent pour un entraînement intensif.
              </p>
            </div>

            <button
              onClick={() => onStartStudyPlaylist('smart_difficult')}
              disabled={difficultWords.length === 0}
              style={{
                background: difficultWords.length > 0 ? '#ef4444' : 'var(--bg-secondary)',
                color: difficultWords.length > 0 ? '#ffffff' : 'var(--text-muted)',
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: difficultWords.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              <Play size={16} fill="currentColor" />
              <span>S'entraîner sur les mots difficiles</span>
            </button>
          </div>

          {/* Nouveaux mots */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(14, 165, 233, 0.05) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: 'var(--radius-xl)',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.2)',
                    color: '#06b6d4',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                >
                  Automatique
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {newWords.length} mot(s)
                </span>
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Nouveaux mots
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Tous les mots encore en Boîte 1 qui nécessitent une première mémorisation active.
              </p>
            </div>

            <button
              onClick={() => onStartStudyPlaylist('smart_new')}
              disabled={newWords.length === 0}
              style={{
                background: newWords.length > 0 ? '#06b6d4' : 'var(--bg-secondary)',
                color: newWords.length > 0 ? '#ffffff' : 'var(--text-muted)',
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: newWords.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              <Play size={16} fill="currentColor" />
              <span>S'entraîner sur les nouveaux</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2 : Playlists personnalisées */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>
          Vos playlists personnalisées ({db.playlists.length})
        </h3>

        {db.playlists.length === 0 ? (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '36px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <FolderHeart size={36} color="var(--text-muted)" />
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Aucune playlist personnalisée</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
              Créez votre première playlist thématique (ex: "Verbes irréguliers", "Vocabulaire du voyage", "Cours du 12 novembre") !
            </p>
            <button
              onClick={handleOpenCreate}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              Créer une playlist
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {db.playlists.map((pl) => {
              const playlistWords = db.words.filter((w) => pl.wordIds.includes(w.id));
              const masteredInPl = playlistWords.filter((w) => w.leitnerBox === 5).length;
              const pctMastered = playlistWords.length > 0 ? Math.round((masteredInPl / playlistWords.length) * 100) : 0;

              return (
                <div
                  key={pl.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: pl.color || '#6366f1',
                          marginTop: '4px',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => setManagingWordsPlaylist(pl)}
                          title="Gérer les mots"
                          style={{
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            padding: '4px',
                            borderRadius: '6px',
                          }}
                        >
                          <Layers size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(pl)}
                          title="Modifier"
                          style={{
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            padding: '4px',
                            borderRadius: '6px',
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(pl.id, pl.name)}
                          title="Supprimer"
                          style={{
                            background: 'transparent',
                            color: 'var(--color-danger)',
                            padding: '4px',
                            borderRadius: '6px',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {pl.name}
                    </h4>
                    {pl.description && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                        {pl.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{playlistWords.length} mot(s)</span>
                      <span style={{ color: 'var(--color-success)' }}>{pctMastered} % maîtrisés</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onStartStudyPlaylist(pl.id)}
                    disabled={playlistWords.length === 0}
                    style={{
                      background:
                        playlistWords.length > 0
                          ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                          : 'var(--bg-secondary)',
                      color: playlistWords.length > 0 ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: playlistWords.length > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <Play size={16} fill="currentColor" />
                    <span>Lancer la session</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL CRÉATION / ÉDITION DE PLAYLIST */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            animation: 'modalBackdropFade 0.15s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateModalOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '500px',
              maxWidth: '92vw',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              animation: 'modalContentPop 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {editingPlaylist ? 'Modifier la playlist' : 'Créer une playlist'}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'transparent', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  Nom de la playlist <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Verbes irréguliers"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  Description (optionnelle)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex : Mots abordés dans le chapitre 4"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>
                  Couleur d'accentuation
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {colorsList.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: color === c ? '3px solid #ffffff' : 'none',
                        boxShadow: color === c ? '0 0 10px ' + c : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSavePlaylist}
                disabled={!name.trim()}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTION DES MOTS D'UNE PLAYLIST */}
      {managingWordsPlaylist && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            animation: 'modalBackdropFade 0.15s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setManagingWordsPlaylist(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '640px',
              maxWidth: '92vw',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '80vh',
              animation: 'modalContentPop 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  Mots de la playlist : {managingWordsPlaylist.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Cochez ou décochez les mots à associer à cette playlist
                </p>
              </div>
              <button
                onClick={() => setManagingWordsPlaylist(null)}
                style={{ background: 'transparent', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Rechercher un mot à ajouter..."
              value={wordSearchFilter}
              onChange={(e) => setWordSearchFilter(e.target.value)}
              style={{ width: '100%' }}
            />

            <div
              style={{
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '6px',
              }}
            >
              {db.words
                .filter((w) => {
                  const query = wordSearchFilter.toLowerCase();
                  return (
                    w.french.toLowerCase().includes(query) ||
                    w.english.toLowerCase().includes(query)
                  );
                })
                .map((w) => {
                  const isInPlaylist = managingWordsPlaylist.wordIds.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      onClick={() => toggleWordInPlaylist(managingWordsPlaylist.id, w.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isInPlaylist
                          ? 'var(--color-primary-light)'
                          : 'var(--bg-secondary)',
                        border: isInPlaylist
                          ? '1px solid var(--color-primary)'
                          : '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{w.french}</strong> ➔{' '}
                        <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{w.english}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isInPlaylist}
                        onChange={() => {}} // Géré par le div onClick
                        style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}
            </div>

            <button
              onClick={() => setManagingWordsPlaylist(null)}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff',
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                marginTop: '6px',
              }}
            >
              Terminer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
