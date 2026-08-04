import { describe, it, expect, afterAll } from "vitest";
import { agent, expectStatus } from "./helpers.js";

const created: number[] = [];

afterAll(async () => {
  for (const id of created) {
    await agent.delete(`/api/notes/${id}`);
  }
});

describe("Notes CRUD", () => {
  let noteId: number;

  it("POST /api/notes — creates a note", async () => {
    const res = await agent.post("/api/notes").send({
      title: "Test Note",
      content: "Hello from tests",
      tags: ["test"],
      pinned: false,
    });
    const body = expectStatus(res, 201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: "Test Note",
      content: "Hello from tests",
      tags: ["test"],
      pinned: false,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    noteId = body.id;
    created.push(noteId);
  });

  it("GET /api/notes — lists notes and includes the created one", async () => {
    const res = await agent.get("/api/notes");
    const body = expectStatus(res, 200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((n: { id: number }) => n.id === noteId)).toBe(true);
  });

  it("GET /api/notes/:id — retrieves the note by id", async () => {
    const res = await agent.get(`/api/notes/${noteId}`);
    const body = expectStatus(res, 200);
    expect(body.id).toBe(noteId);
    expect(body.title).toBe("Test Note");
  });

  it("PATCH /api/notes/:id — updates the note", async () => {
    const res = await agent.patch(`/api/notes/${noteId}`).send({ title: "Updated Note", pinned: true });
    const body = expectStatus(res, 200);
    expect(body.id).toBe(noteId);
    expect(body.title).toBe("Updated Note");
    expect(body.pinned).toBe(true);
  });

  it("GET /api/notes/:id — returns 404 for missing note", async () => {
    const res = await agent.get("/api/notes/999999999");
    expectStatus(res, 404);
  });

  it("DELETE /api/notes/:id — deletes the note", async () => {
    const res = await agent.delete(`/api/notes/${noteId}`);
    expectStatus(res, 204);
    created.splice(created.indexOf(noteId), 1);
  });

  it("GET /api/notes/:id — returns 404 after delete", async () => {
    const res = await agent.get(`/api/notes/${noteId}`);
    expectStatus(res, 404);
  });
});
