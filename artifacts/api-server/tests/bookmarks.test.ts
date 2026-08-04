import { describe, it, expect, afterAll } from "vitest";
import { agent, expectStatus } from "./helpers.js";

const created: number[] = [];

afterAll(async () => {
  for (const id of created) {
    await agent.delete(`/api/bookmarks/${id}`);
  }
});

describe("Bookmarks CRUD", () => {
  let bookmarkId: number;

  it("POST /api/bookmarks — creates a bookmark", async () => {
    const res = await agent.post("/api/bookmarks").send({
      title: "Test Bookmark",
      url: "https://example.com",
      description: "A test bookmark",
      tags: ["example", "test"],
    });
    const body = expectStatus(res, 201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: "Test Bookmark",
      url: "https://example.com",
      tags: expect.arrayContaining(["example"]),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    bookmarkId = body.id;
    created.push(bookmarkId);
  });

  it("GET /api/bookmarks — lists bookmarks and includes the created one", async () => {
    const res = await agent.get("/api/bookmarks");
    const body = expectStatus(res, 200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((b: { id: number }) => b.id === bookmarkId)).toBe(true);
  });

  it("GET /api/bookmarks/:id — retrieves the bookmark by id", async () => {
    const res = await agent.get(`/api/bookmarks/${bookmarkId}`);
    const body = expectStatus(res, 200);
    expect(body.id).toBe(bookmarkId);
    expect(body.title).toBe("Test Bookmark");
    expect(body.url).toBe("https://example.com");
  });

  it("PATCH /api/bookmarks/:id — updates the title and description", async () => {
    const res = await agent
      .patch(`/api/bookmarks/${bookmarkId}`)
      .send({ title: "Updated Bookmark", description: "Updated description" });
    const body = expectStatus(res, 200);
    expect(body.title).toBe("Updated Bookmark");
    expect(body.description).toBe("Updated description");
  });

  it("GET /api/bookmarks/:id — returns 404 for missing bookmark", async () => {
    const res = await agent.get("/api/bookmarks/999999999");
    expectStatus(res, 404);
  });

  it("DELETE /api/bookmarks/:id — deletes the bookmark", async () => {
    const res = await agent.delete(`/api/bookmarks/${bookmarkId}`);
    expectStatus(res, 204);
    created.splice(created.indexOf(bookmarkId), 1);
  });

  it("GET /api/bookmarks/:id — returns 404 after delete", async () => {
    const res = await agent.get(`/api/bookmarks/${bookmarkId}`);
    expectStatus(res, 404);
  });
});
