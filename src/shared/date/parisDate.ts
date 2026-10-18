/**
 * Module central de gestion des dates et clés calendaires dans le fuseau Europe/Paris.
 * Indépendant du fuseau horaire de la machine cliente.
 */

const PARIS_TIMEZONE = 'Europe/Paris';

/**
 * Retourne la clé de jour calendaire au format "YYYY-MM-DD" dans le fuseau Europe/Paris.
 * Fonction unique et testable, utilisée partout (test quotidien, streak, heatmap, etc.).
 */
export function getParisDayKey(input: Date | number | string = new Date()): string {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (isNaN(d.getTime())) {
    throw new Error(`Date invalide fournie à getParisDayKey : ${input}`);
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Retourne la clé de semaine calendaire au format ISO "YYYY-Www" dans le fuseau Europe/Paris.
 * La semaine calendaire commence le lundi à 00h00 heure de Paris.
 */
export function getParisWeekKey(input: Date | number | string = new Date()): string {
  const parisDayKey = getParisDayKey(input);
  const [y, m, d] = parisDayKey.split('-').map(Number);

  // Utilisation d'une date UTC pour le calcul du jour de semaine sans artefact horaire
  const target = new Date(Date.UTC(y, m - 1, d));
  // ISO day of week : 1 (Lundi) à 7 (Dimanche)
  const dayNr = ((target.getUTCDay() + 6) % 7) + 1;

  // Cible le jeudi de la semaine en cours (définition ISO 8601)
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Calcule le nombre de jours calendaires entre deux dates au format "YYYY-MM-DD".
 * Positif si dateStr2 est après dateStr1.
 */
export function daysBetweenDates(dateStr1: string, dateStr2: string): number {
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / msPerDay);
}

/**
 * Ajoute un nombre de jours calendaires à une clé de jour au format "YYYY-MM-DD".
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Retourne la date exacte du prochain minuit (00:00:00) heure de Paris.
 */
export function getNextParisMidnight(now: Date = new Date()): Date {
  const currentParisDay = getParisDayKey(now);
  const [y, m, d] = currentParisDay.split('-').map(Number);

  // Minuit à Paris arrive entre 21:00 UTC et 23:00 UTC du jour courant (selon UTC+1 ou UTC+2)
  for (let h = 21; h <= 24; h++) {
    const candidate = new Date(Date.UTC(y, m - 1, d, h, 0, 0, 0));
    const candDay = getParisDayKey(candidate);
    if (candDay !== currentParisDay) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: PARIS_TIMEZONE,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(candidate);
      const hour = Number(parts.find((p) => p.type === 'hour')?.value);
      if (hour === 0 || hour === 24) {
        return candidate;
      }
    }
  }

  // Secours si calcul limite
  return new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
}

/**
 * Retourne le nombre de millisecondes restantes jusqu'au prochain minuit heure de Paris.
 */
export function getMsUntilNextParisMidnight(now: Date = new Date()): number {
  const nextMidnight = getNextParisMidnight(now);
  return Math.max(0, nextMidnight.getTime() - now.getTime());
}

/**
 * Formate un délai en millisecondes en texte de compte à rebours : "XXh YYm ZZs" ou "XXh YYm".
 */
export function formatCountdown(ms: number, includeSeconds: boolean = true): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');

  if (includeSeconds) {
    return `${hStr}h ${mStr}m ${sStr}s`;
  }
  return `${hStr}h ${mStr}m`;
}

/**
 * Détecte si l'horloge système a reculé par rapport au dernier jour validé.
 */
export function isClockRollback(currentDayKey: string, lastRecordedDayKey: string | null | undefined): boolean {
  if (!lastRecordedDayKey) return false;
  return currentDayKey < lastRecordedDayKey;
}
