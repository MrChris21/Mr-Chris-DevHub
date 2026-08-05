/**
 * Reminder alarm utilities for DevHub Mobile (iPhone + Android).
 *
 * Strategy for "alarm clock" behavior:
 * 1. Schedule a burst of OS local notifications at due time (+ every few seconds)
 *    so the phone keeps sounding even if the first notification is missed.
 * 2. When a notification is received while the app is open, start looping
 *    sound + vibration via alarm-player (plays in silent mode on iOS).
 * 3. Android channel uses ALARM audio usage + MAX importance.
 */

import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { startAlarmPlayer, stopAlarmPlayer } from '@/lib/alarm-player';
// re-exported at bottom

const ID_PREFIX = 'devhub-reminder-';
export const ALARM_CHANNEL_ID = 'devhub-alarms';

/** How long the multi-notification "ring storm" lasts after due time. */
const RING_BURST_SECONDS = 60;
/** Spacing between follow-up rings in the burst. */
const RING_INTERVAL_SECONDS = 5;

export function notificationId(reminderId: number, burstIndex = 0): string {
  return burstIndex === 0 ? `${ID_PREFIX}${reminderId}` : `${ID_PREFIX}${reminderId}-b${burstIndex}`;
}

export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      // When a notification arrives in foreground, also start looping player
      void startAlarmPlayer();
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}

/** Call once after notifications are configured — ring when user taps a notif. */
export function attachAlarmResponseListener(): { remove: () => void } {
  if (Platform.OS === 'web') return { remove: () => {} };
  const sub = Notifications.addNotificationReceivedListener(() => {
    void startAlarmPlayer();
  });
  const sub2 = Notifications.addNotificationResponseReceivedListener(() => {
    void startAlarmPlayer();
  });
  return {
    remove: () => {
      sub.remove();
      sub2.remove();
    },
  };
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return true;

    const { status, granted, ios } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: false,
        provideAppNotificationSettings: true,
      },
    });

    if (granted || status === 'granted') return true;
    if (ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
    return false;
  } catch {
    return false;
  }
}

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Reminder Alarms',
      description: 'Rings and vibrates like an alarm clock when a reminder is due',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 200, 600, 200, 800],
      lightColor: '#f59e0b',
      sound: 'alarm.wav',
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
  } catch {
    // Fallback to default sound if custom sound isn't bundled yet
    try {
      await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
        name: 'Reminder Alarms',
        description: 'Rings and vibrates like an alarm clock when a reminder is due',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 200, 600, 200, 800],
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
    } catch {
      // non-fatal
    }
  }
}

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

export type ReminderLike = {
  id: number;
  title: string;
  description?: string | null;
  dueAt: string;
  done: boolean;
};

export async function cancelReminderNotification(reminderId: number): Promise<void> {
  if (Platform.OS === 'web') return;
  const count = Math.floor(RING_BURST_SECONDS / RING_INTERVAL_SECONDS) + 1;
  await Promise.all(
    Array.from({ length: count }, (_, i) =>
      Notifications.cancelScheduledNotificationAsync(notificationId(reminderId, i)).catch(
        () => undefined,
      ),
    ),
  );
  await stopAlarmPlayer();
}

function alarmContent(reminder: ReminderLike, burstIndex: number) {
  const body = reminder.description?.trim()
    ? `${reminder.title}\n${reminder.description.trim()}`
    : reminder.title;

  // Prefer custom sound; fall back to default if not in build
  const soundName = Platform.OS === 'ios' ? 'alarm.wav' : 'alarm.wav';

  return {
    title: burstIndex === 0 ? '⏰ ALARM' : '⏰ Still ringing…',
    body,
    subtitle: 'Mr. Chris DevHub',
    sound: soundName as 'default' | string,
    priority: Notifications.AndroidNotificationPriority.MAX,
    ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
    vibrate: [0, 600, 200, 600, 200, 800] as number[],
    sticky: false,
    autoDismiss: false,
    badge: 1,
    data: {
      screen: 'reminders',
      reminderId: reminder.id,
      burstIndex,
    },
    ...(Platform.OS === 'android'
      ? {
          channelId: ALARM_CHANNEL_ID,
          color: '#f59e0b',
        }
      : {}),
  };
}

/**
 * Schedule a ring-storm: primary alarm at due time, then follow-ups every
 * few seconds so the phone keeps alerting like a snooze-less alarm clock.
 */
export async function scheduleReminderNotification(reminder: ReminderLike): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  await cancelReminderNotification(reminder.id);

  if (reminder.done) return false;

  const dueDate = new Date(reminder.dueAt);
  if (Number.isNaN(dueDate.getTime())) return false;
  if (dueDate.getTime() <= Date.now() + 500) return false;

  const burstCount = Math.floor(RING_BURST_SECONDS / RING_INTERVAL_SECONDS) + 1;
  let scheduled = 0;

  for (let i = 0; i < burstCount; i++) {
    const when = new Date(dueDate.getTime() + i * RING_INTERVAL_SECONDS * 1000);
    if (when.getTime() <= Date.now() + 500) continue;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId(reminder.id, i),
        content: alarmContent(reminder, i),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID } : {}),
        },
      });
      scheduled += 1;
    } catch (err) {
      // Retry once with default sound if custom sound failed
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId(reminder.id, i),
          content: {
            ...alarmContent(reminder, i),
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
            ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID } : {}),
          },
        });
        scheduled += 1;
      } catch (err2) {
        if (__DEV__) console.warn('[notifications] schedule failed', err2 ?? err);
      }
    }
  }

  return scheduled > 0;
}

export async function scheduleTestAlarm(seconds = 10): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const ready = await ensureAlarmReady();
  if (!ready) return false;

  // Cancel previous test burst
  for (let i = 0; i < 8; i++) {
    await Notifications.cancelScheduledNotificationAsync(`devhub-test-alarm-${i}`).catch(
      () => undefined,
    );
  }

  const base = Date.now() + Math.max(5, seconds) * 1000;
  let ok = 0;
  for (let i = 0; i < 8; i++) {
    const when = new Date(base + i * RING_INTERVAL_SECONDS * 1000);
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `devhub-test-alarm-${i}`,
        content: {
          title: i === 0 ? '⏰ TEST ALARM' : '⏰ Test still ringing…',
          body: 'Lock your phone — you should hear sound and feel vibration. Open the app and dismiss.',
          sound: 'alarm.wav',
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
          vibrate: [0, 600, 200, 600, 200, 800],
          ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID, color: '#f59e0b' } : {}),
          data: { screen: 'reminders', test: true },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID } : {}),
        },
      });
      ok += 1;
    } catch {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `devhub-test-alarm-${i}`,
          content: {
            title: i === 0 ? '⏰ TEST ALARM' : '⏰ Test still ringing…',
            body: 'Lock your phone — you should hear sound and feel vibration.',
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
            vibrate: [0, 600, 200, 600, 200, 800],
            ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID, color: '#f59e0b' } : {}),
            data: { screen: 'reminders', test: true },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
            ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID } : {}),
          },
        });
        ok += 1;
      } catch {
        // ignore
      }
    }
  }
  return ok > 0;
}

export async function syncReminderNotifications(reminders: ReminderLike[]): Promise<void> {
  if (Platform.OS === 'web') return;
  await ensureAlarmReady();
  await Promise.all(reminders.map(scheduleReminderNotification));
}

export { stopAlarmPlayer, startAlarmPlayer, isAlarmPlaying } from '@/lib/alarm-player';
