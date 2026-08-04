import { describe, it, expect, afterAll } from "vitest";
import { agent, expectStatus } from "./helpers.js";

const created: number[] = [];

afterAll(async () => {
  for (const id of created) {
    await agent.delete(`/api/prompts/${id}`);
  }
});

describe("Prompts CRUD", () => {
  let promptId: number;

  it("POST /api/prompts — creates a prompt", async () => {
    const res = await agent.post("/api/prompts").send({
      title: "Test Prompt",
      content: "Summarize the following text: {{input}}",
      model: "gpt-4o",
      tags: ["summarize", "test"],
    });
    const body = expectStatus(res, 201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: "Test Prompt",
      content: "Summarize the following text: {{input}}",
      model: "gpt-4o",
      tags: expect.arrayContaining(["summarize"]),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    promptId = body.id;
    created.push(promptId);
  });

  it("GET /api/prompts — lists prompts and includes the created one", async () => {
    const res = await agent.get("/api/prompts");
    const body = expectStatus(res, 200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((p: { id: number }) => p.id === promptId)).toBe(true);
  });

  it("GET /api/prompts/:id — retrieves the prompt by id", async () => {
    const res = await agent.get(`/api/prompts/${promptId}`);
    const body = expectStatus(res, 200);
    expect(body.id).toBe(promptId);
    expect(body.title).toBe("Test Prompt");
  });

  it("PATCH /api/prompts/:id — updates the model", async () => {
    const res = await agent.patch(`/api/prompts/${promptId}`).send({ model: "claude-3-5-sonnet" });
    const body = expectStatus(res, 200);
    expect(body.model).toBe("claude-3-5-sonnet");
  });

  it("GET /api/prompts/:id — returns 404 for missing prompt", async () => {
    const res = await agent.get("/api/prompts/999999999");
    expectStatus(res, 404);
  });

  it("DELETE /api/prompts/:id — deletes the prompt", async () => {
    const res = await agent.delete(`/api/prompts/${promptId}`);
    expectStatus(res, 204);
    created.splice(created.indexOf(promptId), 1);
  });

  it("GET /api/prompts/:id — returns 404 after delete", async () => {
    const res = await agent.get(`/api/prompts/${promptId}`);
    expectStatus(res, 404);
  });
});
