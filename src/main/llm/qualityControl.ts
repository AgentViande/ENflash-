import { SentenceQualityResult } from '../../shared/types';

/**
 * Génère les variantes morphologiques courantes d'un mot ou d'une expression anglaise
 * (pluriel, -s, -es, -ed, -ing, etc.)
 */
export function getWordVariants(targetWord: string): string[] {
  const clean = targetWord.trim().toLowerCase();
  if (!clean) return [];

  const variants = new Set<string>();
  variants.add(clean);

  // Expression composée (ex: "leading edge", "take off")
  if (clean.includes(' ')) {
    const parts = clean.split(/\s+/);
    // Pluriel sur le dernier mot (ex: "leading edges")
    const lastWord = parts[parts.length - 1];
    const rest = parts.slice(0, parts.length - 1).join(' ');
    variants.add(`${rest} ${lastWord}s`);
    variants.add(`${rest} ${lastWord}es`);
    if (lastWord.endsWith('y') && !/[aeiou]y$/.test(lastWord)) {
      variants.add(`${rest} ${lastWord.slice(0, -1)}ies`);
    }
    return Array.from(variants);
  }

  // Mot simple : formes régulières
  variants.add(`${clean}s`);
  variants.add(`${clean}es`);
  variants.add(`${clean}d`);
  variants.add(`${clean}ed`);
  variants.add(`${clean}ing`);

  // Terminaison en 'e' (ex: "take" -> "taking", "taked")
  if (clean.endsWith('e')) {
    variants.add(`${clean.slice(0, -1)}ing`);
    variants.add(`${clean.slice(0, -1)}ed`);
  }

  // Terminaison en 'y' précédé d'une consonne (ex: "fly" -> "flies", "flier", "flying")
  if (clean.endsWith('y') && !/[aeiou]y$/.test(clean)) {
    const root = clean.slice(0, -1);
    variants.add(`${root}ies`);
    variants.add(`${root}ied`);
  }

  // Doublement de consonne (ex: "stop" -> "stopped", "stopping")
  if (/^[a-z]+[bcdfghjklmnpqrstvwxz]$/.test(clean) && clean.length >= 3) {
    const lastChar = clean[clean.length - 1];
    variants.add(`${clean}${lastChar}ed`);
    variants.add(`${clean}${lastChar}ing`);
  }

  return Array.from(variants);
}

/**
 * Nettoie le texte généré pour en extraire la phrase d'exemple pure
 */
export function cleanRawOutput(raw: string): string {
  if (!raw) return '';

  let text = raw.trim();

  // Supprimer les balises de réflexion (DeepSeek / QwQ / thinking) s'il y en a
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Si plusieurs lignes, récupérer la première ligne qui ressemble à une phrase
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let candidate = lines[0] || '';

  // Si la ligne commence par une numérotation (ex: "1. The plane..."), la retirer
  candidate = candidate.replace(/^\d+[\.\-\)]\s*/, '').trim();

  // Retirer les préfixes conversationnels courants (Chatbot chatter)
  const chatterPrefixes = [
    /^(sure!?|certainly!?|of course!?|here is|here's|here are|example:?|sentence:?|in english:?|phrase:?|for example:?|sample sentence:?)\s*[:,-]?\s*/i,
    /^(here is an example sentence using the word "[^"]+":?)\s*/i,
    /^(here is a sentence with "[^"]+":?)\s*/i,
    /^(here is a sentence:?)\s*/i,
    /^(the sentence is:?)\s*/i,
    /^(example sentence:?)\s*/i,
  ];

  let prev = '';
  while (prev !== candidate) {
    prev = candidate;
    for (const regex of chatterPrefixes) {
      candidate = candidate.replace(regex, '').trim();
    }
  }

  // Retirer les guillemets englobants superflus
  candidate = candidate.replace(/^["'«“](.*)["'»”]$/s, '$1').trim();

  // Retirer le markdown superflu (gras, italique)
  candidate = candidate.replace(/\*\*([^*]+)\*\*/g, '$1');
  candidate = candidate.replace(/\*([^*]+)\*/g, '$1');
  candidate = candidate.replace(/`([^`]+)`/g, '$1');

  // Si la phrase contient encore un préfixe entre guillemets ("Example:")
  candidate = candidate.replace(/^(Example|Sentence):\s*/i, '').trim();

  return candidate;
}

/**
 * Contrôle qualité automatique strict sur une phrase d'exemple générée
 */
export function validateSentenceQuality(
  rawText: string,
  targetWord: string
): SentenceQualityResult {
  if (!rawText || !rawText.trim()) {
    return { isValid: false, reason: 'Texte vide' };
  }

  const clean = cleanRawOutput(rawText);

  // 1. Longueur en caractères
  if (clean.length < 15) {
    return { isValid: false, reason: 'Phrase trop courte (< 15 caractères)' };
  }
  if (clean.length > 250) {
    return { isValid: false, reason: 'Phrase trop longue (> 250 caractères)' };
  }

  // 2. Nombre de mots (entre 5 et 20 mots selon exigence utilisateur)
  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 5) {
    return {
      isValid: false,
      reason: `Phrase trop courte (${words.length} mots, minimum 5 requis)`,
    };
  }
  if (words.length > 20) {
    return {
      isValid: false,
      reason: `Phrase trop longue (${words.length} mots, maximum 20 autorisés)`,
    };
  }

  // 3. Ponctuation finale (. ! ?)
  const lastChar = clean[clean.length - 1];
  if (!['.', '!', '?'].includes(lastChar)) {
    // Si la phrase se termine sans ponctuation mais est sémantiquement complète, on peut ajouter '.'
    if (/[a-zA-Z0-9)"]/.test(lastChar)) {
      return validateSentenceQuality(`${clean}.`, targetWord);
    }
    return { isValid: false, reason: 'La phrase doit se terminer par une ponctuation (. ! ?)' };
  }

  // 4. Majuscule initiale
  const firstLetter = clean.charAt(0);
  if (firstLetter !== firstLetter.toUpperCase() || !/[A-Z]/.test(firstLetter)) {
    return { isValid: false, reason: 'La phrase doit commencer par une majuscule' };
  }

  // 5. Présence obligatoire du mot cible ou d'une de ses variantes morphologiques
  const variants = getWordVariants(targetWord);
  const lowerClean = clean.toLowerCase();

  const containsTarget = variants.some((v) => {
    // Échapper les caractères regex
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(lowerClean);
  });

  if (!containsTarget) {
    return {
      isValid: false,
      reason: `Le mot cible "${targetWord}" n'apparaît pas dans la phrase`,
    };
  }

  // 6. Exclusion des restes de français ou de consignes d'IA
  const forbiddenPhrases = [
    /\bvoici une phrase\b/i,
    /\btraduction\b/i,
    /\bsignifie\b/i,
    /\ben français\b/i,
    /\bje peux vous\b/i,
    /\bas an ai\b/i,
    /\bi hope this helps\b/i,
    /\blet me know\b/i,
  ];

  for (const forbidden of forbiddenPhrases) {
    if (forbidden.test(lowerClean)) {
      return {
        isValid: false,
        reason: 'Texte parasite ou conversationnel détecté',
      };
    }
  }

  return {
    isValid: true,
    cleanSentence: clean,
  };
}
