/**
 * Reminder alarm utilities for DevHub Mobile.
 *
 * Schedules OS-level local notifications so they still fire with sound +
 * vibration when the app is backgrounded or fully closed.
 */

import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

/** Stable identifier prefix so we can cancel by reminder ID. */
const ID_PREFIX = 'devhub-reminder-';

/** High-priority Android channel used as an alarm (sound + vibrate). */
export const ALARM_CHANNEL_ID = 'devhub-alarms';

export function notificationId(reminderId: number): string {
  return `${ID_PREFIX}${reminderId}`;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Configure how notifications behave while the app is in the foreground.
 * Call once at module level before any component mounts.
 */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request permission to send local notifications (alerts + sound).
 * Returns `true` if permission was already granted or the user just granted it.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existing, granted, ios } = await Notifications.getPermissionsAsync();
    if (existing === 'granted' || granted) return true;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: false, // requires Apple entitlement
        provideAppNotificationSettings: true,
      },
    });

    // On some iOS versions provisional/ephemeral still allow delivery.
    if (status === 'granted') return true;
    if (ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Android 8+ requires a notification channel. We use MAX importance + ALARM
 * audio usage so the phone rings and vibrates even when the screen is off.
 */
export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // Primary alarm channel
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Reminder Alarms',
      description: 'Loud sound + vibration when a reminder is due (works with app closed)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500, 250, 800],
      lightColor: '#f59e0b',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
    });

    // Keep the older channel name so existing installs still work if referenced.
    await Notifications.setNotificationChannelAsync('devhub-reminders', {
      name: 'Reminders',
      description: 'Mr. Chris DevHub reminder alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#f59e0b',
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
    });
  } catch {
    // non-fatal
  }
}

/** Call once on app launch: channel + permissions. */
export async function ensureAlarmReady(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await setupAndroidChannel();
  return requestNotificationPermission();
}

export async function getNotificationPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined' | 'unsupported'
> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'unsupported';
  }
}

/** Open system settings so the user can enable notifications / exact alarms. */
export async function openNotificationSettings(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  } catch {
    // ignore
  }
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

export type ReminderLike = {
  id: number;
  title: string;
  description?: string | null;
  dueAt: string;
  done: boolean;
};

export async function cancelReminderNotification(reminderId: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId(reminderId));
  } catch {
    // may not exist
  }
}

/**
 * Schedule (or reschedule) a local OS notification for one reminder.
 *
 * Fires with sound + vibration even when the app is closed, because the
 * OS owns the schedule after this call returns.
 */
export async function scheduleReminderNotification(reminder: ReminderLike): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const id = notificationId(reminder.id);

  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // fine
  }

  if (reminder.done) return false;

  const dueDate = new Date(reminder.dueAt);
  if (Number.isNaN(dueDate.getTime())) return false;

  // Allow near-future (e.g. "in 15s" tests). Skip only if already past.
  if (dueDate.getTime() <= Date.now() + 1_000) return false;

  const body = reminder.description?.trim()
    ? `${reminder.title}\n${reminder.description.trim()}`
    : reminder.title;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: '⏰ Reminder alarm',
        body,
        subtitle: 'Mr. Chris DevHub',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        // iOS 15+: treat as time-sensitive so it can break through Focus
        ...(Platform.OS === 'ios'
          ? { interruptionLevel: 'timeSensitive' as const }
          : {}),
        vibrate: [0, 500, 250, 500, 250, 500, 250, 800],
        sticky: false,
        autoDismiss: false,
        badge: 1,
        data: {
          screen: 'reminders',
          reminderId: reminder.id,
        },
        ...(Platform.OS === 'android'
          ? {
              channelId: ALARM_CHANNEL_ID,
              // Full-screen-style high priority on lock screen
              color: '#f59e0b',
            }
          : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dueDate,
        ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID } : {}),
      },
    });
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[notifications] scheduleNotificationAsync failed:', err);
    return false;
  }
}

/**
 * Fire a short test alarm in `seconds` (default 10) so the user can verify
 * sound + vibration with the app backgrounded.
 */
export async function scheduleTestAlarm(seconds = 10): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const ready = await ensureAlarmReady();
  if (!ready) return false;

  const when = new Date(Date.now() + Math.max(3, seconds) * 1000);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: 'devhub-test-alarm',
      content: {
        title: '⏰ Test alarm',
        body: 'If you hear sound and feel vibration, reminder alarms are working — even with the app closed.',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === 'ios'
          ? { interruptionLevel: 'timeSensitive' as const }
          : {}),
        vibrate: [0, 500, 250, 500, 250, 500, 250, 800],
        ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID, color: '#f59e0b' } : {}),
        data: { screen: 'reminders', test: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID } : {}),
      },
    });
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[notifications] test alarm failed:', err);
    return false;
  }
}

/**
 * Sync all reminders — schedules future pending ones and cancels past/done.
 * Safe to call on every list refresh / app foreground.
 */
export async function syncReminderNotifications(reminders: ReminderLike[]): Promise<void> {
  if (Platform.OS === 'web') return;
  await ensureAlarmReady();
  await Promise.all(reminders.map(scheduleReminderNotification));
}
