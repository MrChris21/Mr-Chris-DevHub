import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db, notesTable, remindersTable, meetingsTable, tasksTable, promptsTable, snippetsTable, bookmarksTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    noteCount,
    reminderCount,
    meetingCount,
    taskCount,
    promptCount,
    snippetCount,
    bookmarkCount,
    upcomingReminders,
    todayMeetings,
    recentNotes,
    pendingTasks,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(notesTable).then(r => r[0]?.count ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(remindersTable).then(r => r[0]?.count ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(meetingsTable).then(r => r[0]?.count ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).then(r => r[0]?.count ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(promptsTable).then(r => r[0]?.count ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(snippetsTable).then(r => r[0]?.count ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(bookmarksTable).then(r => r[0]?.count ?? 0),
    // Upcoming reminders: not done, due within 7 days
    db.select().from(remindersTable)
      .where(and(eq(remindersTable.done, false), gt(remindersTable.dueAt, now), lt(remindersTable.dueAt, inOneWeek)))
      .orderBy(asc(remindersTable.dueAt))
      .limit(5),
    // Today's meetings
    db.select().from(meetingsTable)
      .where(and(gt(meetingsTable.startAt, todayStart), lt(meetingsTable.startAt, todayEnd)))
      .orderBy(asc(meetingsTable.startAt)),
    // Recent notes (top 5)
    db.select().from(notesTable).orderBy(desc(notesTable.updatedAt)).limit(5),
    // Pending tasks (todo or in_progress)
    db.select().from(tasksTable)
      .where(sql`${tasksTable.status} IN ('todo', 'in_progress')`)
      .orderBy(desc(tasksTable.createdAt))
      .limit(10),
  ]);

  const summary = {
    counts: {
      notes: noteCount,
      reminders: reminderCount,
      meetings: meetingCount,
      tasks: taskCount,
      prompts: promptCount,
      snippets: snippetCount,
      bookmarks: bookmarkCount,
    },
    upcomingReminders,
    todayMeetings,
    recentNotes,
    pendingTasks,
  };

  res.json(GetDashboardSummaryResponse.parse(serializeDates(summary)));
});

export default router;
