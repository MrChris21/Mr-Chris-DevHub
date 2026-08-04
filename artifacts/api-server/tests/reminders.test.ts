import { describe, it, expect, afterAll } from "vitest";
import { agent, expectStatus } from "./helpers.js";

const created: number[] = [];
const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

afterAll(async () => {
  for (const id of created) {
    await agent.delete(`/api/reminders/${id}`);
  }
});

describe("Reminders CRUD", () => {
  let reminderId: number;

  it("POST /api/reminders — creates a reminder", async () => {
    const res = await agent.post("/api/reminders").send({
      title: "Test Reminder",
      description: "Don't forget",
      dueAt: futureDate,
      done: false,
    });
    const body = expectStatus(res, 201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: "Test Reminder",
      done: false,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    reminderId = body.id;
    created.push(reminderId);
  });

  it("GET /api/reminders — lists reminders and includes the created one", async () => {
    const res = await agent.get("/api/reminders");
    const body = expectStatus(res, 200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((r: { id: number }) => r.id === reminderId)).toBe(true);
  });

  it("GET /api/reminders/:id — retrieves the reminder by id", async () => {
    const res = await agent.get(`/api/reminders/${reminderId}`);
    const body = expectStatus(res, 200);
    expect(body.id).toBe(reminderId);
    expect(body.title).toBe("Test Reminder");
  });

  it("PATCH /api/reminders/:id — marks reminder as done", async () => {
    const res = await agent.patch(`/api/reminders/${reminderId}`).send({ done: true });
    const body = expectStatus(res, 200);
    expect(body.done).toBe(true);
  });

  it("GET /api/reminders/:id — returns 404 for missing reminder", async () => {
    const res = await agent.get("/api/reminders/999999999");
    expectStatus(res, 404);
  });

  it("DELETE /api/reminders/:id — deletes the reminder", async () => {
    const res = await agent.delete(`/api/reminders/${reminderId}`);
    expectStatus(res, 204);
    created.splice(created.indexOf(reminderId), 1);
  });

  it("GET /api/reminders/:id — returns 404 after delete", async () => {
    const res = await agent.get(`/api/reminders/${reminderId}`);
    expectStatus(res, 404);
  });
});
