import { VoiceAccent } from '../types';

export interface KokoroVoiceDefinition {
  id: string;
  name: string;
  accent: VoiceAccent;
  gender: 'female' | 'male';
  grade: string;
  label: string;
  description: string;
  isDefault?: boolean;
}

export const AVAILABLE_KOKORO_VOICES: KokoroVoiceDefinition[] = [
  // Voix américaines (US)
  {
    id: 'af_heart',
    name: 'Heart',
    accent: 'en-US',
    gender: 'female',
    grade: 'A',
    label: 'Heart (US Féminin ⭐⭐⭐)',
    description: 'Voix américaine la plus naturelle et expressive (Recommandée)',
    isDefault: true,
  },
  {
    id: 'af_bella',
    name: 'Bella',
    accent: 'en-US',
    gender: 'female',
    grade: 'A-',
    label: 'Bella (US Féminin)',
    description: 'Voix dynamique et claire',
  },
  {
    id: 'af_nicole',
    name: 'Nicole',
    accent: 'en-US',
    gender: 'female',
    grade: 'B-',
    label: 'Nicole (US Féminin)',
    description: 'Voix douce et posée',
  },
  {
    id: 'am_michael',
    name: 'Michael',
    accent: 'en-US',
    gender: 'male',
    grade: 'B+',
    label: 'Michael (US Masculin)',
    description: 'Voix masculine naturelle et assurée',
  },
  {
    id: 'am_adam',
    name: 'Adam',
    accent: 'en-US',
    gender: 'male',
    grade: 'C',
    label: 'Adam (US Masculin)',
    description: 'Voix masculine posée',
  },

  // Voix britanniques (UK)
  {
    id: 'bf_emma',
    name: 'Emma',
    accent: 'en-GB',
    gender: 'female',
    grade: 'B-',
    label: 'Emma (UK Féminin ⭐⭐⭐)',
    description: 'Voix britannique élégante et distinguée (Recommandée)',
    isDefault: true,
  },
  {
    id: 'bf_isabella',
    name: 'Isabella',
    accent: 'en-GB',
    gender: 'female',
    grade: 'C',
    label: 'Isabella (UK Féminin)',
    description: 'Voix britannique vivante',
  },
  {
    id: 'bm_george',
    name: 'George',
    accent: 'en-GB',
    gender: 'male',
    grade: 'C',
    label: 'George (UK Masculin)',
    description: 'Voix britannique masculine classique',
  },
  {
    id: 'bm_lewis',
    name: 'Lewis',
    accent: 'en-GB',
    gender: 'male',
    grade: 'C',
    label: 'Lewis (UK Masculin)',
    description: 'Voix britannique masculine profonde',
  },
];

export function getDefaultVoiceForAccent(accent: VoiceAccent): string {
  if (accent === 'en-GB') return 'bf_emma';
  return 'af_heart';
}
