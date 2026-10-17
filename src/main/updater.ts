import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { UpdateInfo } from '../preload/types';

export class AppUpdater {
  private mainWindow: BrowserWindow | null = null;
  private updatePending: boolean = false;
  private currentUpdateInfo: UpdateInfo | null = null;

  constructor() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      this.updatePending = true;
      this.currentUpdateInfo = {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        releaseDate: info.releaseDate,
      };
    });

    autoUpdater.on('download-progress', (progressObj) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('updater:progress', {
          percent: Math.round(progressObj.percent),
          bytesPerSecond: progressObj.bytesPerSecond,
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('updater:downloaded', {
          version: info.version,
          releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
          releaseDate: info.releaseDate,
        });
      }
    });

    autoUpdater.on('error', (err) => {
      console.warn('Auto-updater log/error:', err.message);
    });
  }

  public setWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public async checkForUpdates(): Promise<{ available: boolean; info?: UpdateInfo; error?: string }> {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result && result.updateInfo) {
        const isNewer = result.updateInfo.version !== autoUpdater.currentVersion.version;
        const info: UpdateInfo = {
          version: result.updateInfo.version,
          releaseNotes: typeof result.updateInfo.releaseNotes === 'string' ? result.updateInfo.releaseNotes : undefined,
          releaseDate: result.updateInfo.releaseDate,
        };
        return { available: isNewer, info };
      }
      return { available: false };
    } catch (err: any) {
      console.warn('Erreur vérification mise à jour:', err.message);
      return { available: false, error: err.message };
    }
  }

  public async downloadUpdate(): Promise<boolean> {
    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch (err: any) {
      console.error('Erreur téléchargement mise à jour:', err);
      return false;
    }
  }

  public installUpdate(): void {
    autoUpdater.quitAndInstall(false, true);
  }
}

let updaterInstance: AppUpdater | null = null;

export function getAppUpdater(): AppUpdater {
  if (!updaterInstance) {
    updaterInstance = new AppUpdater();
  }
  return updaterInstance;
}
