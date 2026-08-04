/**
 * Notification utilities for DevHub Mobile reminders.
 *
 * All functions no-op on web — expo-notifications local scheduling only
 * works on iOS and Android.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Stable identifier prefix so we can cancel by reminder ID. */
const ID_PREFIX = 'devhub-reminder-';

export function notificationId(reminderId: number): string {
  return `${ID_PREFIX}${reminderId}`;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Configure how incoming notifications behave while the app is in the
 * foreground. Call once at module level before any component mounts.
 */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      // Expo SDK 51+ banner / list flags
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request permission to send local notifications.
 * Returns `true` if permission was already granted or the user just granted it.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Android 8+ requires a notification channel before any notification can fire.
 * Safe to call on iOS — it's a no-op there.
 */
export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('devhub-reminders', {
      name: 'Reminders',
      description: 'Mr. Chris DevHub reminder alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f59e0b',
      sound: 'default',
    });
  } catch {
    // non-fatal — notifications may still work on some Android versions
  }
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

type ReminderLike = {
  id: number;
  title: string;
  description?: string | null;
  dueAt: string;
  done: boolean;
};

/**
 * Schedule (or reschedule) a local notification for one reminder.
 *
 * Rules:
 *  - If the reminder is done → cancel any existing notification and stop.
 *  - If dueAt is in the past → cancel and stop (no point firing late).
 *  - Otherwise → cancel existing (to avoid duplicates) then schedule.
 *
 * The `identifier` is deterministic (`devhub-reminder-<id>`) so calling
 * this multiple times is idempotent.
 */
export async function scheduleReminderNotification(reminder: ReminderLike): Promise<void> {
  if (Platform.OS === 'web') return;

  const id = notificationId(reminder.id);

  // Always cancel first so we never accumulate stale duplicates.
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Notification may not exist — that's fine.
  }

  if (reminder.done) return;

  const dueDate = new Date(reminder.dueAt);
  // Give a 5 s buffer so near-future reminders still schedule cleanly.
  if (dueDate.getTime() <= Date.now() + 5_000) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: '🔔 Mr. Chris DevHub',
        body: reminder.title,
        ...(reminder.description ? { subtitle: reminder.description } : {}),
        sound: 'default',
        data: {
          // The response handler reads this to decide where to navigate.
          screen: 'reminders',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dueDate,
      },
    });
  } catch (err) {
    if (__DEV__) console.warn('[notifications] scheduleNotificationAsync failed:', err);
  }
}

/**
 * Sync all reminders in one shot — idempotently schedules future pending ones
 * and cancels past/done ones. Safe to call on every list refresh.
 */
export async function syncReminderNotifications(reminders: ReminderLike[]): Promise<void> {
  if (Platform.OS === 'web') return;
  // Settle all in parallel; individual failures are swallowed inside
  // scheduleReminderNotification so we never reject the whole batch.
  await Promise.all(reminders.map(scheduleReminderNotification));
}
