/**
 * Alarm-clock style reminder system for the web app (Mac / Safari / Chrome).
 *
 * - Exact timers per reminder (not just a coarse poll)
 * - Full-screen ringing UI until the user dismisses
 * - Looping alarm sound + vibration until dismiss
 * - Browser notifications when permission is granted
 * - AudioContext unlocked after first user gesture (required by browsers)
 */

import { toast } from "sonner";

const DISMISSED_KEY = "dismissed_reminders_v3";
const AUDIO_UNLOCK_KEY = "devhub_audio_unlocked";

export type RingingAlarm = {
  id: number;
  title: string;
  description?: string | null;
  dueAt: string;
  startedAt: number;
};

type Listener = () => void;

let ringing: RingingAlarm | null = null;
const listeners = new Set<Listener>();

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;
let loopNodes: Array<AudioNode | OscillatorNode | GainNode> = [];
let loopTimer: number | null = null;
let vibrateTimer: number | null = null;
let htmlAudio: HTMLAudioElement | null = null;

function notify() {
  for (const l of listeners) l();
}

export function subscribeAlarm(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRingingAlarm(): RingingAlarm | null {
  return ringing;
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getDismissedIds(): number[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

export function markDismissed(id: number) {
  try {
    const set = new Set(getDismissedIds());
    set.add(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function clearDismissed(id: number) {
  try {
    const next = getDismissedIds().filter((x) => x !== id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** Back-compat aliases used by the reminders page */
export const clearFired = clearDismissed;
export const markFired = markDismissed;
export const getFiredIds = getDismissedIds;

// ─── Audio unlock (browsers block autoplay until a gesture) ───────────────────

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

/** Call from any user click so later alarms can ring without a gesture. */
export async function unlockAlarmAudio(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }
    // Prime HTMLAudio as well (Safari likes this)
    if (!htmlAudio) {
      htmlAudio = new Audio("/sounds/alarm.wav");
      htmlAudio.loop = true;
      htmlAudio.preload = "auto";
      htmlAudio.volume = 1;
    }
    // Play silent blip then pause to unlock
    htmlAudio.currentTime = 0;
    const p = htmlAudio.play();
    if (p) {
      await p.catch(() => undefined);
      htmlAudio.pause();
      htmlAudio.currentTime = 0;
    }
    audioUnlocked = true;
    try {
      sessionStorage.setItem(AUDIO_UNLOCK_KEY, "1");
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

export function isAudioUnlocked(): boolean {
  if (audioUnlocked) return true;
  try {
    return sessionStorage.getItem(AUDIO_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

// ─── Sound + vibration loop ───────────────────────────────────────────────────

function stopSoundAndVibrate() {
  if (loopTimer != null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
  }
  if (vibrateTimer != null) {
    window.clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(0);
  } catch {
    // ignore
  }
  for (const n of loopNodes) {
    try {
      // OscillatorNode
      if ("stop" in n && typeof (n as OscillatorNode).stop === "function") {
        (n as OscillatorNode).stop();
      }
      n.disconnect();
    } catch {
      // ignore
    }
  }
  loopNodes = [];
  if (htmlAudio) {
    try {
      htmlAudio.pause();
      htmlAudio.currentTime = 0;
    } catch {
      // ignore
    }
  }
}

function startVibrateLoop() {
  const pulse = () => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([500, 200, 500, 200, 500, 400]);
      }
    } catch {
      // ignore
    }
  };
  pulse();
  vibrateTimer = window.setInterval(pulse, 1600);
}

function startWebAudioLoop() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  loopNodes.push(master);

  // Two alternating alarm tones
  const freqs = [880, 1175];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    // LFO pulse
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 3 + i;
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    g.gain.value = 0.08;
    osc.connect(g);
    g.connect(master);
    osc.start();
    lfo.start();
    loopNodes.push(osc, g, lfo, lfoGain);
  });

  // Also tick a siren warble every few seconds via gain bump
  loopTimer = window.setInterval(() => {
    try {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(0.22, t);
      master.gain.linearRampToValueAtTime(0.35, t + 0.08);
      master.gain.linearRampToValueAtTime(0.18, t + 0.35);
    } catch {
      // ignore
    }
  }, 900);
}

async function startHtmlAudioLoop() {
  try {
    if (!htmlAudio) {
      htmlAudio = new Audio("/sounds/alarm.wav");
      htmlAudio.loop = true;
      htmlAudio.volume = 1;
    }
    htmlAudio.currentTime = 0;
    await htmlAudio.play();
  } catch {
    // fall through to web audio
  }
}

async function startSoundAndVibrate() {
  stopSoundAndVibrate();
  startVibrateLoop();
  try {
    const ctx = getAudioContext();
    if (ctx?.state === "suspended") await ctx.resume();
  } catch {
    // ignore
  }
  await startHtmlAudioLoop();
  // Web Audio as backup / layer
  try {
    startWebAudioLoop();
  } catch {
    // ignore
  }
}

// ─── Public alarm API ─────────────────────────────────────────────────────────

export type ReminderLike = {
  id: number;
  title: string;
  description?: string | null;
  dueAt: string;
  done: boolean;
};

/**
 * Start a persistent alarm-clock ring for a reminder.
 * Keeps sounding + vibrating until dismissAlarm() is called.
 */
export async function startAlarmRinging(reminder: ReminderLike): Promise<void> {
  if (typeof window === "undefined") return;
  if (reminder.done) return;
  if (getDismissedIds().includes(reminder.id)) return;

  // Already ringing this one
  if (ringing?.id === reminder.id) return;

  // Switch to new alarm if another is ringing
  if (ringing) {
    stopSoundAndVibrate();
  }

  ringing = {
    id: reminder.id,
    title: reminder.title,
    description: reminder.description,
    dueAt: reminder.dueAt,
    startedAt: Date.now(),
  };
  notify();

  toast("⏰ ALARM", {
    description: reminder.description?.trim()
      ? `${reminder.title} — ${reminder.description}`
      : reminder.title,
    duration: Infinity,
    id: `alarm-${reminder.id}`,
  });

  await startSoundAndVibrate();

  // System notification (Mac Notification Center / iOS Safari when available)
  if (notificationsSupported() && Notification.permission === "granted") {
    try {
      const n = new Notification("⏰ Alarm — Mr. Chris DevHub", {
        body: reminder.description?.trim()
          ? `${reminder.title}\n${reminder.description}`
          : reminder.title,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: `devhub-alarm-${reminder.id}`,
        requireInteraction: true,
        silent: false, // let OS play notification sound too
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // ignore
    }
  }

  // Try to keep screen awake while ringing
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (nav.wakeLock) {
      void nav.wakeLock.request("screen").catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

/** Stop sound/vibration and mark the reminder as dismissed. */
export function dismissAlarm(id?: number): void {
  const targetId = id ?? ringing?.id;
  if (targetId != null) {
    markDismissed(targetId);
    try {
      toast.dismiss(`alarm-${targetId}`);
    } catch {
      // ignore
    }
  }
  stopSoundAndVibrate();
  ringing = null;
  notify();
}

/**
 * Scan reminders and start ringing any that are due and not dismissed.
 * Returns how many newly started.
 */
export function checkReminderAlarms(reminders: ReminderLike[] | undefined | null): number {
  if (!reminders?.length) return 0;
  let started = 0;
  try {
    const now = Date.now();
    const dismissed = new Set(getDismissedIds());

    // Prefer the earliest due pending reminder for the active ring
    const due = reminders
      .filter((r) => !r.done && !dismissed.has(r.id))
      .map((r) => ({ r, due: new Date(r.dueAt).getTime() }))
      .filter(({ due }) => !Number.isNaN(due) && due <= now)
      .sort((a, b) => a.due - b.due);

    if (due.length === 0) return 0;

    // If already ringing a still-due alarm, keep it
    if (ringing && due.some(({ r }) => r.id === ringing!.id)) {
      return 0;
    }

    const next = due[0].r;
    void startAlarmRinging(next);
    started = 1;
  } catch (err) {
    console.error("Reminder alarm check failed:", err);
  }
  return started;
}

/** Fire a 15s live test of the full alarm-clock UI + sound. */
export async function testAlarmClock(): Promise<void> {
  await unlockAlarmAudio();
  await startAlarmRinging({
    id: -1,
    title: "Test alarm",
    description: "If you hear continuous sound, the alarm clock is working. Tap Dismiss.",
    dueAt: new Date().toISOString(),
    done: false,
  });
  // Auto-stop test after 45s so it doesn't run forever if user walks away
  window.setTimeout(() => {
    if (ringing?.id === -1) dismissAlarm(-1);
  }, 45_000);
}

// Legacy name used by older call sites
export function fireAlarm(title: string, description?: string | null) {
  void startAlarmRinging({
    id: -Date.now(),
    title,
    description,
    dueAt: new Date().toISOString(),
    done: false,
  });
}
