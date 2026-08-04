import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, promptsTable } from "@workspace/db";
import {
  CreatePromptBody,
  CreatePromptResponse,
  DeletePromptParams,
  GetPromptParams,
  GetPromptResponse,
  ListPromptsResponse,
  UpdatePromptBody,
  UpdatePromptParams,
  UpdatePromptResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/prompts", async (_req, res): Promise<void> => {
  const rows = await db.select().from(promptsTable).orderBy(desc(promptsTable.updatedAt));
  res.json(ListPromptsResponse.parse(serializeDates(rows)));
});

router.post("/prompts", async (req, res): Promise<void> => {
  const parsed = CreatePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(promptsTable).values(parsed.data).returning();
  res.status(201).json(CreatePromptResponse.parse(serializeDates(row)));
});

router.get("/prompts/:id", async (req, res): Promise<void> => {
  const params = GetPromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(promptsTable).where(eq(promptsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  res.json(GetPromptResponse.parse(serializeDates(row)));
});

router.patch("/prompts/:id", async (req, res): Promise<void> => {
  const params = UpdatePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(promptsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(promptsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  res.json(UpdatePromptResponse.parse(serializeDates(row)));
});

router.delete("/prompts/:id", async (req, res): Promise<void> => {
  const params = DeletePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(promptsTable).where(eq(promptsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
