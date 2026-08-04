import React from "react";
import { Link } from "wouter";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, getRelativeTime, isOverdue } from "@/lib/date-utils";
import {
  FileText,
  BellRing,
  CalendarDays,
  CheckSquare,
  Sparkles,
  Code2,
  Bookmark,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-destructive">Failed to load dashboard data.</p>
      </div>
    );
  }

  const stats = [
    { label: "Notes", value: summary.counts.notes, icon: FileText, href: "/notes", color: "text-blue-500" },
    { label: "Tasks", value: summary.counts.tasks, icon: CheckSquare, href: "/tasks", color: "text-emerald-500" },
    { label: "Reminders", value: summary.counts.reminders, icon: BellRing, href: "/reminders", color: "text-amber-500" },
    { label: "Meetings", value: summary.counts.meetings, icon: CalendarDays, href: "/meetings", color: "text-purple-500" },
    { label: "Prompts", value: summary.counts.prompts, icon: Sparkles, href: "/prompts", color: "text-pink-500" },
    { label: "Snippets", value: summary.counts.snippets, icon: Code2, href: "/snippets", color: "text-indigo-500" },
    { label: "Bookmarks", value: summary.counts.bookmarks, icon: Bookmark, href: "/bookmarks", color: "text-rose-500" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-8"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono text-primary">Overview</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">Welcome back to your command center.</p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="min-w-0">
            <Card className="h-full hover-elevate cursor-pointer border-border/50 hover:border-primary/50 transition-colors bg-card/50 backdrop-blur">
              <CardContent className="p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2">
                <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color} mb-0.5`} />
                <div className="text-xl sm:text-2xl font-bold font-mono">{stat.value}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider truncate w-full">{stat.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <Card className="col-span-1 border-border/50 bg-card/50">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-500" />
              Upcoming Reminders
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {summary.upcomingReminders.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No upcoming reminders</div>
            ) : (
              <div className="divide-y divide-border/50">
                {summary.upcomingReminders.map((r) => {
                  const overdue = isOverdue(r.dueAt) && !r.done;
                  return (
                    <div key={r.id} className="p-4 flex flex-col gap-1 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${r.done ? 'line-through text-muted-foreground' : ''}`}>{r.title}</span>
                        <Badge variant={overdue ? "destructive" : "secondary"} className="text-[10px] font-mono">
                          {getRelativeTime(r.dueAt)}
                        </Badge>
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 border-border/50 bg-card/50">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-500" />
              Pending Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {summary.pendingTasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Inbox zero!</div>
            ) : (
              <div className="divide-y divide-border/50">
                {summary.pendingTasks.map((t) => (
                  <div key={t.id} className="p-4 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.title}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                      {t.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 xl:col-span-1 border-border/50 bg-card/50">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-purple-500" />
              Today's Meetings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {summary.todayMeetings.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No meetings today</div>
            ) : (
              <div className="divide-y divide-border/50">
                {summary.todayMeetings.map((m) => {
                  const past = isOverdue(m.startAt);
                  return (
                    <div key={m.id} className={`p-4 flex flex-col gap-2 transition-colors ${past ? 'opacity-60' : 'hover:bg-muted/20'}`}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-mono text-muted-foreground">{formatTime(m.startAt)} {m.endAt ? `- ${formatTime(m.endAt)}` : ''}</span>
                      </div>
                      <div className="font-medium">{m.title}</div>
                      {m.meetLink && (
                        <a href={m.meetLink} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline w-fit">
                          Join Meeting
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}