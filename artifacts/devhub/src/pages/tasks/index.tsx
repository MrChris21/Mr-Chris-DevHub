import React, { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, useDeleteTask, getListTasksQueryKey, Task, TaskStatus, TaskPriority } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, CheckCircle2, Circle, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function TasksBoard() {
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useListTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    createTask.mutate({ data: { title: newTaskTitle, status: "todo", priority: "medium" } }, {
      onSuccess: () => {
        setNewTaskTitle("");
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast.success("Task created");
      }
    });
  };

  const handleUpdateStatus = (id: number, newStatus: TaskStatus) => {
    updateTask.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => {
        // Optimistic update would be better, but invalidation is safer
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteTask.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      }
    });
  };

  const filteredTasks = tasks?.filter(t => filterPriority === "all" ? true : t.priority === filterPriority) || [];
  
  const columns: { id: TaskStatus; label: string; icon: React.ReactNode }[] = [
    { id: "todo", label: "To Do", icon: <Circle className="w-4 h-4 text-muted-foreground" /> },
    { id: "in_progress", label: "In Progress", icon: <Clock className="w-4 h-4 text-blue-500" /> },
    { id: "done", label: "Done", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
  ];

  const getPriorityColor = (priority: TaskPriority) => {
    switch(priority) {
      case "high": return "text-destructive border-destructive/30 bg-destructive/10";
      case "medium": return "text-amber-500 border-amber-500/30 bg-amber-500/10";
      case "low": return "text-muted-foreground border-border/50";
    }
  };

  const TaskCard = ({ task }: { task: Task }) => (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
      <Card className="hover-elevate cursor-grab active:cursor-grabbing border-border/50 bg-card/60 backdrop-blur group">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground/30 mt-0.5 shrink-0" />
            <p className={`text-sm font-medium leading-tight flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </p>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 -mt-1 -mr-1" onClick={() => handleDelete(task.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center justify-between ml-6">
            <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </Badge>
            
            <Select 
              value={task.status} 
              onValueChange={(val) => handleUpdateStatus(task.id, val as TaskStatus)}
            >
              <SelectTrigger className="h-6 text-[10px] border-border/50 w-[100px] bg-background/50">
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

  return (
    <div className="h-full flex flex-col space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono text-primary">Tasks</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your pending work.</p>
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

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full max-w-xl">
        <Input 
          placeholder="Add a new task..." 
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          className="bg-card/50 border-border/50 focus-visible:ring-primary/50 min-w-0 flex-1"
        />
        <Button type="submit" disabled={createTask.isPending || !newTaskTitle.trim()} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </form>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1">
          {columns.map(c => (
            <div key={c.id} className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 min-h-0 overflow-auto pb-4 safe-area-bottom">
          {columns.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="flex flex-col min-h-[12rem] lg:min-h-0 lg:h-full bg-muted/10 rounded-xl p-3 sm:p-4 border border-border/30">
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
                    {colTasks.map(task => (
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
    </div>
  );
}