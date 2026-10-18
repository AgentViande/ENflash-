import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  Volume2,
  Edit2,
  Trash2,
  Tag,
  CheckCircle2,
  Sparkles,
  X,
  RotateCw,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Word, LeitnerBox, ExampleSourceType } from '../../../shared/types';
import { speakWord, speakText } from '../utils/audio';

interface MesMotsScreenProps {
  onOpenQuickAdd: () => void;
}

export const MesMotsScreen: React.FC<MesMotsScreenProps> = ({ onOpenQuickAdd }) => {
  const { db, updateWord, deleteWord, addWord, refreshDatabase, regenerateWordSentence, openCentreIA } = useApp();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'new' | 'learning' | 'mastered'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('all');

  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);

  // Formulaire d'édition
  const [editFrench, setEditFrench] = useState('');
  const [editEnglish, setEditEnglish] = useState('');
  const [editExample, setEditExample] = useState('');
  const [editExampleSource, setEditExampleSource] = useState<ExampleSourceType | undefined>(undefined);
  const [isGeneratingEditExample, setIsGeneratingEditExample] = useState(false);
  const [editGenerationError, setEditGenerationError] = useState<string | null>(null);
  const [isPlayingEditAudio, setIsPlayingEditAudio] = useState(false);
  const [generatingWordId, setGeneratingWordId] = useState<string | null>(null);
  const [rowGenerationError, setRowGenerationError] = useState<{ wordId: string; error: string } | null>(null);
  const [editTags, setEditTags] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editBox, setEditBox] = useState<LeitnerBox>(1);
  const [editBackgroundOffer, setEditBackgroundOffer] = useState<{
    sentence: string;
    source?: ExampleSourceType;
  } | null>(null);

  const isCancelledEditRef = useRef<boolean>(false);

  // Écoute des phrases reçues en arrière-plan
  useEffect(() => {
    if (!editingWord) {
      setEditBackgroundOffer(null);
      return;
    }

    const unsubBgReady = window.api?.onSentenceGenerated?.((data) => {
      if (
        data.wordId === editingWord.id ||
        (data.english && data.english.trim().toLowerCase() === editEnglish.trim().toLowerCase())
      ) {
        setEditBackgroundOffer({ sentence: data.sentence, source: data.source });
      }
    });

    return () => {
      unsubBgReady?.();
    };
  }, [editingWord, editEnglish]);

  if (!db) return null;

  // Liste de tous les tags uniques
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    db.words.forEach((w) => (w.tags || []).forEach((t) => tagsSet.add(t)));
    return Array.from(tagsSet);
  }, [db.words]);

  // Filtrage combiné
  const filteredWords = useMemo(() => {
    return db.words.filter((w) => {
      // 1. Recherche texte
      const query = search.toLowerCase();
      const matchSearch =
        w.french.toLowerCase().includes(query) ||
        w.english.toLowerCase().includes(query) ||
        (w.example && w.example.toLowerCase().includes(query)) ||
        (w.tags && w.tags.some((t) => t.toLowerCase().includes(query)));

      if (!matchSearch) return false;

      // 2. Filtre statut
      if (selectedStatus === 'new' && w.leitnerBox !== 1) return false;
      if (selectedStatus === 'learning' && (w.leitnerBox < 2 || w.leitnerBox > 4)) return false;
      if (selectedStatus === 'mastered' && w.leitnerBox !== 5) return false;

      // 3. Filtre tag
      if (selectedTag !== 'all' && (!w.tags || !w.tags.includes(selectedTag))) return false;

      // 4. Filtre playlist
      if (selectedPlaylistId !== 'all') {
        const pl = db.playlists.find((p) => p.id === selectedPlaylistId);
        if (pl && !pl.wordIds.includes(w.id)) return false;
      }

      return true;
    });
  }, [db.words, search, selectedStatus, selectedTag, selectedPlaylistId, db.playlists]);

  const handleOpenEdit = (w: Word) => {
    setEditingWord(w);
    setEditFrench(w.french);
    setEditEnglish(w.english);
    setEditExample(w.example || '');
    setEditExampleSource(w.exampleSource);
    setEditTags((w.tags || []).join(', '));
    setEditNote(w.note || '');
    setEditBox(w.leitnerBox);
    setEditGenerationError(null);
    setEditBackgroundOffer(null);
  };

  const handleGenerateEditExample = async (skipCurrent: boolean = false) => {
    if (!editEnglish.trim() || isGeneratingEditExample) return;
    setIsGeneratingEditExample(true);
    setEditGenerationError(null);
    setEditBackgroundOffer(null);
    isCancelledEditRef.current = false;

    // Timeout de sécurité global généreux (80s max pour le premier chargement disque)
    const timeoutPromise = new Promise<{ sentence?: string; source?: ExampleSourceType; error?: string } | null>(
      (_, reject) => setTimeout(() => reject(new Error('Délai maximal dépassé')), 80000)
    );

    try {
      if (window.api?.resolveSentenceCascade) {
        const genPromise = window.api.resolveSentenceCascade({
          english: editEnglish.trim(),
          french: editFrench.trim(),
          existingExample: skipCurrent ? undefined : editExample.trim(),
          skipSentence: skipCurrent ? editExample.trim() : undefined,
          cascadeOrder: db?.settings.exampleCascadeOrder,
          aiApiProvider: db?.settings.aiApiProvider,
          aiApiKey: db?.settings.aiApiKey,
          aiApiEndpoint: db?.settings.aiApiEndpoint,
          aiApiModel: db?.settings.aiApiModel,
          priority: 'immediate',
        });

        const res = await Promise.race([genPromise, timeoutPromise]);
        if (isCancelledEditRef.current) return;

        if (res && res.sentence) {
          setEditExample(res.sentence);
          setEditExampleSource(res.source);
          setEditGenerationError(null);
        } else {
          setEditGenerationError(res?.error || 'Aucune source disponible pour générer un exemple.');
        }
      }
    } catch (err: any) {
      if (!isCancelledEditRef.current) {
        setEditGenerationError(err.message || 'Erreur lors de la génération');
      }
    } finally {
      setIsGeneratingEditExample(false);
    }
  };

  const handleCancelEditGenerate = () => {
    isCancelledEditRef.current = true;
    setIsGeneratingEditExample(false);
  };

  const handlePlayEditExample = async () => {
    if (!editExample.trim() || isPlayingEditAudio) return;
    setIsPlayingEditAudio(true);
    try {
      await speakText(editExample.trim(), {
        accent: db?.settings.voiceAccent,
        preferredVoiceId: db?.settings.preferredVoiceId,
        speed: db?.settings.voiceSpeed || 1.0,
        volume: db?.settings.voiceVolume ?? 0.8,
      });
    } catch (err) {
      console.error('Erreur lecture audio:', err);
    } finally {
      setIsPlayingEditAudio(false);
    }
  };

  const handleGenerateRowSentence = async (word: Word, skipCurrent: boolean = false) => {
    if (generatingWordId) return;
    setGeneratingWordId(word.id);
    setRowGenerationError(null);

    // Timeout de sécurité global généreux (80s max pour le premier chargement disque)
    const timeoutPromise = new Promise<{ sentence?: string; source?: ExampleSourceType; error?: string } | null>(
      (_, reject) => setTimeout(() => reject(new Error('Délai dépassé')), 80000)
    );

    try {
      if (window.api?.resolveSentenceCascade) {
        const genPromise = window.api.resolveSentenceCascade({
          english: word.english,
          french: word.french,
          existingExample: skipCurrent ? undefined : word.example,
          skipSentence: skipCurrent ? word.example : undefined,
          cascadeOrder: db?.settings.exampleCascadeOrder,
          aiApiProvider: db?.settings.aiApiProvider,
          aiApiKey: db?.settings.aiApiKey,
          aiApiEndpoint: db?.settings.aiApiEndpoint,
          aiApiModel: db?.settings.aiApiModel,
          priority: 'immediate',
        });

        const res = await Promise.race([genPromise, timeoutPromise]);
        if (res && res.sentence) {
          await updateWord({
            ...word,
            example: res.sentence,
            exampleSource: res.source,
          });
        } else {
          setRowGenerationError({ wordId: word.id, error: res?.error || 'Aucune phrase trouvée pour ce mot' });
        }
      }
    } catch (err: any) {
      setRowGenerationError({ wordId: word.id, error: err.message || 'Erreur lors de la génération' });
    } finally {
      setGeneratingWordId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingWord || !editFrench.trim() || !editEnglish.trim()) return;

    const tags = editTags
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const hasExample = Boolean(editExample && editExample.trim());
    let sourceToSave: ExampleSourceType | undefined = undefined;
    if (hasExample) {
      if (editExampleSource) {
        sourceToSave = editExampleSource;
      } else if (editingWord.example === editExample.trim() && editingWord.exampleSource) {
        sourceToSave = editingWord.exampleSource;
      } else {
        sourceToSave = 'user';
      }
    }

    await updateWord({
      ...editingWord,
      french: editFrench.trim(),
      english: editEnglish.trim(),
      example: editExample.trim(),
      exampleSource: sourceToSave,
      tags,
      note: editNote.trim(),
      leitnerBox: editBox,
    });

    setEditingWord(null);
  };

  const handleDelete = async (id: string, french: string) => {
    if (window.confirm(`Supprimer définitivement le mot "${french}" ?`)) {
      await deleteWord(id);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    if (window.api) {
      const res = await window.api.exportWordsCsv(filteredWords);
      if (res.success) {
        setImportStatusMessage('Export CSV réussi !');
        setTimeout(() => setImportStatusMessage(null), 3000);
      }
    }
  };

  // Import CSV
  const handleImportCsv = async () => {
    if (window.api) {
      const res = await window.api.importWordsCsv();
      if (res.success && res.words && res.words.length > 0) {
        let addedCount = 0;
        for (const w of res.words) {
          if (w.french && w.english) {
            await addWord(
              {
                french: w.french,
                english: w.english,
                example: w.example,
                tags: w.tags,
                note: w.note,
              },
              true // Forcer l'ajout lors d'un import en lot
            );
            addedCount++;
          }
        }
        setImportStatusMessage(`${addedCount} mot(s) importé(s) depuis le CSV avec succès !`);
        setTimeout(() => setImportStatusMessage(null), 4000);
      }
    }
  };

  const getBoxBadgeStyle = (box: LeitnerBox) => {
    switch (box) {
      case 5:
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Boîte 5 (Maîtrisé)' };
      case 1:
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Boîte 1 (Nouveau)' };
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: `Boîte ${box} (En cours)` };
    }
  };

  return (
    <div
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        animation: 'fadeInScale 0.25s ease',
      }}
    >
      {/* En-tête avec Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Mes mots ({filteredWords.length} / {db.words.length})
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Consultez, filtrez et enrichissez votre dictionnaire personnel
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleImportCsv}
            title="Importer des mots depuis un fichier CSV"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Upload size={16} />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            title="Exporter les mots affichés au format CSV"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenQuickAdd}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              padding: '8px 18px',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Plus size={18} />
            <span>Ajouter un mot</span>
          </button>
        </div>
      </div>

      {/* Message de notification d'import/export */}
      {importStatusMessage && (
        <div
          style={{
            backgroundColor: 'var(--color-success-light)',
            border: '1px solid var(--color-success)',
            color: 'var(--color-success)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{importStatusMessage}</span>
        </div>
      )}

      {/* Barre de Recherche et Filtres */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {/* Recherche instantanée */}
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher en français, anglais, tags..."
            style={{ width: '100%', paddingLeft: '38px' }}
          />
        </div>

        {/* Filtre statut */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as any)}
          style={{ width: '100%' }}
        >
          <option value="all">Tous les statuts</option>
          <option value="new">Nouveaux (Boîte 1)</option>
          <option value="learning">En cours (Boîtes 2 à 4)</option>
          <option value="mastered">Maîtrisés (Boîte 5)</option>
        </select>

        {/* Filtre tag */}
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          style={{ width: '100%' }}
        >
          <option value="all">Tous les tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>

        {/* Filtre playlist */}
        <select
          value={selectedPlaylistId}
          onChange={(e) => setSelectedPlaylistId(e.target.value)}
          style={{ width: '100%' }}
        >
          <option value="all">Toutes les playlists</option>
          {db.playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tableau des Mots */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <th style={{ padding: '14px 20px' }}>Français</th>
              <th style={{ padding: '14px 20px' }}>Anglais</th>
              <th style={{ padding: '14px 20px' }}>Statut Leitner</th>
              <th style={{ padding: '14px 20px' }}>Catégories / Tags</th>
              <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWords.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Aucun mot ne correspond à votre recherche ou filtre.
                </td>
              </tr>
            ) : (
              filteredWords.map((w) => {
                const badge = getBoxBadgeStyle(w.leitnerBox);
                return (
                  <tr
                    key={w.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Français */}
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <div>{w.french}</div>
                      {w.example ? (
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 400,
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                          }}
                        >
                          <span style={{ fontStyle: 'italic' }}>« {w.example} »</span>
                          {w.exampleSource && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                backgroundColor:
                                  w.exampleSource === 'dictionary'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : w.exampleSource === 'api' || w.exampleSource === 'local_llm'
                                    ? 'rgba(6, 182, 212, 0.15)'
                                    : 'rgba(245, 158, 11, 0.15)',
                                color:
                                  w.exampleSource === 'dictionary'
                                    ? '#10b981'
                                    : w.exampleSource === 'api' || w.exampleSource === 'local_llm'
                                    ? '#06b6d4'
                                    : '#f59e0b',
                              }}
                            >
                              {w.exampleSource === 'dictionary'
                                ? '📖 Dictionnaire'
                                : w.exampleSource === 'api' || w.exampleSource === 'local_llm'
                                ? '✨ IA'
                                : '✍️ Ma phrase'}
                            </span>
                          )}

                          <button
                            onClick={() =>
                              speakText(w.example!, {
                                accent: db.settings.voiceAccent,
                                preferredVoiceId: db.settings.preferredVoiceId,
                                speed: db.settings.voiceSpeed || 1.0,
                              })
                            }
                            title="Écouter la phrase d'exemple"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <Volume2 size={12} />
                          </button>

                          <button
                            onClick={() => handleGenerateRowSentence(w, true)}
                            disabled={generatingWordId === w.id}
                            title="Régénérer cette phrase avec l'IA"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: generatingWordId === w.id ? 'not-allowed' : 'pointer',
                              padding: '2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <RotateCw size={12} className={generatingWordId === w.id ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: '4px' }}>
                          <button
                            onClick={() => handleGenerateRowSentence(w, false)}
                            disabled={generatingWordId === w.id}
                            style={{
                              background: 'rgba(99, 102, 241, 0.1)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              color: 'var(--color-primary)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: generatingWordId === w.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {generatingWordId === w.id ? (
                              <>
                                <RotateCw size={11} className="animate-spin" />
                                <span>Génération...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={11} />
                                <span>✨ Générer une phrase</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {rowGenerationError?.wordId === w.id && (
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '0.72rem',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{rowGenerationError.error}</span>
                          <button
                            onClick={() =>
                              openCentreIA(
                                rowGenerationError.error.toLowerCase().includes('clé') ||
                                  rowGenerationError.error.toLowerCase().includes('api')
                                  ? 'api_key'
                                  : 'sentences'
                              )
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--color-primary)',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                            }}
                          >
                            Centre IA ➔
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Anglais + audio */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{w.english}</span>
                        <button
                          onClick={() =>
                            speakWord(w.english, db.settings.voiceAccent, {
                              speed: db.settings.voiceSpeed,
                              preferredVoiceId: db.settings.preferredVoiceId,
                            })
                          }
                          title="Écouter la prononciation"
                          style={{
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Volume2 size={16} />
                        </button>
                      </div>
                    </td>

                    {/* Boîte Leitner */}
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          backgroundColor: badge.bg,
                          color: badge.color,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Tags */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(w.tags || []).map((t, idx) => (
                          <span
                            key={idx}
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                            }}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => handleOpenEdit(w)}
                          title="Modifier"
                          style={{
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            padding: '6px',
                            borderRadius: '6px',
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(w.id, w.french)}
                          title="Supprimer"
                          style={{
                            background: 'transparent',
                            color: 'var(--color-danger)',
                            padding: '6px',
                            borderRadius: '6px',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL MODIFICATION DE MOT */}
      {editingWord && (
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
            if (e.target === e.currentTarget) setEditingWord(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '560px',
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
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Modifier le mot</h3>
              <button
                onClick={() => setEditingWord(null)}
                style={{ background: 'transparent', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Français *
                  </label>
                  <input
                    type="text"
                    value={editFrench}
                    onChange={(e) => setEditFrench(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Anglais *
                  </label>
                  <input
                    type="text"
                    value={editEnglish}
                    onChange={(e) => setEditEnglish(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                      Phrase d'exemple
                    </label>
                    {editExampleSource && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor:
                            editExampleSource === 'dictionary'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(99, 102, 241, 0.15)',
                          color:
                            editExampleSource === 'dictionary'
                              ? '#10b981'
                              : 'var(--color-primary)',
                        }}
                      >
                        {editExampleSource === 'dictionary'
                          ? '📖 Source : dictionnaire'
                          : '✨ Générée par IA'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {editExample.trim() && (
                      <button
                        type="button"
                        onClick={handlePlayEditExample}
                        disabled={isPlayingEditAudio}
                        title="Écouter la phrase d'exemple"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <Volume2 size={13} />
                        <span>Écouter</span>
                      </button>
                    )}

                    {/* Bouton ✨ Générer une phrase */}
                    <button
                      type="button"
                      onClick={() => handleGenerateEditExample(false)}
                      disabled={!editEnglish.trim() || isGeneratingEditExample}
                      title={
                        !editEnglish.trim()
                          ? "Saisissez d'abord le mot en anglais"
                          : "Générer immédiatement une phrase d'exemple"
                      }
                      style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.22))',
                        border: '1px solid var(--color-primary)',
                        color: 'var(--color-primary)',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: !editEnglish.trim() || isGeneratingEditExample ? 'not-allowed' : 'pointer',
                        opacity: !editEnglish.trim() ? 0.6 : 1,
                      }}
                    >
                      {isGeneratingEditExample ? (
                        <>
                          <RotateCw size={13} className="animate-spin" />
                          <span>Génération en cours...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          <span>✨ Générer une phrase</span>
                        </>
                      )}
                    </button>

                    {/* Bouton ↻ Autre phrase */}
                    {editExample.trim() && (
                      <button
                        type="button"
                        onClick={() => handleGenerateEditExample(true)}
                        disabled={!editEnglish.trim() || isGeneratingEditExample}
                        title="Obtenir un autre exemple du dictionnaire ou de l'IA"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: !editEnglish.trim() || isGeneratingEditExample ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <RotateCw size={12} className={isGeneratingEditExample ? 'animate-spin' : ''} />
                        <span>↻ Autre phrase</span>
                      </button>
                    )}

                    {/* Bouton Annuler si génération en cours */}
                    {isGeneratingEditExample && (
                      <button
                        type="button"
                        onClick={handleCancelEditGenerate}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#ef4444',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Annuler
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  value={editExample}
                  onChange={(e) => {
                    setEditExample(e.target.value);
                    setEditExampleSource(undefined); // Le badge disparaît dès que l'utilisateur modifie
                    setEditGenerationError(null);
                  }}
                  placeholder="Ex : An apple a day keeps the doctor away. (ou cliquez sur ✨ Générer une phrase)"
                  style={{ width: '100%' }}
                />

                {/* Proposition en arrière-plan si une phrase IA arrive après le dictionnaire */}
                {editBackgroundOffer && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        💡 Une phrase IA de meilleure qualité est prête :
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditExample(editBackgroundOffer.sentence);
                            setEditExampleSource(editBackgroundOffer.source || 'api');
                            setEditBackgroundOffer(null);
                          }}
                          style={{
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Remplacer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditBackgroundOffer(null)}
                          style={{
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            border: 'none',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Ignorer
                        </button>
                      </div>
                    </div>
                    <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      « {editBackgroundOffer.sentence} »
                    </div>
                  </div>
                )}

                {/* Message d'erreur avec lien direct vers le Centre IA */}
                {editGenerationError && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                      <span>{editGenerationError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openCentreIA(
                          editGenerationError.toLowerCase().includes('clé') ||
                            editGenerationError.toLowerCase().includes('api')
                            ? 'api_key'
                            : 'sentences'
                        )
                      }
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-primary)',
                        textDecoration: 'underline',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Ouvrir le Centre IA ➔
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Tags (séparés par virgules)
                  </label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Boîte Leitner
                  </label>
                  <select
                    value={editBox}
                    onChange={(e) => setEditBox(Number(e.target.value) as LeitnerBox)}
                    style={{ width: '100%' }}
                  >
                    <option value={1}>Boîte 1 (Nouveau)</option>
                    <option value={2}>Boîte 2 (En cours)</option>
                    <option value={3}>Boîte 3 (En cours)</option>
                    <option value={4}>Boîte 4 (En cours)</option>
                    <option value={5}>Boîte 5 (Maîtrisé)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  Note mémo
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => setEditingWord(null)}
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
                onClick={handleSaveEdit}
                disabled={!editFrench.trim() || !editEnglish.trim()}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                }}
              >
                Enregistrer les modifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
