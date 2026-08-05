import { useEffect, useRef } from "react";
import { useListReminders, getListRemindersQueryKey } from "@workspace/api-client-react";
import {
  checkReminderAlarms,
  unlockAlarmAudio,
  type ReminderLike,
} from "@/lib/reminder-alarms";

/**
 * App-wide alarm scheduler:
 * - Exact setTimeout per upcoming reminder (fires on the second)
 * - 1s safety poll + refetch every 20s
 * - Re-checks when the tab becomes visible again
 */
export function ReminderAlarmWatcher() {
  const { data: reminders } = useListReminders({
    query: {
      queryKey: getListRemindersQueryKey(),
      refetchInterval: 20_000,
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  });

  const timersRef = useRef<Map<number, number>>(new Map());

  // Clear + reschedule exact timers whenever the list changes
  useEffect(() => {
    const timers = timersRef.current;
    // clear old
    for (const t of timers.values()) window.clearTimeout(t);
    timers.clear();

    if (!reminders?.length) return;

    const now = Date.now();
    for (const r of reminders as ReminderLike[]) {
      if (r.done) continue;
      const due = new Date(r.dueAt).getTime();
      if (Number.isNaN(due)) continue;

      if (due <= now) {
        // already due — handled by poll below
        continue;
      }

      const delay = due - now + 50; // tiny buffer so wall clock catches up
      const handle = window.setTimeout(() => {
        checkReminderAlarms(reminders as ReminderLike[]);
      }, delay);
      timers.set(r.id, handle);
    }

    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
      timers.clear();
    };
  }, [reminders]);

  // Fast poll (1s) so we never miss by more than a second
  useEffect(() => {
    const tick = () => {
      if (reminders?.length) checkReminderAlarms(reminders as ReminderLike[]);
    };
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [reminders]);

  // When user returns to the tab, re-check immediately
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && reminders?.length) {
        checkReminderAlarms(reminders as ReminderLike[]);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [reminders]);

  // Soft-unlock audio hint on first load after a prior unlock in this session
  useEffect(() => {
    void unlockAlarmAudio().catch(() => undefined);
  }, []);

  return null;
}
