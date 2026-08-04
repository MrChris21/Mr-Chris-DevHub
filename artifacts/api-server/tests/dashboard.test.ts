import { describe, it, expect, afterAll } from "vitest";
import { agent, expectStatus } from "./helpers.js";

// Track all created IDs for cleanup
const createdNotes: number[] = [];
const createdTasks: number[] = [];
const createdReminders: number[] = [];

afterAll(async () => {
  await Promise.all([
    ...createdNotes.map((id) => agent.delete(`/api/notes/${id}`)),
    ...createdTasks.map((id) => agent.delete(`/api/tasks/${id}`)),
    ...createdReminders.map((id) => agent.delete(`/api/reminders/${id}`)),
  ]);
});

describe("Dashboard summary", () => {
  it("GET /api/dashboard/summary — returns the summary shape", async () => {
    const res = await agent.get("/api/dashboard/summary");
    const body = expectStatus(res, 200);

    expect(body).toMatchObject({
      counts: {
        notes: expect.any(Number),
        reminders: expect.any(Number),
        meetings: expect.any(Number),
        tasks: expect.any(Number),
        prompts: expect.any(Number),
        snippets: expect.any(Number),
        bookmarks: expect.any(Number),
      },
      upcomingReminders: expect.any(Array),
      todayMeetings: expect.any(Array),
      recentNotes: expect.any(Array),
      pendingTasks: expect.any(Array),
    });
  });

  it("counts.notes increments after creating a note", async () => {
    const before = await agent
      .get("/api/dashboard/summary")
      .then((r) => expectStatus(r, 200));
    const notesCountBefore: number = before.counts.notes;

    const created = await agent
      .post("/api/notes")
      .send({ title: "Dashboard Count Test", content: "" })
      .then((r) => expectStatus(r, 201));
    createdNotes.push(created.id);

    const after = await agent
      .get("/api/dashboard/summary")
      .then((r) => expectStatus(r, 200));
    expect(after.counts.notes).toBe(notesCountBefore + 1);
  });

  it("counts.tasks increments after creating a task", async () => {
    const before = await agent
      .get("/api/dashboard/summary")
      .then((r) => expectStatus(r, 200));
    const tasksCountBefore: number = before.counts.tasks;

    const created = await agent
      .post("/api/tasks")
      .send({ title: "Dashboard Task Test", status: "todo", priority: "low" })
      .then((r) => expectStatus(r, 201));
    createdTasks.push(created.id);

    const after = await agent
      .get("/api/dashboard/summary")
      .then((r) => expectStatus(r, 200));
    expect(after.counts.tasks).toBe(tasksCountBefore + 1);
  });

  it("pendingTasks includes newly created todo task", async () => {
    const created = await agent
      .post("/api/tasks")
      .send({ title: "Pending Task Test", status: "todo", priority: "medium" })
      .then((r) => expectStatus(r, 201));
    createdTasks.push(created.id);

    const summary = await agent
      .get("/api/dashboard/summary")
      .then((r) => expectStatus(r, 200));

    const found = summary.pendingTasks.some(
      (t: { id: number }) => t.id === created.id,
    );
    expect(found).toBe(true);
  });

  it("upcomingReminders includes a reminder due within 7 days", async () => {
    const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const created = await agent
      .post("/api/reminders")
      .send({ title: "Upcoming Reminder Test", dueAt, done: false })
      .then((r) => expectStatus(r, 201));
    createdReminders.push(created.id);

    const summary = await agent
      .get("/api/dashboard/summary")
      .then((r) => expectStatus(r, 200));

    const found = summary.upcomingReminders.some(
      (r: { id: number }) => r.id === created.id,
    );
    expect(found).toBe(true);
  });

  it("recentNotes includes the most recently updated note", async () => {
    const created = await agent
      .post("/api/notes")
      .send({ title: "Recent Note Test", content: "Just added" })
      .then((r) => expectStatus(r, 201));
    createdNotes.push(created.id);

    const summary = await agent
      .get("/api/dashboard/summary")
      .then((r) => expectStatus(r, 200));

    const found = summary.recentNotes.some(
      (n: { id: number }) => n.id === created.id,
    );
    expect(found).toBe(true);
  });
});
