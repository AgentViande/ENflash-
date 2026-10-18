import { describe, it, expect } from 'vitest';
import { getLevelRank, checkRankEvolution, LEVEL_RANKS } from '../src/shared/gamification/levelRanks';

describe('Level Ranks System (Paliers évolutifs)', () => {
  it('identifie correctement le rang Débutant pour les niveaux 1 à 4', () => {
    const l1 = getLevelRank(1);
    expect(l1.tier.id).toBe('debutant');
    expect(l1.subStars).toBe(1);

    const l2 = getLevelRank(2);
    expect(l2.tier.id).toBe('debutant');
    expect(l2.subStars).toBe(2);

    const l4 = getLevelRank(4);
    expect(l4.tier.id).toBe('debutant');
    expect(l4.subStars).toBe(4);
  });

  it('gère parfaitement le passage frontière 4 -> 5 vers Bronze', () => {
    const l4 = getLevelRank(4);
    const l5 = getLevelRank(5);

    expect(l4.tier.id).toBe('debutant');
    expect(l5.tier.id).toBe('bronze');
    expect(l5.subStars).toBe(1);

    const evo = checkRankEvolution(4, 5);
    expect(evo.hasEvolved).toBe(true);
    expect(evo.oldTier.id).toBe('debutant');
    expect(evo.newTier.id).toBe('bronze');
  });

  it('identifie chaque palier de 1 à 50+', () => {
    expect(getLevelRank(5).tier.id).toBe('bronze');
    expect(getLevelRank(9).tier.id).toBe('bronze');
    expect(getLevelRank(10).tier.id).toBe('argent');
    expect(getLevelRank(14).tier.id).toBe('argent');
    expect(getLevelRank(15).tier.id).toBe('or');
    expect(getLevelRank(19).tier.id).toBe('or');
    expect(getLevelRank(20).tier.id).toBe('platine');
    expect(getLevelRank(29).tier.id).toBe('platine');
    expect(getLevelRank(30).tier.id).toBe('diamant');
    expect(getLevelRank(39).tier.id).toBe('diamant');
    expect(getLevelRank(40).tier.id).toBe('maitre');
    expect(getLevelRank(49).tier.id).toBe('maitre');
    expect(getLevelRank(50).tier.id).toBe('legende');
  });

  it('gère la transition Maître -> Légende (49 -> 50)', () => {
    const evo = checkRankEvolution(49, 50);
    expect(evo.hasEvolved).toBe(true);
    expect(evo.oldTier.id).toBe('maitre');
    expect(evo.newTier.id).toBe('legende');
  });

  it('ne déclenche pas d’évolution lors d’une montée sans changement de rang', () => {
    const evo = checkRankEvolution(5, 6);
    expect(evo.hasEvolved).toBe(false);
    expect(evo.oldTier.id).toBe('bronze');
    expect(evo.newTier.id).toBe('bronze');
  });

  it('gère les niveaux très élevés (100, 250) sans régression', () => {
    const l100 = getLevelRank(100);
    expect(l100.tier.id).toBe('legende');
    expect(l100.isMaxTier).toBe(true);
    expect(l100.subStars).toBe(4);

    const l250 = getLevelRank(250);
    expect(l250.tier.id).toBe('legende');
    expect(l250.subStars).toBe(4);
  });

  it('possède bien 8 rangs distincts et configurés', () => {
    expect(LEVEL_RANKS.length).toBe(8);
  });
});
