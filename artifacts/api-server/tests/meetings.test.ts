import { describe, it, expect, afterAll } from "vitest";
import { agent, expectStatus } from "./helpers.js";

const created: number[] = [];
const startAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
const endAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();

afterAll(async () => {
  for (const id of created) {
    await agent.delete(`/api/meetings/${id}`);
  }
});

describe("Meetings CRUD", () => {
  let meetingId: number;

  it("POST /api/meetings — creates a meeting", async () => {
    const res = await agent.post("/api/meetings").send({
      title: "Test Meeting",
      description: "A test meeting",
      startAt,
      endAt,
      meetLink: "https://meet.example.com/test",
    });
    const body = expectStatus(res, 201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: "Test Meeting",
      meetLink: "https://meet.example.com/test",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    meetingId = body.id;
    created.push(meetingId);
  });

  it("GET /api/meetings — lists meetings and includes the created one", async () => {
    const res = await agent.get("/api/meetings");
    const body = expectStatus(res, 200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((m: { id: number }) => m.id === meetingId)).toBe(true);
  });

  it("GET /api/meetings/:id — retrieves the meeting by id", async () => {
    const res = await agent.get(`/api/meetings/${meetingId}`);
    const body = expectStatus(res, 200);
    expect(body.id).toBe(meetingId);
    expect(body.title).toBe("Test Meeting");
  });

  it("PATCH /api/meetings/:id — updates the meeting title", async () => {
    const res = await agent.patch(`/api/meetings/${meetingId}`).send({ title: "Updated Meeting" });
    const body = expectStatus(res, 200);
    expect(body.title).toBe("Updated Meeting");
  });

  it("GET /api/meetings/:id — returns 404 for missing meeting", async () => {
    const res = await agent.get("/api/meetings/999999999");
    expectStatus(res, 404);
  });

  it("DELETE /api/meetings/:id — deletes the meeting", async () => {
    const res = await agent.delete(`/api/meetings/${meetingId}`);
    expectStatus(res, 204);
    created.splice(created.indexOf(meetingId), 1);
  });

  it("GET /api/meetings/:id — returns 404 after delete", async () => {
    const res = await agent.get(`/api/meetings/${meetingId}`);
    expectStatus(res, 404);
  });
});
