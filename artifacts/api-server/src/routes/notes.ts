import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import {
  CreateNoteBody,
  CreateNoteResponse,
  DeleteNoteParams,
  GetNoteParams,
  GetNoteResponse,
  ListNotesResponse,
  UpdateNoteBody,
  UpdateNoteParams,
  UpdateNoteResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/notes", async (_req, res): Promise<void> => {
  const rows = await db.select().from(notesTable).orderBy(desc(notesTable.updatedAt));
  res.json(ListNotesResponse.parse(serializeDates(rows)));
});

router.post("/notes", async (req, res): Promise<void> => {
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(notesTable).values(parsed.data).returning();
  res.status(201).json(CreateNoteResponse.parse(serializeDates(row)));
});

router.get("/notes/:id", async (req, res): Promise<void> => {
  const params = GetNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(notesTable).where(eq(notesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(GetNoteResponse.parse(serializeDates(row)));
});

router.patch("/notes/:id", async (req, res): Promise<void> => {
  const params = UpdateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(notesTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(notesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(UpdateNoteResponse.parse(serializeDates(row)));
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(notesTable).where(eq(notesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
