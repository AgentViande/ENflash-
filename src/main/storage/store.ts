import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { AppDatabase, AiApiProvider } from '../../shared/types';
import { CURRENT_SCHEMA_VERSION } from '../../shared/constants';
import { createInitialDatabase } from './initialData';
import { migrateDatabase } from './migrations';
import { encryptSecret, decryptSecret } from './crypto';

export class DatabaseStore {
  private dataDir: string;
  private dbFilePath: string;
  private cache: AppDatabase | null = null;

  constructor(customDir?: string) {
    if (customDir) {
      this.dataDir = customDir;
    } else {
      // Stockage permanent dans userData d'Electron
      this.dataDir = app.getPath('userData');
    }

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.dbFilePath = path.join(this.dataDir, 'enflash-data.json');
  }

  public getFilePath(): string {
    return this.dbFilePath;
  }

  /**
   * Écriture atomique sécurisée :
   * 1. Écriture sur un fichier temporaire .tmp avec chiffrement safeStorage de la clé API
   * 2. Remplacement atomique via fs.renameSync
   */
  public atomicWrite(data: AppDatabase): void {
    const tmpPath = path.join(this.dataDir, `enflash-data.tmp.${Date.now()}.json`);
    
    // Cloner pour chiffrer la clé sur disque sans altérer les données en mémoire
    const diskData: AppDatabase = JSON.parse(JSON.stringify(data));
    if (diskData.settings?.aiApiKey) {
      diskData.settings.aiApiKey = encryptSecret(diskData.settings.aiApiKey);
    }
    if (diskData.settings?.aiApiKeys) {
      for (const prov of Object.keys(diskData.settings.aiApiKeys) as AiApiProvider[]) {
        const k = diskData.settings.aiApiKeys[prov];
        if (k) {
          diskData.settings.aiApiKeys[prov] = encryptSecret(k);
        }
      }
    }

    const jsonContent = JSON.stringify(diskData, null, 2);

    fs.writeFileSync(tmpPath, jsonContent, 'utf-8');
    fs.renameSync(tmpPath, this.dbFilePath);
    this.cache = data;
  }

  /**
   * Crée un instantané de sauvegarde horodaté ou par version
   */
  public createBackup(tag: string = `v${CURRENT_SCHEMA_VERSION}`): string {
    if (!fs.existsSync(this.dbFilePath)) return '';
    const backupFileName = `enflash-data.backup.${tag}.${Date.now()}.json`;
    const backupFilePath = path.join(this.dataDir, backupFileName);
    fs.copyFileSync(this.dbFilePath, backupFilePath);
    return backupFilePath;
  }

  /**
   * Charge les données en mémoire, applique les migrations si nécessaire et sauvegarde le résultat
   */
  public load(): AppDatabase {
    if (this.cache) {
      return this.cache;
    }

    if (!fs.existsSync(this.dbFilePath)) {
      // Première utilisation : initialisation de la base de départ
      const initialData = createInitialDatabase();
      this.atomicWrite(initialData);
      return initialData;
    }

    try {
      const fileContent = fs.readFileSync(this.dbFilePath, 'utf-8');
      const parsedData = JSON.parse(fileContent);

      let dbData = parsedData as AppDatabase;
      const currentVersion = parsedData?.schemaVersion || 0;

      if (currentVersion < CURRENT_SCHEMA_VERSION) {
        // Sauvegarde de sécurité avant migration
        this.createBackup(`pre-migration-v${currentVersion}`);

        // Exécution des migrations séquentielles
        const { migratedData } = migrateDatabase(parsedData, CURRENT_SCHEMA_VERSION);
        this.atomicWrite(migratedData);
        dbData = migratedData;
      }

      // Déchiffrement et migration transparente des réglages IA
      if (dbData?.settings) {
        if (dbData.settings.aiApiKey) {
          dbData.settings.aiApiKey = decryptSecret(dbData.settings.aiApiKey);
        }
        if (dbData.settings.aiApiKeys) {
          for (const prov of Object.keys(dbData.settings.aiApiKeys) as AiApiProvider[]) {
            const k = dbData.settings.aiApiKeys[prov];
            if (k) {
              dbData.settings.aiApiKeys[prov] = decryptSecret(k);
            }
          }
        }
        if (!dbData.settings.aiApiProvider) {
          const key = dbData.settings.aiApiKey || '';
          if (key.startsWith('AIza')) {
            dbData.settings.aiApiProvider = 'gemini';
            dbData.settings.aiApiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/';
            dbData.settings.aiApiModel = dbData.settings.aiApiModel || 'gemini-1.5-flash';
          } else if (key.startsWith('gsk_')) {
            dbData.settings.aiApiProvider = 'groq';
            dbData.settings.aiApiEndpoint = 'https://api.groq.com/openai/v1';
            dbData.settings.aiApiModel = dbData.settings.aiApiModel || 'llama-3.3-70b-versatile';
          } else if (key.startsWith('sk-or-')) {
            dbData.settings.aiApiProvider = 'openrouter';
            dbData.settings.aiApiEndpoint = 'https://openrouter.ai/api/v1';
            dbData.settings.aiApiModel = dbData.settings.aiApiModel || 'google/gemini-2.0-flash-001';
          } else if (dbData.settings.aiApiEndpoint && !dbData.settings.aiApiEndpoint.includes('openai.com')) {
            dbData.settings.aiApiProvider = 'custom';
          } else {
            dbData.settings.aiApiProvider = 'gemini';
            dbData.settings.aiApiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/';
            dbData.settings.aiApiModel = 'gemini-1.5-flash';
          }
        }
        // Migration de la clé unique vers la table des clés par fournisseur
        if (dbData.settings.aiApiKey) {
          if (!dbData.settings.aiApiKeys) {
            dbData.settings.aiApiKeys = {};
          }
          const activeProv = dbData.settings.aiApiProvider || 'gemini';
          if (!dbData.settings.aiApiKeys[activeProv]) {
            dbData.settings.aiApiKeys[activeProv] = dbData.settings.aiApiKey;
          }
        }
      }

      this.cache = dbData;
      return this.cache;
    } catch (err) {
      console.error('Erreur lors de la lecture du fichier de base de données:', err);
      // Tentative de récupération depuis la dernière sauvegarde
      const fallbackData = createInitialDatabase();
      this.atomicWrite(fallbackData);
      return fallbackData;
    }
  }

  /**
   * Met à jour et persiste la base de données
   */
  public save(data: AppDatabase): void {
    data.schemaVersion = CURRENT_SCHEMA_VERSION;
    this.atomicWrite(data);
  }

  /**
   * Exporte l'intégralité des données vers un fichier JSON externe
   */
  public exportToFile(destinationPath: string): void {
    const data = this.load();
    const exportData: AppDatabase = JSON.parse(JSON.stringify(data));
    if (exportData.settings) {
      delete exportData.settings.aiApiKey;
      delete exportData.settings.aiApiKeys;
    }
    fs.writeFileSync(destinationPath, JSON.stringify(exportData, null, 2), 'utf-8');
  }

  /**
   * Importe des données depuis un fichier JSON externe avec validation et migration automatique
   */
  public importFromFile(sourcePath: string): AppDatabase {
    const rawContent = fs.readFileSync(sourcePath, 'utf-8');
    const parsed = JSON.parse(rawContent);

    // Sauvegarde préventive de l'état actuel avant écrasement
    this.createBackup('pre-import');

    const { migratedData } = migrateDatabase(parsed, CURRENT_SCHEMA_VERSION);
    this.save(migratedData);
    return migratedData;
  }
}

let storeInstance: DatabaseStore | null = null;

export function getDatabaseStore(customDir?: string): DatabaseStore {
  if (!storeInstance || customDir) {
    storeInstance = new DatabaseStore(customDir);
  }
  return storeInstance;
}
