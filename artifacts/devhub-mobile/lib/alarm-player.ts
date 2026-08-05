/**
 * In-app looping alarm player for when a notification fires while the app
 * is open / comes to foreground. Uses expo-av + Vibration so it feels like
 * a real alarm clock until the user stops it.
 */

import { Audio } from 'expo-av';
import { Platform, Vibration } from 'react-native';

let sound: Audio.Sound | null = null;
let vibrateInterval: ReturnType<typeof setInterval> | null = null;
let active = false;

export function isAlarmPlaying(): boolean {
  return active;
}

async function ensureAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true, // ring even if iPhone is on silent (alarm-like)
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

function startVibrationLoop() {
  stopVibrationLoop();
  const pattern = Platform.OS === 'android' ? [0, 600, 200, 600, 200, 800] : [600, 400];
  // Android supports repeating; iOS needs interval restarts
  if (Platform.OS === 'android') {
    Vibration.vibrate(pattern, true);
  } else {
    Vibration.vibrate(pattern);
    vibrateInterval = setInterval(() => {
      Vibration.vibrate(pattern);
    }, 1400);
  }
}

function stopVibrationLoop() {
  if (vibrateInterval) {
    clearInterval(vibrateInterval);
    vibrateInterval = null;
  }
  Vibration.cancel();
}

/** Start looping alarm sound + vibration until stopAlarmPlayer(). */
export async function startAlarmPlayer(): Promise<void> {
  if (active) return;
  active = true;
  try {
    await ensureAudioMode();
    startVibrationLoop();

    // Prefer bundled custom alarm sound
    const { sound: s } = await Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../assets/sounds/alarm.wav'),
      { isLooping: true, volume: 1.0, shouldPlay: true },
    );
    sound = s;
    await s.playAsync();
  } catch (err) {
    if (__DEV__) console.warn('[alarm-player] start failed', err);
    // Vibration may still be running
  }
}

/** Stop sound + vibration. */
export async function stopAlarmPlayer(): Promise<void> {
  active = false;
  stopVibrationLoop();
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {
      // ignore
    }
    sound = null;
  }
}
