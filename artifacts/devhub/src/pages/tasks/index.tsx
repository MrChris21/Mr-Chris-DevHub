import React, { useEffect, useState } from "react";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
  Task,
  TaskStatus,
  TaskPriority,
  TaskUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Pencil,
  CalendarDays,
  Tag,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ShareButton } from "@/components/share-button";
import { formatTaskShare } from "@/lib/share";

/** Looping status gifs (from Photos/) — always shown for each status. */
const STATUS_GIF: Record<TaskStatus, { src: string; alt: string }> = {
  todo: { src: "to-do-list.gif", alt: "To do" },
  in_progress: { src: "workspace.gif", alt: "Working" },
  done: { src: "like.gif", alt: "Done" },
};

function statusGifUrl(status: TaskStatus) {
  const file = STATUS_GIF[status]?.src ?? STATUS_GIF.todo.src;
  return `${import.meta.env.BASE_URL}${file}`;
}

function StatusGif({
  status,
  size = "md",
  className = "",
}: {
  status: TaskStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = STATUS_GIF[status] ?? STATUS_GIF.todo;
  const sizeClass =
    size === "lg"
      ? "w-14 h-14 sm:w-16 sm:h-16"
      : size === "sm"
        ? "w-6 h-6"
        : "w-12 h-12 sm:w-14 sm:h-14";
  return (
    <img
      src={statusGifUrl(status)}
      alt={meta.alt}
      title={meta.alt}
      className={`${sizeClass} object-contain shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function formatDue(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type EditForm = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string;
  tags: string;
};

function taskToForm(task: Task): EditForm {
  return {
    title: task.title ?? "",
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    dueAt: toDatetimeLocalValue(task.dueAt),
    tags: (task.tags ?? []).join(", "),
  };
}

export default function TasksBoard() {
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useListTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingTask) {
      setForm(taskToForm(editingTask));
    } else {
      setForm(null);
    }
  }, [editingTask]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    createTask.mutate(
      {
        data: {
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || undefined,
          status: "todo",
          priority: "medium",
        },
      },
      {
        onSuccess: (created) => {
          setNewTaskTitle("");
          setNewTaskDescription("");
          invalidate();
          toast.success("Task created");
          // Open full details so the user can read everything they just added
          setViewingTask(created);
        },
        onError: () => toast.error("Failed to create task"),
      },
    );
  };

  const handleUpdateStatus = (id: number, newStatus: TaskStatus) => {
    updateTask.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => invalidate(),
        onError: () => toast.error("Failed to update status"),
      },
    );
  };

  const handleUpdatePriority = (id: number, priority: TaskPriority) => {
    updateTask.mutate(
      { id, data: { priority } },
      {
        onSuccess: () => invalidate(),
        onError: () => toast.error("Failed to update priority"),
      },
    );
  };

  const handleDelete = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this task?")) return;
    deleteTask.mutate(
      { id },
      {
        onSuccess: () => {
          if (editingTask?.id === id) setEditingTask(null);
          if (viewingTask?.id === id) setViewingTask(null);
          invalidate();
          toast.success("Task deleted");
        },
        onError: () => toast.error("Failed to delete task"),
      },
    );
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !form) return;
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const dueIso = fromDatetimeLocalValue(form.dueAt);
    const data: TaskUpdate = {
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      tags,
      // Empty string clears due date on the server; ISO string sets it.
      dueAt: dueIso ?? "",
    };

    setSaving(true);
    updateTask.mutate(
      { id: editingTask.id, data },
      {
        onSuccess: (updated) => {
          setSaving(false);
          setEditingTask(null);
          invalidate();
          toast.success("Task updated");
          queryClient.setQueryData(getListTasksQueryKey(), (old: Task[] | undefined) =>
            old?.map((t) => (t.id === updated.id ? updated : t)),
          );
          // Show full saved data after edit
          setViewingTask(updated);
        },
        onError: () => {
          setSaving(false);
          toast.error("Failed to save task");
        },
      },
    );
  };

  const filteredTasks =
    tasks?.filter((t) => (filterPriority === "all" ? true : t.priority === filterPriority)) || [];

  const columns: { id: TaskStatus; label: string; icon: React.ReactNode }[] = [
    { id: "todo", label: "To Do", icon: <StatusGif status="todo" size="sm" /> },
    { id: "in_progress", label: "In Progress", icon: <StatusGif status="in_progress" size="sm" /> },
    { id: "done", label: "Done", icon: <StatusGif status="done" size="sm" /> },
  ];

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case "high":
        return "text-destructive border-destructive/30 bg-destructive/10";
      case "medium":
        return "text-amber-500 border-amber-500/30 bg-amber-500/10";
      case "low":
        return "text-muted-foreground border-border/50";
    }
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const dueLabel = formatDue(task.dueAt);
    const isOverdue =
      !!task.dueAt && task.status !== "done" && new Date(task.dueAt).getTime() < Date.now();

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <Card
          className="border-border/50 bg-card/60 backdrop-blur group cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setViewingTask(task)}
        >
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <StatusGif
                status={task.status}
                size={task.status === "in_progress" ? "lg" : "md"}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <p
                  className={`text-sm font-semibold leading-snug break-words whitespace-pre-wrap ${
                    task.status === "done" ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {task.title}
                </p>
                {task.description ? (
                  <p className="text-xs sm:text-sm text-muted-foreground break-words whitespace-pre-wrap leading-relaxed">
                    {task.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">No description</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0 -mt-1 -mr-1">
                <ShareButton
                  payload={formatTaskShare(task)}
                  className="h-7 w-7"
                  title="Share task"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingTask(task);
                  }}
                  title="View full details"
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTask(task);
                  }}
                  title="Edit task"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDelete(task.id, e)}
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {(dueLabel || (task.tags && task.tags.length > 0)) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {dueLabel && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono ${
                      isOverdue ? "text-amber-500" : "text-muted-foreground"
                    }`}
                  >
                    <CalendarDays className="w-3 h-3" />
                    {dueLabel}
                  </span>
                )}
                {task.tags?.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-5 bg-secondary/50"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div
              className="flex flex-wrap items-center justify-between gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Select
                value={task.priority}
                onValueChange={(val) => handleUpdatePriority(task.id, val as TaskPriority)}
              >
                <SelectTrigger
                  className={`h-7 text-[10px] font-mono w-[100px] border ${getPriorityColor(task.priority)}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">low</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="high">high</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={task.status}
                onValueChange={(val) => handleUpdateStatus(task.id, val as TaskStatus)}
              >
                <SelectTrigger className="h-7 text-[10px] border-border/50 w-[110px] bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono text-primary">
            Tasks
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Add a title and description, then open any task to read the full details.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-full sm:w-[140px] bg-card/50 border-border/50">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="w-full max-w-2xl rounded-xl border border-border/50 bg-card/40 p-4 sm:p-5 space-y-3"
      >
        <div className="space-y-2">
          <Label htmlFor="new-task-title">Title</Label>
          <Input
            id="new-task-title"
            placeholder="What needs to be done?"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="bg-background/50 border-border/50 focus-visible:ring-primary/50"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-task-description">Description</Label>
          <Textarea
            id="new-task-description"
            placeholder="Add details, notes, steps, or context..."
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            className="min-h-[96px] resize-y bg-background/50 border-border/50 focus-visible:ring-primary/50"
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={createTask.isPending || !newTaskTitle.trim()}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            {createTask.isPending ? "Adding..." : "Add Task"}
          </Button>
        </div>
      </form>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1">
          {columns.map((c) => (
            <div key={c.id} className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 min-h-0 overflow-auto pb-4 safe-area-bottom">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="flex flex-col min-h-[12rem] lg:min-h-0 lg:h-full bg-muted/10 rounded-xl p-3 sm:p-4 border border-border/30"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4 px-1">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    {col.icon}
                    {col.label}
                  </h3>
                  <Badge variant="secondary" className="text-xs bg-background">
                    {colTasks.length}
                  </Badge>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar -mx-1 px-1 sm:-mx-2 sm:px-2">
                  <AnimatePresence>
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </AnimatePresence>
                  {colTasks.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center text-sm text-muted-foreground/50">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full read-only details */}
      <Dialog
        open={!!viewingTask}
        onOpenChange={(open) => {
          if (!open) setViewingTask(null);
        }}
      >
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">Task details</DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="space-y-5 py-1">
              <div className="space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Title
                </p>
                <p className="text-base sm:text-lg font-semibold break-words whitespace-pre-wrap leading-snug">
                  {viewingTask.title}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Description
                </p>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4">
                  {viewingTask.description ? (
                    <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">
                      {viewingTask.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No description added.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusGif
                      status={viewingTask.status}
                      size={viewingTask.status === "in_progress" ? "lg" : "md"}
                    />
                    <Badge variant="secondary" className="font-mono capitalize">
                      {viewingTask.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Priority
                  </p>
                  <Badge
                    variant="outline"
                    className={`font-mono capitalize ${getPriorityColor(viewingTask.priority)}`}
                  >
                    {viewingTask.priority}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Due date
                </p>
                <p className="text-sm">
                  {formatDue(viewingTask.dueAt) ?? (
                    <span className="text-muted-foreground italic">No due date</span>
                  )}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Tags
                </p>
                {viewingTask.tags && viewingTask.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {viewingTask.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-secondary/50">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No tags</p>
                )}
              </div>

              <DialogFooter className="gap-2 flex-col-reverse sm:flex-row sm:justify-end">
                <ShareButton
                  payload={formatTaskShare(viewingTask)}
                  label="Share"
                  variant="outline"
                  size="default"
                  title="Share task"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewingTask(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const task = viewingTask;
                    setViewingTask(null);
                    setEditingTask(task);
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
      <Dialog
        open={!!editingTask}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">Edit Task</DialogTitle>
          </DialogHeader>
          {form && editingTask && (
            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="task-title">Title</Label>
                <Input
                  id="task-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Task title"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Details, notes, acceptance criteria..."
                  className="min-h-[100px] resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(val) => setForm({ ...form, status: val as TaskStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(val) => setForm({ ...form, priority: val as TaskPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-due" className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Due date
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="task-due"
                    type="datetime-local"
                    value={form.dueAt}
                    onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                    className="flex-1"
                  />
                  {form.dueAt && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setForm({ ...form, dueAt: "" })}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-tags" className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" />
                  Tags
                </Label>
                <Input
                  id="task-tags"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="work, urgent, backend (comma-separated)"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 flex-col-reverse sm:flex-row">
                <Button
                  type="button"
                  variant="destructive"
                  className="sm:mr-auto"
                  onClick={() => handleDelete(editingTask.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingTask(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || updateTask.isPending || !form.title.trim()}>
                  {saving || updateTask.isPending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
