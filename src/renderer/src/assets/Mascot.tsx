import React from 'react';

export type MascotMood = 'happy' | 'celebrate' | 'thinking' | 'encourage' | 'sad';

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
}

export const Mascot: React.FC<MascotProps> = ({
  mood = 'happy',
  size = 120,
  className = '',
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 8px rgba(99,102,241,0.25))' }}
      >
        <defs>
          <linearGradient id="bodyGrad" x1="40" y1="20" x2="160" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="0.5" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#EC4899" />
          </linearGradient>
          <linearGradient id="bellyGrad" x1="70" y1="100" x2="130" y2="170" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDF2F8" />
            <stop offset="1" stopColor="#F5D0FE" />
          </linearGradient>
          <linearGradient id="lightningGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FDE047" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Éclairs d'énergie pour humeur celebrate */}
        {mood === 'celebrate' && (
          <g className="animate-pulse">
            <path d="M30 40 L45 25 L40 45 L55 35" stroke="url(#lightningGrad)" strokeWidth="3" strokeLinecap="round" />
            <path d="M170 40 L155 25 L160 45 L145 35" stroke="url(#lightningGrad)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="35" cy="70" r="3" fill="#FDE047" />
            <circle cx="165" cy="70" r="3" fill="#FDE047" />
          </g>
        )}

        {/* Oreilles pointues ailées */}
        <path
          d="M60 70 L40 25 Q65 30 78 58 Z"
          fill="url(#bodyGrad)"
          stroke="#4F46E5"
          strokeWidth="3"
        />
        <path
          d="M50 40 L65 55"
          stroke="#F472B6"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M140 70 L160 25 Q135 30 122 58 Z"
          fill="url(#bodyGrad)"
          stroke="#4F46E5"
          strokeWidth="3"
        />
        <path
          d="M150 40 L135 55"
          stroke="#F472B6"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Corps rond & pelucheux */}
        <circle
          cx="100"
          cy="110"
          r="68"
          fill="url(#bodyGrad)"
          stroke="#4338CA"
          strokeWidth="4"
        />

        {/* Ventre blanc rosé */}
        <ellipse
          cx="100"
          cy="125"
          rx="42"
          ry="38"
          fill="url(#bellyGrad)"
        />

        {/* Éclair frontal emblématique */}
        <path
          d="M95 52 L106 66 L98 68 L104 82 L90 70 L98 68 Z"
          fill="url(#lightningGrad)"
          stroke="#D97706"
          strokeWidth="1.5"
        />

        {/* Yeux selon l'humeur */}
        {mood === 'celebrate' ? (
          // Yeux plissés de joie
          <g>
            <path d="M72 100 Q84 88 94 100" stroke="#1E1B4B" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M106 100 Q116 88 128 100" stroke="#1E1B4B" strokeWidth="5" strokeLinecap="round" fill="none" />
          </g>
        ) : mood === 'thinking' ? (
          // Un œil grand ouvert, un œil plus concentré
          <g>
            <circle cx="82" cy="98" r="9" fill="#1E1B4B" />
            <circle cx="80" cy="95" r="3" fill="#FFFFFF" />
            <path d="M108 98 Q118 92 126 98" stroke="#1E1B4B" strokeWidth="5" strokeLinecap="round" fill="none" />
          </g>
        ) : mood === 'sad' ? (
          // Yeux doux encourageants
          <g>
            <circle cx="80" cy="100" r="8" fill="#1E1B4B" />
            <circle cx="120" cy="100" r="8" fill="#1E1B4B" />
            <circle cx="82" cy="98" r="3" fill="#FFFFFF" />
            <circle cx="122" cy="98" r="3" fill="#FFFFFF" />
          </g>
        ) : (
          // Yeux grands ouverts pétillants (happy & encourage)
          <g>
            <circle cx="80" cy="98" r="10" fill="#1E1B4B" />
            <circle cx="120" cy="98" r="10" fill="#1E1B4B" />
            <circle cx="77" cy="94" r="4" fill="#FFFFFF" />
            <circle cx="117" cy="94" r="4" fill="#FFFFFF" />
            <circle cx="83" cy="101" r="2" fill="#FFFFFF" />
            <circle cx="123" cy="101" r="2" fill="#FFFFFF" />
          </g>
        )}

        {/* Joues roses mignonnes */}
        <ellipse cx="68" cy="112" rx="7" ry="4" fill="#F472B6" opacity="0.75" />
        <ellipse cx="132" cy="112" rx="7" ry="4" fill="#F472B6" opacity="0.75" />

        {/* Petit nez */}
        <polygon points="100,107 96,103 104,103" fill="#312E81" />

        {/* Bouche selon l'humeur */}
        {mood === 'celebrate' || mood === 'happy' ? (
          <path
            d="M93 112 Q100 122 107 112"
            stroke="#1E1B4B"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="#EF4444"
          />
        ) : mood === 'thinking' ? (
          <ellipse cx="100" cy="114" rx="3" ry="4" fill="#1E1B4B" />
        ) : mood === 'sad' ? (
          <path
            d="M94 116 Q100 110 106 116"
            stroke="#1E1B4B"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M95 112 Q100 118 105 112"
            stroke="#1E1B4B"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Petites ailes latérales d'éclair */}
        <path
          d="M36 115 Q18 118 22 135 Q35 130 46 122 Z"
          fill="#8B5CF6"
          stroke="#4338CA"
          strokeWidth="2"
        />
        <path
          d="M164 115 Q182 118 178 135 Q165 130 154 122 Z"
          fill="#8B5CF6"
          stroke="#4338CA"
          strokeWidth="2"
        />

        {/* Petits pieds mignons */}
        <ellipse cx="78" cy="172" rx="14" ry="7" fill="#4338CA" />
        <ellipse cx="122" cy="172" rx="14" ry="7" fill="#4338CA" />
      </svg>
    </div>
  );
};
