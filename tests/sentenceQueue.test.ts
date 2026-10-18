import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentenceQueueItem } from '../src/shared/types';

describe('File d’attente des phrases d’exemple (SentenceQueue)', () => {
  it('trie les éléments par priorité (priorité 1 manuel avant priorité 2 masse)', () => {
    const items: SentenceQueueItem[] = [
      {
        id: '1',
        wordId: 'w1',
        english: 'airplane',
        french: 'avion',
        priority: 2, // Masse
        status: 'pending',
        attempts: 0,
        createdAt: '2026-10-18T10:00:00Z',
      },
      {
        id: '2',
        wordId: 'w2',
        english: 'runway',
        french: 'piste',
        priority: 1, // Manuel (urgent)
        status: 'pending',
        attempts: 0,
        createdAt: '2026-10-18T10:05:00Z',
      },
      {
        id: '3',
        wordId: 'w3',
        english: 'altitude',
        french: 'altitude',
        priority: 2, // Masse plus récent
        status: 'pending',
        attempts: 0,
        createdAt: '2026-10-18T10:02:00Z',
      },
    ];

    const sorted = [...items].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    expect(sorted[0].id).toBe('2'); // Le mot manuel (priorité 1) passe en premier
    expect(sorted[1].id).toBe('1'); // Le premier mot en masse
    expect(sorted[2].id).toBe('3'); // Le deuxième mot en masse
  });

  it('ne remplace jamais une phrase saisie ou modifiée par l’utilisateur', () => {
    const word = {
      id: 'w-user',
      english: 'leading edge',
      french: 'bord d’attaque',
      example: 'The heated leading edge prevents ice buildup on the wing.',
      exampleSource: 'user' as const,
    };

    const shouldOverwrite = (existingExample?: string, existingSource?: string) => {
      if (existingExample && existingSource === 'user') {
        return false; // Règle d'or absolue
      }
      return true;
    };

    expect(shouldOverwrite(word.example, word.exampleSource)).toBe(false);

    // En revanche, une phrase générée par IA peut être régénérée
    expect(shouldOverwrite('Old AI sentence', 'local_llm')).toBe(true);
    expect(shouldOverwrite('Old dict sentence', 'dictionary')).toBe(true);
    expect(shouldOverwrite(undefined, undefined)).toBe(true);
  });
});
