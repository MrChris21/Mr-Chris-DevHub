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

/**
 * In-app toast + optional browser notification for a due reminder.
 * Requires the Sonner <Toaster /> to be mounted (see App.tsx).
 */
export function fireAlarm(title: string, description?: string | null) {
  toast("Reminder!", {
    description: description?.trim() ? `${title} — ${description}` : title,
    duration: 10_000,
  });

  if (!notificationsSupported()) return;
  try {
    if (Notification.permission === "granted") {
      new Notification("Mr. Chris DevHub", {
        body: description?.trim() ? `${title}\n${description}` : title,
        icon: "/icon-192.png",
        tag: `reminder-${title}`,
      });
    }
  } catch {
    // Browser notification is best-effort; toast already shown
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
