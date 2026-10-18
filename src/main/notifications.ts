import { Notification } from 'electron';
import { getDatabaseStore } from './storage/store';
import { getParisDayKey } from '../shared/date/parisDate';

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

  // Vérification chaque minute basée sur l'heure de Paris
  reminderInterval = setInterval(() => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now);

    const currentHours = (parts.find((p) => p.type === 'hour')?.value || '0').padStart(2, '0');
    const currentMinutes = (parts.find((p) => p.type === 'minute')?.value || '0').padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const todayStr = getParisDayKey(now);

    if (currentTimeStr === reminderTime && lastRemindedDate !== todayStr) {
      const store = getDatabaseStore();
      const data = store.load();

      // Vérifier si le test du jour a déjà été validé
      const isAlreadyDone = data.lastDailyTestDayKey === todayStr || data.streak.lastCompletedDate === todayStr;
      if (!isAlreadyDone) {
        lastRemindedDate = todayStr;
        sendDesktopNotification(
          'ENflash ⚡ Rappel Quotidien',
          `C'est l'heure de votre session de révision ! Gardez votre série de ${data.streak.currentStreak} jours intacte !`
        );
      }
    }
  }, 60 * 1000);
}
