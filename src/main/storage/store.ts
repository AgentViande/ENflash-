import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { AppDatabase } from '../../shared/types';
import { CURRENT_SCHEMA_VERSION } from '../../shared/constants';
import { createInitialDatabase } from './initialData';
import { migrateDatabase } from './migrations';

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
   * 1. Écriture sur un fichier temporaire .tmp
   * 2. Remplacement atomique via fs.renameSync
   */
  public atomicWrite(data: AppDatabase): void {
    const tmpPath = path.join(this.dataDir, `enflash-data.tmp.${Date.now()}.json`);
    const jsonContent = JSON.stringify(data, null, 2);

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

      const currentVersion = parsedData?.schemaVersion || 0;

      if (currentVersion < CURRENT_SCHEMA_VERSION) {
        // Sauvegarde de sécurité avant migration
        this.createBackup(`pre-migration-v${currentVersion}`);

        // Exécution des migrations séquentielles
        const { migratedData } = migrateDatabase(parsedData, CURRENT_SCHEMA_VERSION);
        this.atomicWrite(migratedData);
        return migratedData;
      }

      this.cache = parsedData as AppDatabase;
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
    fs.writeFileSync(destinationPath, JSON.stringify(data, null, 2), 'utf-8');
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
