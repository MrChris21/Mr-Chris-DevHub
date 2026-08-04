import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, snippetsTable } from "@workspace/db";
import {
  CreateSnippetBody,
  CreateSnippetResponse,
  DeleteSnippetParams,
  GetSnippetParams,
  GetSnippetResponse,
  ListSnippetsResponse,
  UpdateSnippetBody,
  UpdateSnippetParams,
  UpdateSnippetResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/snippets", async (_req, res): Promise<void> => {
  const rows = await db.select().from(snippetsTable).orderBy(desc(snippetsTable.updatedAt));
  res.json(ListSnippetsResponse.parse(serializeDates(rows)));
});

router.post("/snippets", async (req, res): Promise<void> => {
  const parsed = CreateSnippetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(snippetsTable).values(parsed.data).returning();
  res.status(201).json(CreateSnippetResponse.parse(serializeDates(row)));
});

router.get("/snippets/:id", async (req, res): Promise<void> => {
  const params = GetSnippetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(snippetsTable).where(eq(snippetsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }
  res.json(GetSnippetResponse.parse(serializeDates(row)));
});

router.patch("/snippets/:id", async (req, res): Promise<void> => {
  const params = UpdateSnippetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSnippetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(snippetsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(snippetsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }
  res.json(UpdateSnippetResponse.parse(serializeDates(row)));
});

router.delete("/snippets/:id", async (req, res): Promise<void> => {
  const params = DeleteSnippetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(snippetsTable).where(eq(snippetsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
