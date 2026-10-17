import { Notification } from 'electron';
import { getDatabaseStore } from './storage/store';
import { getTodayDateString } from '../shared/srs/leitner';

let reminderInterval: NodeJS.Timeout | null = null;
let lastRemindedDate: string | null = null;

export function sendDesktopNotification(title: string, body: string): boolean {
  if (!Notification.isSupported()) {
    return false;
  }

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.show();
  return true;
}

export function startReminderScheduler(enabled: boolean, reminderTime: string): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }

  if (!enabled) return;

  // Vérification chaque minute
  reminderInterval = setInterval(() => {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const todayStr = getTodayDateString();

    if (currentTimeStr === reminderTime && lastRemindedDate !== todayStr) {
      const store = getDatabaseStore();
      const data = store.load();

      // Vérifier si le test du jour a déjà été validé
      if (data.streak.lastCompletedDate !== todayStr) {
        lastRemindedDate = todayStr;
        sendDesktopNotification(
          'ENflash ⚡ Rappel Quotidien',
          `C'est l'heure de votre session de révision ! Gardez votre série de ${data.streak.currentStreak} jours intacte !`
        );
      }
    }
  }, 60 * 1000);
}
