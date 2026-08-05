import { useEffect, useState } from "react";
import { BellRing, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dismissAlarm,
  getRingingAlarm,
  subscribeAlarm,
  unlockAlarmAudio,
  type RingingAlarm,
} from "@/lib/reminder-alarms";

/**
 * Full-screen alarm clock UI. Stays up and keeps sound/vibration going
 * until the user taps Dismiss — same idea as iOS/macOS Clock.
 */
export function AlarmClockOverlay() {
  const [alarm, setAlarm] = useState<RingingAlarm | null>(() => getRingingAlarm());
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeAlarm(() => setAlarm(getRingingAlarm())), []);

  // Unlock audio on first pointer interaction anywhere in the app
  useEffect(() => {
    const unlock = () => {
      void unlockAlarmAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);

  // Pulse the UI while ringing
  useEffect(() => {
    if (!alarm) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(id);
  }, [alarm]);

  // Re-kick sound if tab becomes visible again while still ringing
  useEffect(() => {
    if (!alarm) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && getRingingAlarm()) {
        void unlockAlarmAudio();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [alarm]);

  if (!alarm) return null;

  const flash = tick % 2 === 0;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Alarm ringing"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{
        background: flash
          ? "radial-gradient(circle at center, rgba(245,158,11,0.95), rgba(127,29,29,0.98))"
          : "radial-gradient(circle at center, rgba(239,68,68,0.95), rgba(69,10,10,0.98))",
      }}
    >
      <div className="w-full max-w-md text-center space-y-6 text-white">
        <div className="flex justify-center">
          <div
            className={`rounded-full p-5 bg-white/15 ring-4 ring-white/30 ${
              flash ? "scale-110" : "scale-100"
            } transition-transform`}
          >
            <BellRing className="w-14 h-14" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-white/80">
            Alarm · Mr. Chris DevHub
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight break-words">
            {alarm.title}
          </h2>
          {alarm.description ? (
            <p className="text-base sm:text-lg text-white/90 break-words whitespace-pre-wrap">
              {alarm.description}
            </p>
          ) : null}
          <p className="text-sm font-mono text-white/70 flex items-center justify-center gap-2">
            <Volume2 className="w-4 h-4" />
            Ringing until you dismiss
          </p>
        </div>

        <Button
          size="lg"
          className="w-full h-14 text-lg font-semibold bg-white text-red-700 hover:bg-white/90 gap-2"
          onClick={() => {
            void unlockAlarmAudio();
            dismissAlarm(alarm.id);
          }}
        >
          <X className="w-5 h-5" />
          Dismiss alarm
        </Button>
      </div>
    </div>
  );
}
