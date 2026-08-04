import { describe, it, expect, afterAll } from "vitest";
import { agent, expectStatus } from "./helpers.js";

const created: number[] = [];

afterAll(async () => {
  for (const id of created) {
    await agent.delete(`/api/tasks/${id}`);
  }
});

describe("Tasks CRUD", () => {
  let taskId: number;

  it("POST /api/tasks — creates a task", async () => {
    const res = await agent.post("/api/tasks").send({
      title: "Test Task",
      description: "A test task",
      status: "todo",
      priority: "high",
      tags: ["test"],
    });
    const body = expectStatus(res, 201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: "Test Task",
      status: "todo",
      priority: "high",
      tags: ["test"],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    taskId = body.id;
    created.push(taskId);
  });

  it("GET /api/tasks — lists tasks and includes the created one", async () => {
    const res = await agent.get("/api/tasks");
    const body = expectStatus(res, 200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((t: { id: number }) => t.id === taskId)).toBe(true);
  });

  it("GET /api/tasks/:id — retrieves the task by id", async () => {
    const res = await agent.get(`/api/tasks/${taskId}`);
    const body = expectStatus(res, 200);
    expect(body.id).toBe(taskId);
    expect(body.title).toBe("Test Task");
  });

  it("PATCH /api/tasks/:id — updates task status to in_progress", async () => {
    const res = await agent.patch(`/api/tasks/${taskId}`).send({ status: "in_progress" });
    const body = expectStatus(res, 200);
    expect(body.status).toBe("in_progress");
  });

  it("PATCH /api/tasks/:id — sets a due date", async () => {
    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await agent.patch(`/api/tasks/${taskId}`).send({ dueAt });
    const body = expectStatus(res, 200);
    expect(body.dueAt).toBeTruthy();
  });

  it("GET /api/tasks/:id — returns 404 for missing task", async () => {
    const res = await agent.get("/api/tasks/999999999");
    expectStatus(res, 404);
  });

  it("DELETE /api/tasks/:id — deletes the task", async () => {
    const res = await agent.delete(`/api/tasks/${taskId}`);
    expectStatus(res, 204);
    created.splice(created.indexOf(taskId), 1);
  });

  it("GET /api/tasks/:id — returns 404 after delete", async () => {
    const res = await agent.get(`/api/tasks/${taskId}`);
    expectStatus(res, 404);
  });
});
