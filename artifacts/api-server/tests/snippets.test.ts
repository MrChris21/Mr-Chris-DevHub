import { describe, it, expect, afterAll } from "vitest";
import { agent, expectStatus } from "./helpers.js";

const created: number[] = [];

afterAll(async () => {
  for (const id of created) {
    await agent.delete(`/api/snippets/${id}`);
  }
});

describe("Snippets CRUD", () => {
  let snippetId: number;

  it("POST /api/snippets — creates a snippet", async () => {
    const res = await agent.post("/api/snippets").send({
      title: "Test Snippet",
      code: 'console.log("hello world");',
      language: "javascript",
      description: "A simple hello world",
      tags: ["js", "test"],
    });
    const body = expectStatus(res, 201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: "Test Snippet",
      language: "javascript",
      tags: expect.arrayContaining(["js"]),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    snippetId = body.id;
    created.push(snippetId);
  });

  it("GET /api/snippets — lists snippets and includes the created one", async () => {
    const res = await agent.get("/api/snippets");
    const body = expectStatus(res, 200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((s: { id: number }) => s.id === snippetId)).toBe(true);
  });

  it("GET /api/snippets/:id — retrieves the snippet by id", async () => {
    const res = await agent.get(`/api/snippets/${snippetId}`);
    const body = expectStatus(res, 200);
    expect(body.id).toBe(snippetId);
    expect(body.title).toBe("Test Snippet");
    expect(body.language).toBe("javascript");
  });

  it("PATCH /api/snippets/:id — updates the language", async () => {
    const res = await agent.patch(`/api/snippets/${snippetId}`).send({ language: "typescript" });
    const body = expectStatus(res, 200);
    expect(body.language).toBe("typescript");
  });

  it("GET /api/snippets/:id — returns 404 for missing snippet", async () => {
    const res = await agent.get("/api/snippets/999999999");
    expectStatus(res, 404);
  });

  it("DELETE /api/snippets/:id — deletes the snippet", async () => {
    const res = await agent.delete(`/api/snippets/${snippetId}`);
    expectStatus(res, 204);
    created.splice(created.indexOf(snippetId), 1);
  });

  it("GET /api/snippets/:id — returns 404 after delete", async () => {
    const res = await agent.get(`/api/snippets/${snippetId}`);
    expectStatus(res, 404);
  });
});
