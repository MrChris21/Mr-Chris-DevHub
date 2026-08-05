import { toast } from "sonner";

// Bumped when the in-app toaster was fixed so reminders that were
// silently "fired" (toast never rendered) can alert once more.
const FIRED_KEY = "fired_reminders_v2";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getFiredIds(): number[] {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

export function markFired(id: number) {
  try {
    const fired = new Set(getFiredIds());
    fired.add(id);
    localStorage.setItem(FIRED_KEY, JSON.stringify([...fired]));
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function clearFired(id: number) {
  try {
    const fired = getFiredIds().filter((x) => x !== id);
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    // ignore
  }
}

/** Phone vibration when supported (mobile browsers / some desktops). */
function vibrateAlarm() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      // Alarm-like pulse pattern (ms)
      navigator.vibrate([400, 150, 400, 150, 400, 150, 600, 200, 400]);
    }
  } catch {
    // ignore
  }
}

/** Play a short multi-beep alarm through Web Audio (no external file). */
function playAlarmSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const beeps = [
      { t: 0, f: 880 },
      { t: 0.22, f: 988 },
      { t: 0.44, f: 880 },
      { t: 0.66, f: 1175 },
      { t: 1.0, f: 880 },
      { t: 1.22, f: 988 },
      { t: 1.44, f: 1319 },
    ];

    for (const { t, f } of beeps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.18, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.18);
    }

    // Close after sequence finishes to free resources.
    window.setTimeout(() => {
      void ctx.close();
    }, 2200);
  } catch {
    // Autoplay may be blocked until a user gesture; toast still shows.
  }
}

/**
 * In-app toast + vibration + alarm sound + browser notification when allowed.
 * Requires the Sonner <Toaster /> to be mounted (see App.tsx).
 *
 * Note: true closed-tab / phone-off alarms need the DevHub mobile app
 * (OS-scheduled local notifications). Browser pages cannot reliably ring
 * after the tab is fully closed without a native app or push service.
 */
export function fireAlarm(title: string, description?: string | null) {
  toast("⏰ Reminder alarm!", {
    description: description?.trim() ? `${title} — ${description}` : title,
    duration: 15_000,
  });

  vibrateAlarm();
  playAlarmSound();

  if (!notificationsSupported()) return;
  try {
    if (Notification.permission === "granted") {
      const n = new Notification("⏰ Mr. Chris DevHub", {
        body: description?.trim() ? `${title}\n${description}` : title,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: `reminder-alarm-${title}`,
        requireInteraction: true,
        silent: false,
        // Chromium mobile: vibration pattern for the system notification
        // @ts-expect-error vibrate is non-standard but widely supported on Android Chrome
        vibrate: [400, 150, 400, 150, 400, 150, 600],
      });
      // Some browsers auto-close; keep it until user interacts if possible.
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {
    // Browser notification is best-effort; toast + sound already shown
  }
}

type ReminderLike = {
  id: number;
  title: string;
  description?: string | null;
  dueAt: string;
  done: boolean;
};

/** Check pending reminders and fire any that are due and not yet fired. */
export function checkReminderAlarms(reminders: ReminderLike[] | undefined | null) {
  if (!reminders?.length) return;

  try {
    const now = Date.now();
    const fired = new Set(getFiredIds());

    for (const r of reminders) {
      if (r.done) continue;
      const due = new Date(r.dueAt).getTime();
      if (Number.isNaN(due) || due > now) continue;
      if (fired.has(r.id)) continue;

      fireAlarm(r.title, r.description);
      markFired(r.id);
      fired.add(r.id);
    }
  } catch (err) {
    console.error("Reminder alarm check failed:", err);
  }
}
