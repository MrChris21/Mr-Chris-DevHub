import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, bookmarksTable } from "@workspace/db";
import {
  CreateBookmarkBody,
  CreateBookmarkResponse,
  DeleteBookmarkParams,
  GetBookmarkParams,
  GetBookmarkResponse,
  ListBookmarksResponse,
  UpdateBookmarkBody,
  UpdateBookmarkParams,
  UpdateBookmarkResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/bookmarks", async (_req, res): Promise<void> => {
  const rows = await db.select().from(bookmarksTable).orderBy(desc(bookmarksTable.createdAt));
  res.json(ListBookmarksResponse.parse(serializeDates(rows)));
});

router.post("/bookmarks", async (req, res): Promise<void> => {
  const parsed = CreateBookmarkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(bookmarksTable).values(parsed.data).returning();
  res.status(201).json(CreateBookmarkResponse.parse(serializeDates(row)));
});

router.get("/bookmarks/:id", async (req, res): Promise<void> => {
  const params = GetBookmarkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(bookmarksTable).where(eq(bookmarksTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Bookmark not found" });
    return;
  }
  res.json(GetBookmarkResponse.parse(serializeDates(row)));
});

router.patch("/bookmarks/:id", async (req, res): Promise<void> => {
  const params = UpdateBookmarkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBookmarkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(bookmarksTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(bookmarksTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Bookmark not found" });
    return;
  }
  res.json(UpdateBookmarkResponse.parse(serializeDates(row)));
});

router.delete("/bookmarks/:id", async (req, res): Promise<void> => {
  const params = DeleteBookmarkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(bookmarksTable).where(eq(bookmarksTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Bookmark not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
