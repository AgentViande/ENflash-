/**
 * Module de sécurisation des clés secrètes (safeStorage Electron)
 * Chiffre les clés API lors de l'enregistrement sur le disque et les déchiffre à la lecture.
 */

let safeStorageModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electron = require('electron');
  safeStorageModule = electron.safeStorage || null;
} catch {
  safeStorageModule = null;
}

const ENC_PREFIX = 'enc:';

/**
 * Chiffre une chaîne secrète si safeStorage est disponible dans Electron
 */
export function encryptSecret(secret?: string): string {
  if (!secret || typeof secret !== 'string') return '';
  const trimmed = secret.trim();
  if (!trimmed || trimmed.startsWith(ENC_PREFIX)) return trimmed;

  if (safeStorageModule && typeof safeStorageModule.isEncryptionAvailable === 'function') {
    try {
      if (safeStorageModule.isEncryptionAvailable()) {
        const encrypted = safeStorageModule.encryptString(trimmed);
        return `${ENC_PREFIX}${encrypted.toString('base64')}`;
      }
    } catch (err) {
      console.warn('[Crypto] Erreur lors du chiffrement safeStorage:', err);
    }
  }

  // Fallback réversible si safeStorage n'est pas disponible (ex: environnement de test vitest)
  const fallback = Buffer.from(trimmed, 'utf-8').toString('base64');
  return `${ENC_PREFIX}${fallback}`;
}

/**
 * Déchiffre une chaîne secrète préalablement chiffrée
 */
export function decryptSecret(encryptedSecret?: string): string {
  if (!encryptedSecret || typeof encryptedSecret !== 'string') return '';
  const trimmed = encryptedSecret.trim();
  if (!trimmed) return '';

  if (!trimmed.startsWith(ENC_PREFIX)) {
    // Clé déjà en texte brut (migration transparente)
    return trimmed;
  }

  if (safeStorageModule && typeof safeStorageModule.isEncryptionAvailable === 'function') {
    try {
      if (safeStorageModule.isEncryptionAvailable()) {
        const cipherBuffer = Buffer.from(trimmed.slice(ENC_PREFIX.length), 'base64');
        return safeStorageModule.decryptString(cipherBuffer);
      }
    } catch (err) {
      console.warn('[Crypto] Erreur lors du déchiffrement safeStorage:', err);
    }
  }

  // Fallback si safeStorage non disponible
  try {
    return Buffer.from(trimmed.slice(ENC_PREFIX.length), 'base64').toString('utf-8');
  } catch {
    return trimmed;
  }
}

/**
 * Masque une clé pour l'affichage ou les logs (ex: "AIza...abc")
 */
export function maskApiKey(key?: string): string {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-3)}`;
}
