import React from 'react';
import { getLevelRank, RankTierDefinition } from '../../../shared/gamification/levelRanks';

export interface LevelBadgeProps {
  level: number;
  size?: number;
  showSubProgress?: boolean;
  silhouette?: boolean;
  animate?: boolean;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  size = 64,
  showSubProgress = true,
  silhouette = false,
  animate = true,
  className = '',
  onClick,
  style,
}) => {
  const { tier, subStars } = getLevelRank(level);
  const badgeId = `badge-${tier.id}-${Math.round(level)}-${Math.round(Math.random() * 10000)}`;

  // Définition des éléments SVG spécifiques par palier
  const renderRankShape = (tierDef: RankTierDefinition) => {
    switch (tierDef.id) {
      case 'debutant':
        // Écusson pierre / bois biseauté
        return (
          <g>
            <polygon
              points="50,6 88,22 82,78 50,94 18,78 12,22"
              fill={`url(#${badgeId}-grad)`}
              stroke={silhouette ? '#475569' : '#57534e'}
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <polygon
              points="50,14 80,27 75,72 50,86 25,72 20,27"
              fill={silhouette ? '#1e293b' : '#3f3f46'}
              opacity="0.8"
            />
            {/* Rivets bois / pierre */}
            <circle cx="50" cy="18" r="2" fill="#a8a29e" />
            <circle cx="74" cy="29" r="2" fill="#a8a29e" />
            <circle cx="26" cy="29" r="2" fill="#a8a29e" />
          </g>
        );

      case 'bronze':
        // Bouclier rond/ogival de bronze riveté
        return (
          <g>
            <path
              d="M50,8 C76,8 92,20 92,54 C92,76 74,88 50,95 C26,88 8,76 8,54 C8,20 24,8 50,8 Z"
              fill={`url(#${badgeId}-grad)`}
              stroke={silhouette ? '#475569' : '#78350f'}
              strokeWidth="3.5"
            />
            <path
              d="M50,15 C71,15 84,24 84,52 C84,70 70,80 50,86 C30,80 16,70 16,52 C16,24 29,15 50,15 Z"
              fill={silhouette ? '#1e293b' : '#92400e'}
              opacity="0.85"
            />
            {/* Clous d'airain décoratifs */}
            <circle cx="50" cy="13" r="2.5" fill="#fcd34d" />
            <circle cx="82" cy="50" r="2.5" fill="#fcd34d" />
            <circle cx="18" cy="50" r="2.5" fill="#fcd34d" />
            <circle cx="50" cy="88" r="2.5" fill="#fcd34d" />
          </g>
        );

      case 'argent':
        // Bouclier argenté aux ailes naissantes
        return (
          <g>
            {/* Ailes argentées */}
            {!silhouette && (
              <g fill="#94a3b8" opacity="0.9">
                <path d="M12,42 C4,28 6,14 18,10 C18,22 24,34 28,42 Z" />
                <path d="M88,42 C96,28 94,14 82,10 C82,22 76,34 72,42 Z" />
                <path d="M8,54 C2,44 4,32 14,28 C15,38 20,48 24,56 Z" />
                <path d="M92,54 C98,44 96,32 86,28 C85,38 80,48 76,56 Z" />
              </g>
            )}
            {/* Bouclier central */}
            <path
              d="M50,10 L80,24 L76,64 L50,92 L24,64 L20,24 Z"
              fill={`url(#${badgeId}-grad)`}
              stroke={silhouette ? '#475569' : '#cbd5e1'}
              strokeWidth="3"
            />
            <path
              d="M50,18 L73,29 L70,60 L50,83 L30,60 L27,29 Z"
              fill={silhouette ? '#1e293b' : '#475569'}
              opacity="0.8"
            />
          </g>
        );

      case 'or':
        // Bouclier doré avec couronne de lauriers
        return (
          <g>
            {/* Couronne de lauriers */}
            {!silhouette && (
              <g fill="#eab308" opacity="0.95">
                {/* Feuilles gauches */}
                <path d="M14,30 Q22,32 20,22 Q14,24 14,30 Z" />
                <path d="M10,44 Q18,46 18,36 Q10,38 10,44 Z" />
                <path d="M12,58 Q20,58 20,48 Q12,50 12,58 Z" />
                <path d="M18,72 Q24,68 26,60 Q18,64 18,72 Z" />
                {/* Feuilles droites */}
                <path d="M86,30 Q78,32 80,22 Q86,24 86,30 Z" />
                <path d="M90,44 Q82,46 82,36 Q90,38 90,44 Z" />
                <path d="M88,58 Q80,58 80,48 Q88,50 88,58 Z" />
                <path d="M82,72 Q76,68 74,60 Q82,64 82,72 Z" />
              </g>
            )}
            {/* Bouclier doré orné */}
            <path
              d="M50,6 L82,18 L78,66 L50,94 L22,66 L18,18 Z"
              fill={`url(#${badgeId}-grad)`}
              stroke={silhouette ? '#475569' : '#fef08a'}
              strokeWidth="3"
            />
            <path
              d="M50,14 L74,24 L70,61 L50,85 L30,61 L26,24 Z"
              fill={silhouette ? '#1e293b' : '#854d0e'}
              opacity="0.75"
            />
            {/* Diadème haut */}
            <polygon points="50,10 56,20 44,20" fill="#fef08a" />
          </g>
        );

      case 'platine':
        // Étoile / hexagone acéré aux facettes platine & cyan
        return (
          <g>
            {/* Étoile de fond 4 branches */}
            {!silhouette && (
              <polygon
                points="50,2 60,38 98,50 60,62 50,98 40,62 2,50 40,38"
                fill="#0891b2"
                opacity="0.45"
              />
            )}
            {/* Écusson hexagone facetté */}
            <polygon
              points="50,10 84,28 84,72 50,90 16,72 16,28"
              fill={`url(#${badgeId}-grad)`}
              stroke={silhouette ? '#475569' : '#a5f3fc'}
              strokeWidth="3.5"
            />
            <polygon
              points="50,17 78,32 78,68 50,83 22,68 22,32"
              fill={silhouette ? '#1e293b' : '#155e75'}
              opacity="0.8"
            />
            {/* Rayons internes */}
            <line x1="50" y1="17" x2="50" y2="83" stroke="#a5f3fc" strokeWidth="1.5" opacity="0.6" />
            <line x1="22" y1="32" x2="78" y2="68" stroke="#a5f3fc" strokeWidth="1" opacity="0.4" />
            <line x1="22" y1="68" x2="78" y2="32" stroke="#a5f3fc" strokeWidth="1" opacity="0.4" />
          </g>
        );

      case 'diamant':
        // Gemme cristalline octogonale étincelante
        return (
          <g>
            {/* Éclats de cristal étincelants */}
            {!silhouette && (
              <g fill="#c084fc" opacity="0.75">
                <polygon points="50,0 54,12 50,16 46,12" />
                <polygon points="100,50 88,54 84,50 88,46" />
                <polygon points="50,100 46,88 50,84 54,88" />
                <polygon points="0,50 12,46 16,50 12,54" />
              </g>
            )}
            {/* Corps du diamant */}
            <polygon
              points="32,10 68,10 90,32 90,68 68,90 32,90 10,68 10,32"
              fill={`url(#${badgeId}-grad)`}
              stroke={silhouette ? '#475569' : '#f3e8ff'}
              strokeWidth="3"
            />
            <polygon
              points="35,16 65,16 84,35 84,65 65,84 35,84 16,65 16,35"
              fill={silhouette ? '#1e293b' : '#581c87'}
              opacity="0.85"
            />
            {/* Facettes géométriques du diamant */}
            <polygon points="35,16 65,16 50,34" fill="#e9d5ff" opacity="0.4" />
            <polygon points="65,16 84,35 66,50" fill="#c084fc" opacity="0.3" />
            <polygon points="35,16 16,35 34,50" fill="#c084fc" opacity="0.3" />
            <polygon points="50,66 65,84 35,84" fill="#7e22ce" opacity="0.5" />
          </g>
        );

      case 'maitre':
        // Emblème runique arcanique à cornes/flammes
        return (
          <g>
            {/* Aura mystique flamboyante */}
            {!silhouette && (
              <path
                d="M50,2 C70,2 96,16 96,44 C96,74 76,96 50,98 C24,96 4,74 4,44 C4,16 30,2 50,2 Z"
                fill="none"
                stroke="url(#aura-glow)"
                strokeWidth="2.5"
                opacity="0.6"
                strokeDasharray="4 2"
              />
            )}
            {/* Cornes runiques supérieures */}
            {!silhouette && (
              <g fill="#f43f5e" opacity="0.85">
                <path d="M28,16 Q18,4 8,8 Q12,24 24,24 Z" />
                <path d="M72,16 Q82,4 92,8 Q88,24 76,24 Z" />
              </g>
            )}
            {/* Emblème maître */}
            <polygon
              points="50,8 86,24 92,60 50,94 8,60 14,24"
              fill={`url(#${badgeId}-grad)`}
              stroke={silhouette ? '#475569' : '#fecdd3'}
              strokeWidth="3.5"
            />
            <polygon
              points="50,16 80,30 84,57 50,85 16,57 20,30"
              fill={silhouette ? '#1e293b' : '#881337'}
              opacity="0.85"
            />
            {/* Orbe mystique intérieur */}
            <circle cx="50" cy="50" r="26" fill="#be123c" opacity="0.7" stroke="#fecdd3" strokeWidth="1.5" />
          </g>
        );

      case 'legende':
        // Badge mythique suprême : anneaux cosmiques et rayons stellaires
        return (
          <g>
            {/* Anneau cosmique d'énergie */}
            {!silhouette && (
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke={`url(#${badgeId}-grad)`}
                strokeWidth="2"
                strokeDasharray="6 3"
                opacity="0.85"
              />
            )}
            {/* Couronne astrale 8 branches */}
            {!silhouette && (
              <polygon
                points="50,4 62,20 80,10 76,30 96,38 82,52 94,68 76,74 76,94 58,86 50,98 42,86 24,94 24,74 6,68 18,52 4,38 24,30 20,10 38,20"
                fill="#ec4899"
                opacity="0.4"
              />
            )}
            {/* Écusson céleste central */}
            <polygon
              points="50,10 82,24 88,64 50,92 12,64 18,24"
              fill={`url(#${badgeId}-grad)`}
              stroke={silhouette ? '#475569' : '#fdf4ff'}
              strokeWidth="3.5"
            />
            <polygon
              points="50,17 76,29 81,60 50,84 19,60 24,29"
              fill={silhouette ? '#1e293b' : '#4c1d95'}
              opacity="0.9"
            />
            {/* Noyau lumineux prismatique */}
            <circle cx="50" cy="50" r="25" fill="#7c3aed" opacity="0.85" stroke="#fdf4ff" strokeWidth="2" />
          </g>
        );
    }
  };

  // Rendu des étoiles de sous-progression (1 à 4)
  const renderSubStars = () => {
    if (!showSubProgress || silhouette) return null;
    const starCount = Math.min(4, Math.max(1, subStars));
    const starSpacing = 10;
    const startX = 50 - ((starCount - 1) * starSpacing) / 2;

    return (
      <g className="level-badge-stars">
        {Array.from({ length: starCount }).map((_, idx) => {
          const cx = startX + idx * starSpacing;
          const cy = 76;
          return (
            <g key={idx}>
              {/* Petite étoile vectorielle */}
              <polygon
                points={`${cx},${cy - 4} ${cx + 1.2},${cy - 1.2} ${cx + 4},${cy - 1.2} ${cx + 1.8},${cy + 0.8} ${cx + 2.5},${cy + 3.8} ${cx},${cy + 2} ${cx - 2.5},${cy + 3.8} ${cx - 1.8},${cy + 0.8} ${cx - 4},${cy - 1.2} ${cx - 1.2},${cy - 1.2}`}
                fill="#fef08a"
                stroke="#ca8a04"
                strokeWidth="0.6"
              />
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div
      className={`level-badge-container ${tier.id} ${animate ? 'badge-animated' : ''} ${className}`}
      onClick={onClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        filter: silhouette ? 'grayscale(1) brightness(0.5)' : undefined,
        ...style,
      }}
      title={`Niveau ${level} - Rang ${tier.name} (${subStars}/4 étoiles)`}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{
          overflow: 'visible',
          filter: silhouette ? 'none' : `drop-shadow(0 4px 10px ${tier.glowColor})`,
        }}
      >
        <defs>
          <linearGradient id={`${badgeId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={silhouette ? '#475569' : tier.gradientColors[0]} />
            <stop offset="50%" stopColor={silhouette ? '#334155' : tier.gradientColors[1]} />
            <stop offset="100%" stopColor={silhouette ? '#1e293b' : tier.gradientColors[2]} />
          </linearGradient>

          <linearGradient id="aura-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        {/* Forme du palier */}
        {renderRankShape(tier)}

        {/* Numéro du niveau au centre */}
        <text
          x="50"
          y={showSubProgress ? '53' : '56'}
          textAnchor="middle"
          dominantBaseline="central"
          fill={silhouette ? '#94a3b8' : '#ffffff'}
          fontWeight="900"
          fontSize={level >= 100 ? '22' : level >= 10 ? '26' : '30'}
          fontFamily="system-ui, -apple-system, sans-serif"
          style={{
            letterSpacing: '-0.04em',
            textShadow: silhouette ? 'none' : '0 2px 4px rgba(0,0,0,0.6)',
            userSelect: 'none',
          }}
        >
          {silhouette ? '?' : level}
        </text>

        {/* Sous-progression (étoiles) */}
        {renderSubStars()}
      </svg>
    </div>
  );
};
