import React, { useEffect, useState } from "react";
import { useListReminders, useCreateReminder, useUpdateReminder, useDeleteReminder, getListRemindersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, isOverdue } from "@/lib/date-utils";
import { BellRing, Plus, Trash2, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Reminders() {
  const queryClient = useQueryClient();
  const { data: reminders, isLoading } = useListReminders();
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  const [newTitle, setNewTitle] = useState("");
  const [newDueAt, setNewDueAt] = useState("");

  // Notification logic
  useEffect(() => {
    if (!reminders) return;

    const checkAlarms = () => {
      const now = new Date();
      reminders.forEach((r) => {
        if (!r.done && new Date(r.dueAt) <= now) {
          const fired = JSON.parse(localStorage.getItem("fired_reminders") || "[]");
          if (!fired.includes(r.id)) {
            // Trigger
            if (Notification.permission === "granted") {
              new Notification("Mr. Chris DevHub", { body: r.title, icon: "/vite.svg" });
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                  new Notification("Mr. Chris DevHub", { body: r.title, icon: "/vite.svg" });
                }
              });
            }
            // Mark as fired
            localStorage.setItem("fired_reminders", JSON.stringify([...fired, r.id]));
            toast("Reminder!", { description: r.title, icon: <BellRing className="w-4 h-4 text-amber-500"/> });
          }
        }
      });
    };

    const interval = setInterval(checkAlarms, 10000); // Check every 10s
    checkAlarms(); // check immediately

    return () => clearInterval(interval);
  }, [reminders]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDueAt) return;
    
    // ensure dueAt is valid ISO
    const isoDate = new Date(newDueAt).toISOString();

    createReminder.mutate({ data: { title: newTitle, dueAt: isoDate, done: false } }, {
      onSuccess: () => {
        setNewTitle("");
        setNewDueAt("");
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
        toast.success("Reminder set");
      }
    });
  };

  const toggleDone = (id: number, currentDone: boolean) => {
    updateReminder.mutate({ id, data: { done: !currentDone } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() })
    });
  };

  const handleDelete = (id: number) => {
    deleteReminder.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() })
    });
  };

  const activeReminders = reminders?.filter(r => !r.done).sort((a,b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()) || [];
  const doneReminders = reminders?.filter(r => r.done).sort((a,b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()) || [];

  const ReminderRow = ({ r }: { r: any }) => {
    const overdue = isOverdue(r.dueAt) && !r.done;
    return (
      <motion.div layout initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <Card className={`border-border/50 transition-colors ${r.done ? 'bg-card/20' : 'bg-card/50 hover:bg-card/80'} ${overdue ? 'border-amber-500/50' : ''}`}>
          <CardContent className="p-4 flex items-center gap-4">
            <Checkbox 
              checked={r.done} 
              onCheckedChange={() => toggleDone(r.id, r.done)}
              className="w-5 h-5 rounded-full border-muted-foreground data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
            />
            
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${r.done ? 'line-through text-muted-foreground' : ''}`}>
                {r.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className={`w-3.5 h-3.5 ${overdue ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-mono ${overdue ? 'text-amber-500 font-semibold' : 'text-muted-foreground'}`}>
                  {formatDateTime(r.dueAt)}
                </span>
                {overdue && <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-amber-500 border-amber-500/30 px-1 py-0 h-4">Overdue</Badge>}
              </div>
            </div>

            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive opacity-50 hover:opacity-100" onClick={() => handleDelete(r.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-mono text-primary">Reminders</h1>
        <p className="text-muted-foreground mt-1">Don't forget the important things.</p>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <Input 
              placeholder="What to remind?" 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 bg-background/50"
            />
            <Input 
              type="datetime-local" 
              value={newDueAt}
              onChange={(e) => setNewDueAt(e.target.value)}
              className="w-auto bg-background/50"
            />
            <Button type="submit" disabled={createReminder.isPending || !newTitle.trim() || !newDueAt}>
              <Plus className="w-4 h-4 mr-2" />
              Set Alarm
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="space-y-8 pb-8">
          {activeReminders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                <BellRing className="w-4 h-4" /> Pending
              </h2>
              <div className="space-y-2">
                {activeReminders.map(r => <ReminderRow key={r.id} r={r} />)}
              </div>
            </div>
          )}

          {doneReminders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2 opacity-50">
                <Check className="w-4 h-4" /> Completed
              </h2>
              <div className="space-y-2 opacity-70">
                {doneReminders.map(r => <ReminderRow key={r.id} r={r} />)}
              </div>
            </div>
          )}

          {activeReminders.length === 0 && doneReminders.length === 0 && (
            <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
              No reminders set.
            </div>
          )}
        </div>
      )}
    </div>
  );
}