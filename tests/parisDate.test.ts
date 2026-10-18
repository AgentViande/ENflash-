import { describe, it, expect } from 'vitest';
import {
  getParisDayKey,
  getParisWeekKey,
  daysBetweenDates,
  addDaysToDate,
  getNextParisMidnight,
  getMsUntilNextParisMidnight,
  formatCountdown,
  isClockRollback,
} from '../src/shared/date/parisDate';

describe('Paris Timezone & Calendar Key Utilities', () => {
  it('calcule la clé de jour strictement dans le fuseau Europe/Paris, indépendamment du fuseau client', () => {
    // 2026-10-18 à 22:30:00 UTC
    // En UTC : 18 octobre
    // À New York (UTC-4) : 18:30 le 18 octobre
    // À Tokyo (UTC+9) : 07:30 le 19 octobre
    // À Paris (CEST UTC+2) : 00:30 le 19 octobre -> Clé attendue : 2026-10-19
    const d1 = new Date('2026-10-18T22:30:00.000Z');
    expect(getParisDayKey(d1)).toBe('2026-10-19');

    // 2026-10-18 à 21:30:00 UTC
    // À Paris (CEST UTC+2) : 23:30 le 18 octobre -> Clé attendue : 2026-10-18
    const d2 = new Date('2026-10-18T21:30:00.000Z');
    expect(getParisDayKey(d2)).toBe('2026-10-18');

    // 2026-01-15 à 23:30:00 UTC (heure d'hiver CET UTC+1)
    // À Paris : 00:30 le 16 janvier -> Clé attendue : 2026-01-16
    const dWinter = new Date('2026-01-15T23:30:00.000Z');
    expect(getParisDayKey(dWinter)).toBe('2026-01-16');
  });

  it('gère correctement le passage à l’heure d’été (dernier dimanche de mars : 29 mars 2026)', () => {
    // Le 29 mars 2026 à 02:00 CET, l'horloge avance à 03:00 CEST
    // Veille à 23h59 CET (22:59 UTC)
    const eve = new Date('2026-03-28T22:59:00.000Z');
    expect(getParisDayKey(eve)).toBe('2026-03-28');

    // Jour J à 00h01 CET (23:01 UTC le 28 mars)
    const midnight = new Date('2026-03-28T23:01:00.000Z');
    expect(getParisDayKey(midnight)).toBe('2026-03-29');

    // Après le saut de 02:00 -> 03:00, à 03h15 CEST (01:15 UTC)
    const afterJump = new Date('2026-03-29T01:15:00.000Z');
    expect(getParisDayKey(afterJump)).toBe('2026-03-29');

    // Fin du jour à 23h59 CEST (21:59 UTC)
    const night = new Date('2026-03-29T21:59:00.000Z');
    expect(getParisDayKey(night)).toBe('2026-03-29');

    // Lendemain à 00h01 CEST (22:01 UTC le 29 mars)
    const nextDay = new Date('2026-03-29T22:01:00.000Z');
    expect(getParisDayKey(nextDay)).toBe('2026-03-30');

    // Vérifier l'écart de jours consécutifs
    expect(daysBetweenDates('2026-03-28', '2026-03-29')).toBe(1);
    expect(daysBetweenDates('2026-03-29', '2026-03-30')).toBe(1);
  });

  it('gère correctement le passage à l’heure d’hiver (dernier dimanche d’octobre : 25 octobre 2026)', () => {
    // Le 25 octobre 2026 à 03:00 CEST, l'horloge recule à 02:00 CET
    // Veille à 23h59 CEST (21:59 UTC)
    const eve = new Date('2026-10-24T21:59:00.000Z');
    expect(getParisDayKey(eve)).toBe('2026-10-24');

    // Jour J à 00h01 CEST (22:01 UTC le 24 octobre)
    const midnight = new Date('2026-10-24T22:01:00.000Z');
    expect(getParisDayKey(midnight)).toBe('2026-10-25');

    // Pendant l'heure répétée (02h30 CET / 01:30 UTC)
    const repeatedHour = new Date('2026-10-25T01:30:00.000Z');
    expect(getParisDayKey(repeatedHour)).toBe('2026-10-25');

    // Fin du jour à 23h59 CET (22:59 UTC)
    const night = new Date('2026-10-25T22:59:00.000Z');
    expect(getParisDayKey(night)).toBe('2026-10-25');

    // Lendemain à 00h01 CET (23:01 UTC le 25 octobre)
    const nextDay = new Date('2026-10-25T23:01:00.000Z');
    expect(getParisDayKey(nextDay)).toBe('2026-10-26');

    // Pas de jour sauté ni de jour en double
    expect(daysBetweenDates('2026-10-24', '2026-10-25')).toBe(1);
    expect(daysBetweenDates('2026-10-25', '2026-10-26')).toBe(1);
  });

  it('calcule la clé de semaine ISO changeant le lundi à 00h00 heure de Paris', () => {
    // Dimanche 18 octobre 2026 à 23h59 Paris (21h59 UTC) -> Semaine 42
    const sunNight = new Date('2026-10-18T21:59:00.000Z');
    expect(getParisWeekKey(sunNight)).toBe('2026-W42');

    // Lundi 19 octobre 2026 à 00h01 Paris (22h01 UTC le 18 oct) -> Semaine 43
    const monMorning = new Date('2026-10-18T22:01:00.000Z');
    expect(getParisWeekKey(monMorning)).toBe('2026-W43');
  });

  it('calcule le prochain minuit à Paris et formate le compte à rebours', () => {
    // Le 18 octobre 2026 à 20h00 UTC (22h00 à Paris, CEST UTC+2)
    const date = new Date('2026-10-18T20:00:00.000Z');
    const nextMidnight = getNextParisMidnight(date);

    // Minuit le 19 octobre à Paris correspond à 22h00 UTC le 18 octobre
    expect(nextMidnight.toISOString()).toBe('2026-10-18T22:00:00.000Z');
    expect(getParisDayKey(nextMidnight)).toBe('2026-10-19');

    const msUntil = getMsUntilNextParisMidnight(date);
    expect(msUntil).toBe(2 * 3600 * 1000); // Exactement 2 heures
    expect(formatCountdown(msUntil)).toBe('02h 00m 00s');
    expect(formatCountdown(msUntil, false)).toBe('02h 00m');
  });

  it('détecte le recul anormal de l’horloge système (anti-triche)', () => {
    expect(isClockRollback('2026-10-17', '2026-10-18')).toBe(true);
    expect(isClockRollback('2026-10-18', '2026-10-18')).toBe(false);
    expect(isClockRollback('2026-10-19', '2026-10-18')).toBe(false);
    expect(isClockRollback('2026-10-18', null)).toBe(false);
  });
});
