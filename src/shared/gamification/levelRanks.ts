/**
 * Configuration et paliers des Rangs de Niveau pour ENflash
 * 8 rangs évolutifs avec sous-progression de 1 à 4 étoiles/chevrons
 */

export interface RankTierDefinition {
  id: 'debutant' | 'bronze' | 'argent' | 'or' | 'platine' | 'diamant' | 'maitre' | 'legende';
  name: string;
  minLevel: number;
  maxLevel: number; // Pour Légende : Infinity
  subtitle: string;
  description: string;
  themeColor: string;
  glowColor: string;
  gradientColors: [string, string, string];
}

export const LEVEL_RANKS: RankTierDefinition[] = [
  {
    id: 'debutant',
    name: 'Débutant',
    minLevel: 1,
    maxLevel: 4,
    subtitle: 'Écusson de bois et de pierre',
    description: 'Vos premiers pas dans l’apprentissage du vocabulaire anglais.',
    themeColor: '#78716c',
    glowColor: 'rgba(120, 113, 108, 0.4)',
    gradientColors: ['#a8a29e', '#78716c', '#57534e'],
  },
  {
    id: 'bronze',
    name: 'Bronze',
    minLevel: 5,
    maxLevel: 9,
    subtitle: 'Bouclier de bronze forgé',
    description: 'Une régularité solide commence à porter ses fruits.',
    themeColor: '#d97706',
    glowColor: 'rgba(217, 119, 6, 0.45)',
    gradientColors: ['#f59e0b', '#d97706', '#b45309'],
  },
  {
    id: 'argent',
    name: 'Argent',
    minLevel: 10,
    maxLevel: 14,
    subtitle: 'Bouclier argenté aux ailes naissantes',
    description: 'Votre vocabulaire prend son envol avec élégance et assurance.',
    themeColor: '#94a3b8',
    glowColor: 'rgba(148, 163, 184, 0.5)',
    gradientColors: ['#e2e8f0', '#94a3b8', '#64748b'],
  },
  {
    id: 'or',
    name: 'Or',
    minLevel: 15,
    maxLevel: 19,
    subtitle: 'Bouclier doré couronné de lauriers',
    description: 'Une maîtrise éclatante qui force le respect.',
    themeColor: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.55)',
    gradientColors: ['#fef08a', '#eab308', '#ca8a04'],
  },
  {
    id: 'platine',
    name: 'Platine',
    minLevel: 20,
    maxLevel: 29,
    subtitle: 'Écusson de platine aux reflets froids et étoiles',
    description: 'Une précision chirurgicale et une régularité à toute épreuve.',
    themeColor: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.55)',
    gradientColors: ['#a5f3fc', '#06b6d4', '#0891b2'],
  },
  {
    id: 'diamant',
    name: 'Diamant',
    minLevel: 30,
    maxLevel: 39,
    subtitle: 'Gemme cristalline aux éclats chatoyants',
    description: 'Un esprit vif et limpide taillé par des centaines de répétitions.',
    themeColor: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.6)',
    gradientColors: ['#e9d5ff', '#a855f7', '#7e22ce'],
  },
  {
    id: 'maitre',
    name: 'Maître',
    minLevel: 40,
    maxLevel: 49,
    subtitle: 'Emblème arcanique à l’aura flamboyante',
    description: 'Le dictionnaire n’a presque plus de secrets pour vous.',
    themeColor: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.65)',
    gradientColors: ['#fecdd3', '#f43f5e', '#be123c'],
  },
  {
    id: 'legende',
    name: 'Légende',
    minLevel: 50,
    maxLevel: Infinity,
    subtitle: 'Badge mythique cosmique aux énergies prismatiques',
    description: 'L’apogée de l’apprentissage. Une véritable référence d’érudition.',
    themeColor: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.75)',
    gradientColors: ['#fdf4ff', '#ec4899', '#8b5cf6'],
  },
];

export interface LevelRankInfo {
  tier: RankTierDefinition;
  level: number;
  subStars: number; // 1 à 4
  isMaxTier: boolean;
  progressInTierPercent: number;
}

/**
 * Calcule le rang correspondant à un niveau donné ainsi que la sous-progression (1 à 4 étoiles)
 */
export function getLevelRank(levelInput: number): LevelRankInfo {
  const level = Math.max(1, Math.floor(levelInput || 1));
  const tier = LEVEL_RANKS.find((r) => level >= r.minLevel && level <= r.maxLevel) || LEVEL_RANKS[LEVEL_RANKS.length - 1];

  let subStars = 1;
  let progressInTierPercent = 100;

  if (tier.maxLevel === Infinity) {
    // Rang Légende : 4 étoiles garanties dès le niveau 50
    subStars = Math.min(4, 1 + Math.floor((level - 50) / 10));
    progressInTierPercent = Math.min(100, Math.round(((level - 50) % 10) * 10));
  } else {
    const range = tier.maxLevel - tier.minLevel + 1;
    const offset = level - tier.minLevel;
    // Répartit les niveaux du palier sur 1..4 étoiles
    subStars = Math.min(4, Math.max(1, Math.floor((offset / range) * 4) + 1));
    progressInTierPercent = Math.min(100, Math.round((offset / range) * 100));
  }

  return {
    tier,
    level,
    subStars,
    isMaxTier: tier.id === 'legende',
    progressInTierPercent,
  };
}

/**
 * Détecte si un passage de niveau entraîne une évolution de rang
 */
export function checkRankEvolution(oldLevel: number, newLevel: number): {
  hasEvolved: boolean;
  oldTier: RankTierDefinition;
  newTier: RankTierDefinition;
} {
  const oldRank = getLevelRank(oldLevel);
  const newRank = getLevelRank(newLevel);

  return {
    hasEvolved: oldRank.tier.id !== newRank.tier.id && newLevel > oldLevel,
    oldTier: oldRank.tier,
    newTier: newRank.tier,
  };
}
