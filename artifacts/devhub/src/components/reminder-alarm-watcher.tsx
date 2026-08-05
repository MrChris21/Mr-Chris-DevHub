import { useEffect } from "react";
import { useListReminders, getListRemindersQueryKey } from "@workspace/api-client-react";
import { checkReminderAlarms } from "@/lib/reminder-alarms";

/**
 * Polls reminders app-wide so due alarms fire on any route,
 * not only while the Reminders page is open.
 */
export function ReminderAlarmWatcher() {
  const { data: reminders } = useListReminders({
    query: {
      queryKey: getListRemindersQueryKey(),
      // Keep data reasonably fresh for alarm accuracy without hammering the API.
      refetchInterval: 30_000,
      staleTime: 15_000,
    },
  });

  useEffect(() => {
    if (!reminders?.length) return;

    const tick = () => checkReminderAlarms(reminders);
    tick();
    const interval = window.setInterval(tick, 10_000);
    return () => window.clearInterval(interval);
  }, [reminders]);

  return null;
}
