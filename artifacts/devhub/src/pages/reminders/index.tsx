import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useListReminders,
  useCreateReminder,
  useUpdateReminder,
  useDeleteReminder,
  getListRemindersQueryKey,
  Reminder,
  ReminderUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, isOverdue } from "@/lib/date-utils";
import {
  BellRing,
  Plus,
  Trash2,
  Clock,
  Check,
  Pencil,
  Eye,
  Bell,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  clearFired,
  notificationsSupported,
  testAlarmClock,
  unlockAlarmAudio,
} from "@/lib/reminder-alarms";
import { ShareButton } from "@/components/share-button";
import { formatReminderShare } from "@/lib/share";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoFromDatetimeLocal(value: string): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type EditForm = {
  title: string;
  description: string;
  dueAt: string;
  done: boolean;
};

function reminderToForm(r: Reminder): EditForm {
  return {
    title: r.title ?? "",
    description: r.description ?? "",
    dueAt: toDatetimeLocalValue(r.dueAt),
    done: !!r.done,
  };
}

export default function Reminders() {
  const queryClient = useQueryClient();
  const { data: reminders, isLoading, isError, error, refetch } = useListReminders();
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  const [viewing, setViewing] = useState<Reminder | null>(null);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!notificationsSupported()) {
      setNotifPermission("unsupported");
      return;
    }
    setNotifPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (editing) setForm(reminderToForm(editing));
    else setForm(null);
  }, [editing]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
  }, [queryClient]);

  // Alarm polling lives in <ReminderAlarmWatcher /> (App.tsx) so it works on every route.

  const requestNotifications = async () => {
    // Unlock audio on the same user gesture so the alarm can ring later
    await unlockAlarmAudio();
    if (!notificationsSupported()) {
      toast.message("Browser notifications are not supported here — in-app alarm still works.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === "granted") {
        toast.success("Notifications on — alarm will ring with sound until you dismiss");
      } else {
        toast.message("Notifications blocked — full-screen in-app alarm will still ring.");
      }
    } catch {
      toast.error("Could not request notification permission");
    }
  };

  const handleTestAlarm = async () => {
    await unlockAlarmAudio();
    toast.message("Starting test alarm…");
    await testAlarmClock();
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    const isoDate = toIsoFromDatetimeLocal(newDueAt);
    if (!isoDate) {
      toast.error("Please pick a valid due date and time");
      return;
    }

    void unlockAlarmAudio();
    createReminder.mutate(
      {
        data: {
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          dueAt: isoDate,
          done: false,
        },
      },
      {
        onSuccess: (created) => {
          setNewTitle("");
          setNewDescription("");
          setNewDueAt("");
          // Allow this reminder to fire when its time comes
          clearFired(created.id);
          invalidate();
          toast.success("Alarm set — it will ring until you dismiss");
          setViewing(created);
        },
        onError: (err) => {
          toast.error(err?.message || "Failed to create reminder");
        },
      },
    );
  };

  const toggleDone = (id: number, currentDone: boolean) => {
    updateReminder.mutate(
      { id, data: { done: !currentDone } },
      {
        onSuccess: (updated) => {
          if (!updated.done) clearFired(id);
          invalidate();
        },
        onError: () => toast.error("Failed to update reminder"),
      },
    );
  };

  const handleDelete = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this reminder?")) return;
    deleteReminder.mutate(
      { id },
      {
        onSuccess: () => {
          if (viewing?.id === id) setViewing(null);
          if (editing?.id === id) setEditing(null);
          clearFired(id);
          invalidate();
          toast.success("Reminder deleted");
        },
        onError: () => toast.error("Failed to delete reminder"),
      },
    );
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !form) return;
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const isoDate = toIsoFromDatetimeLocal(form.dueAt);
    if (!isoDate) {
      toast.error("Please pick a valid due date and time");
      return;
    }

    const data: ReminderUpdate = {
      title: form.title.trim(),
      description: form.description.trim(),
      dueAt: isoDate,
      done: form.done,
    };

    setSaving(true);
    updateReminder.mutate(
      { id: editing.id, data },
      {
        onSuccess: (updated) => {
          setSaving(false);
          setEditing(null);
          // If due date changed to the future, allow alarm again
          if (new Date(updated.dueAt).getTime() > Date.now()) {
            clearFired(updated.id);
          }
          invalidate();
          toast.success("Reminder updated");
          setViewing(updated);
        },
        onError: () => {
          setSaving(false);
          toast.error("Failed to save reminder");
        },
      },
    );
  };

  const activeReminders = useMemo(
    () =>
      (reminders?.filter((r) => !r.done) || []).sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
      ),
    [reminders],
  );

  const doneReminders = useMemo(
    () =>
      (reminders?.filter((r) => r.done) || []).sort(
        (a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime(),
      ),
    [reminders],
  );

  const ReminderRow = ({ r }: { r: Reminder }) => {
    const overdue = isOverdue(r.dueAt) && !r.done;
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        <Card
          className={`border-border/50 transition-colors cursor-pointer ${
            r.done ? "bg-card/20" : "bg-card/50 hover:bg-card/80"
          } ${overdue ? "border-amber-500/50" : ""}`}
          onClick={() => setViewing(r)}
        >
          <CardContent className="p-3 sm:p-4 flex items-start sm:items-center gap-3 sm:gap-4">
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={r.done}
                onCheckedChange={() => toggleDone(r.id, r.done)}
                className="w-5 h-5 rounded-full border-muted-foreground data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <p
                className={`font-medium break-words whitespace-pre-wrap ${
                  r.done ? "line-through text-muted-foreground" : ""
                }`}
              >
                {r.title}
              </p>
              {r.description ? (
                <p className="text-xs sm:text-sm text-muted-foreground break-words whitespace-pre-wrap line-clamp-3">
                  {r.description}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Clock
                  className={`w-3.5 h-3.5 shrink-0 ${
                    overdue ? "text-amber-500" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-xs font-mono ${
                    overdue ? "text-amber-500 font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {formatDateTime(r.dueAt) || "Invalid date"}
                </span>
                {overdue && (
                  <Badge
                    variant="outline"
                    className="text-[9px] uppercase tracking-wider text-amber-500 border-amber-500/30 px-1 py-0 h-4"
                  >
                    Overdue
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <ShareButton payload={formatReminderShare(r)} title="Share reminder" />
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setViewing(r)}
                title="View"
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setEditing(r)}
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => handleDelete(r.id, e)}
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 h-full flex flex-col min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono text-primary">
            Reminders
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Set a title, details, and time — we&apos;ll alert you when it&apos;s due.
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-2 bg-amber-500 hover:bg-amber-500/90 text-black"
              onClick={handleTestAlarm}
            >
              <BellRing className="w-4 h-4" />
              Test alarm now
            </Button>
            {notifPermission !== "unsupported" && notifPermission !== "granted" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={requestNotifications}
              >
                <Bell className="w-4 h-4" />
                Enable notifications
              </Button>
            )}
          </div>
          {notifPermission === "granted" && (
            <Badge variant="secondary" className="self-start sm:self-end gap-1.5 font-normal">
              <Bell className="w-3.5 h-3.5 text-emerald-500" />
              Alarm clock armed (rings until dismiss)
            </Badge>
          )}
          {notifPermission === "unsupported" && (
            <Badge variant="outline" className="self-start sm:self-end gap-1.5 font-normal">
              <BellOff className="w-3.5 h-3.5" />
              In-tab alarm clock
            </Badge>
          )}
          <p className="text-[11px] text-muted-foreground max-w-[18rem] sm:text-right leading-snug">
            On Mac: leave this tab open (or in background). The alarm rings full-screen with
            continuous sound until you press <strong>Dismiss</strong>. On iPhone closed-app
            ringing uses the <strong>mobile app</strong> with notification permission.
          </p>
        </div>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reminder-title">Title</Label>
              <Input
                id="reminder-title"
                placeholder="What to remind?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-background/50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-description">Description</Label>
              <Textarea
                id="reminder-description"
                placeholder="Optional details..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="min-h-[80px] resize-y bg-background/50"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="space-y-2 flex-1 min-w-0">
                <Label htmlFor="reminder-due">Due date &amp; time</Label>
                <Input
                  id="reminder-due"
                  type="datetime-local"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="bg-background/50 w-full"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={createReminder.isPending || !newTitle.trim() || !newDueAt}
                className="w-full sm:w-auto shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createReminder.isPending ? "Saving..." : "Set Reminder"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-12 text-center border-2 border-dashed border-destructive/40 rounded-xl space-y-3">
          <p className="text-destructive font-medium">Failed to load reminders</p>
          <p className="text-sm text-muted-foreground px-4">
            {(error as Error)?.message || "Unknown error"}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-8 pb-8">
          {activeReminders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                <BellRing className="w-4 h-4" /> Pending ({activeReminders.length})
              </h2>
              <div className="space-y-2">
                <AnimatePresence>
                  {activeReminders.map((r) => (
                    <ReminderRow key={r.id} r={r} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {doneReminders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2 opacity-50">
                <Check className="w-4 h-4" /> Completed ({doneReminders.length})
              </h2>
              <div className="space-y-2 opacity-70">
                <AnimatePresence>
                  {doneReminders.map((r) => (
                    <ReminderRow key={r.id} r={r} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {activeReminders.length === 0 && doneReminders.length === 0 && (
            <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
              No reminders set. Add one above.
            </div>
          )}
        </div>
      )}

      {/* View full details */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">Reminder details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-5 py-1">
              <div className="space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Title
                </p>
                <p className="text-base sm:text-lg font-semibold break-words whitespace-pre-wrap">
                  {viewing.title}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Description
                </p>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4">
                  {viewing.description ? (
                    <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">
                      {viewing.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No description</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Due
                  </p>
                  <p className="text-sm font-mono">{formatDateTime(viewing.dueAt)}</p>
                  {isOverdue(viewing.dueAt) && !viewing.done && (
                    <Badge
                      variant="outline"
                      className="text-amber-500 border-amber-500/30 text-[10px]"
                    >
                      Overdue
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <Badge variant={viewing.done ? "secondary" : "outline"}>
                    {viewing.done ? "Completed" : "Pending"}
                  </Badge>
                </div>
              </div>
              <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
                <ShareButton
                  payload={formatReminderShare(viewing)}
                  label="Share"
                  variant="outline"
                  size="default"
                  title="Share reminder"
                />
                <Button type="button" variant="outline" onClick={() => setViewing(null)}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const r = viewing;
                    setViewing(null);
                    setEditing(r);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">Edit Reminder</DialogTitle>
          </DialogHeader>
          {form && editing && (
            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-reminder-title">Title</Label>
                <Input
                  id="edit-reminder-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reminder-description">Description</Label>
                <Textarea
                  id="edit-reminder-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="min-h-[100px] resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reminder-due">Due date &amp; time</Label>
                <Input
                  id="edit-reminder-due"
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-reminder-done"
                  checked={form.done}
                  onCheckedChange={(checked) => setForm({ ...form, done: checked === true })}
                />
                <Label htmlFor="edit-reminder-done" className="font-normal cursor-pointer">
                  Mark as completed
                </Label>
              </div>
              <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
                <Button
                  type="button"
                  variant="destructive"
                  className="sm:mr-auto"
                  onClick={() => handleDelete(editing.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || updateReminder.isPending}>
                  {saving || updateReminder.isPending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
