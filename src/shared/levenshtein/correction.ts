import { LevenshteinStatus, WeeklyAnswer } from '../types';

/**
 * Normalise une chaîne de texte pour la comparaison :
 * - Minuscules
 * - Suppression des espaces superflus (début, fin, multiples)
 * - Suppression des signes de ponctuation finale (. , ! ?)
 * - Normalisation Unicode (NFC)
 */
export function normalizeAnswer(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a || '';
  const s2 = b || '';
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  const matrix: number[][] = Array.from({ length: len1 + 1 }, () =>
    new Array(len2 + 1).fill(0)
  );

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // suppression
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Évalue la réponse d'un utilisateur par rapport à la réponse attendue.
 * Supporte les réponses multiples séparées par des barres obliques (ex: "car / automobile" ou "to buy / buy").
 */
export function evaluateAnswer(
  wordId: string,
  french: string,
  expectedRaw: string,
  givenRaw: string
): WeeklyAnswer {
  const normalizedGiven = normalizeAnswer(givenRaw);

  // Découpage des options acceptées séparées par '/' ou ','
  const options = expectedRaw
    .split(/[/,;]/)
    .map((opt) => normalizeAnswer(opt))
    .filter((opt) => opt.length > 0);

  if (options.length === 0) {
    options.push(normalizeAnswer(expectedRaw));
  }

  let bestStatus: LevenshteinStatus = 'wrong';
  let minDistance = 999;

  for (const option of options) {
    const dist = levenshteinDistance(normalizedGiven, option);
    if (dist < minDistance) {
      minDistance = dist;
    }

    if (dist === 0) {
      bestStatus = 'exact';
      break;
    }

    // Tolérance aux fautes de frappe
    const len = option.length;
    let allowedTypoDistance = 0;
    if (len >= 6) {
      allowedTypoDistance = 2;
    } else if (len >= 3) {
      allowedTypoDistance = 1;
    }

    if (dist <= allowedTypoDistance) {
      bestStatus = 'almost';
    }
  }

  return {
    wordId,
    french,
    expected: expectedRaw,
    given: givenRaw,
    status: bestStatus,
    distance: minDistance === 999 ? normalizedGiven.length : minDistance,
  };
}

/**
 * Estime le niveau d'anglais (CECRL) en fonction de la taille du vocabulaire et du score
 */
export function estimateEnglishLevel(
  scorePercentage: number,
  totalWordsMastered: number
): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' {
  if (totalWordsMastered >= 300 && scorePercentage >= 85) return 'C1';
  if (totalWordsMastered >= 150 && scorePercentage >= 75) return 'B2';
  if (totalWordsMastered >= 60 && scorePercentage >= 65) return 'B1';
  if (totalWordsMastered >= 20 && scorePercentage >= 50) return 'A2';
  return 'A1';
}
