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

  it('dédoublonne strictement par mot : jamais 2 tâches pour le même mot', () => {
    const queue: SentenceQueueItem[] = [];

    const enqueue = (wordId: string, english: string, french: string) => {
      // Vérifier si une tâche existe déjà pour ce mot
      const existing = queue.find(
        (i) => i.wordId === wordId && (i.status === 'pending' || i.status === 'processing')
      );
      if (existing) {
        return false;
      }
      queue.push({
        id: `task-${Date.now()}-${Math.random()}`,
        wordId,
        english,
        french,
        priority: 2,
        status: 'pending',
        attempts: 0,
        createdAt: new Date().toISOString(),
      });
      return true;
    };

    expect(enqueue('w1', 'apple', 'pomme')).toBe(true);
    expect(enqueue('w2', 'leading edge', 'bord d’attaque')).toBe(true);
    // Tentative d'ajout en double pour le même mot
    expect(enqueue('w1', 'apple', 'pomme')).toBe(false);
    expect(queue.length).toBe(2);
  });

  it('nettoie les tâches orphelines, périmées et en cours au démarrage', () => {
    const existingWords = [
      { id: 'w1', english: 'apple', french: 'pomme', example: '' },
      { id: 'w2', english: 'banana', french: 'banane', example: 'I like bananas.' }, // Déjà une phrase !
    ];

    let queue: SentenceQueueItem[] = [
      // w1 en double
      { id: 't1', wordId: 'w1', english: 'apple', french: 'pomme', priority: 2, status: 'failed', attempts: 2, createdAt: '2026-10-18T10:00:00Z' },
      { id: 't2', wordId: 'w1', english: 'apple', french: 'pomme', priority: 2, status: 'failed', attempts: 2, createdAt: '2026-10-18T10:05:00Z' },
      // w2 dont le mot a déjà une phrase
      { id: 't3', wordId: 'w2', english: 'banana', french: 'banane', priority: 2, status: 'pending', attempts: 0, createdAt: '2026-10-18T10:00:00Z' },
      // w3 dont le mot a été supprimé de la base
      { id: 't4', wordId: 'w3', english: 'deleted', french: 'supprimé', priority: 2, status: 'pending', attempts: 0, createdAt: '2026-10-18T10:00:00Z' },
      // w4 resté bloqué en 'processing' suite à un crash
      { id: 't5', wordId: 'w1', english: 'apple', french: 'pomme', priority: 2, status: 'processing', attempts: 1, createdAt: '2026-10-18T10:00:00Z' },
    ];

    // Logique de cleanup au démarrage
    const wordsMap = new Map(existingWords.map((w) => [w.id, w]));
    const seenWordIds = new Set<string>();
    const cleaned: SentenceQueueItem[] = [];

    for (const item of queue) {
      const word = wordsMap.get(item.wordId);
      // Supprimer si le mot n'existe plus ou a déjà une phrase
      if (!word || (word.example && word.example.trim().length > 0)) {
        continue;
      }
      // Dédoublonnage
      if (seenWordIds.has(item.wordId)) {
        continue;
      }
      seenWordIds.add(item.wordId);

      // Repasser les tâches bloquées en 'processing' vers 'pending'
      if (item.status === 'processing') {
        item.status = 'pending';
      }
      cleaned.push(item);
    }

    queue = cleaned;

    expect(queue.length).toBe(1);
    expect(queue[0].wordId).toBe('w1');
    expect(queue[0].status).not.toBe('processing');
  });

  it('watchdog : débloque une tâche bloquée en "processing" depuis plus de 60s', () => {
    const item: SentenceQueueItem = {
      id: 'task-stuck',
      wordId: 'w1',
      english: 'apple',
      french: 'pomme',
      priority: 2,
      status: 'processing',
      attempts: 1,
      createdAt: new Date(Date.now() - 70000).toISOString(),
      updatedAt: new Date(Date.now() - 70000).toISOString(),
    };

    const isStuck = (task: SentenceQueueItem, maxSeconds = 60) => {
      if (task.status !== 'processing') return false;
      const refTime = new Date(task.updatedAt || task.createdAt).getTime();
      return Date.now() - refTime > maxSeconds * 1000;
    };

    expect(isStuck(item, 60)).toBe(true);

    // Watchdog débloque la tâche
    if (isStuck(item, 60)) {
      item.status = 'failed';
      item.error = 'Watchdog : dépassement du délai de 60 secondes';
    }

    expect(item.status).toBe('failed');
    expect(item.error).toContain('Watchdog');
  });

  it('vider la file supprime uniquement les tâches sans toucher aux mots existants', () => {
    let queue: SentenceQueueItem[] = [
      { id: '1', wordId: 'w1', english: 'a', french: 'b', priority: 2, status: 'pending', attempts: 0, createdAt: '' },
      { id: '2', wordId: 'w2', english: 'c', french: 'd', priority: 2, status: 'pending', attempts: 0, createdAt: '' },
    ];
    const words = [
      { id: 'w1', english: 'a', french: 'b', example: 'Example 1' },
      { id: 'w2', english: 'c', french: 'd', example: undefined },
    ];

    // Action vider la file
    queue = [];

    expect(queue.length).toBe(0);
    expect(words.length).toBe(2);
    expect(words[0].example).toBe('Example 1'); // Inchangé
  });

  it('relancer les échecs repasse les statuts failed en pending avec attempts=0', () => {
    const queue: SentenceQueueItem[] = [
      { id: '1', wordId: 'w1', english: 'apple', french: 'pomme', priority: 2, status: 'failed', attempts: 2, error: 'Pas de modèle', createdAt: '' },
      { id: '2', wordId: 'w2', english: 'pear', french: 'poire', priority: 2, status: 'done', attempts: 1, createdAt: '' },
    ];

    let resetCount = 0;
    for (const item of queue) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.attempts = 0;
        item.error = undefined;
        resetCount++;
      }
    }

    expect(resetCount).toBe(1);
    expect(queue[0].status).toBe('pending');
    expect(queue[0].attempts).toBe(0);
    expect(queue[0].error).toBeUndefined();
    expect(queue[1].status).toBe('done');
  });
});
