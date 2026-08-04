import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, remindersTable } from "@workspace/db";
import {
  CreateReminderBody,
  CreateReminderResponse,
  DeleteReminderParams,
  GetReminderParams,
  GetReminderResponse,
  ListRemindersResponse,
  UpdateReminderBody,
  UpdateReminderParams,
  UpdateReminderResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/reminders", async (_req, res): Promise<void> => {
  const rows = await db.select().from(remindersTable).orderBy(asc(remindersTable.dueAt));
  res.json(ListRemindersResponse.parse(serializeDates(rows)));
});

router.post("/reminders", async (req, res): Promise<void> => {
  const parsed = CreateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(remindersTable).values({
    ...parsed.data,
    dueAt: new Date(parsed.data.dueAt),
  }).returning();
  res.status(201).json(CreateReminderResponse.parse(serializeDates(row)));
});

router.get("/reminders/:id", async (req, res): Promise<void> => {
  const params = GetReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(remindersTable).where(eq(remindersTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  res.json(GetReminderResponse.parse(serializeDates(row)));
});

router.patch("/reminders/:id", async (req, res): Promise<void> => {
  const params = UpdateReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.dueAt) updateData.dueAt = new Date(parsed.data.dueAt);
  const [row] = await db.update(remindersTable).set(updateData).where(eq(remindersTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  res.json(UpdateReminderResponse.parse(serializeDates(row)));
});

router.delete("/reminders/:id", async (req, res): Promise<void> => {
  const params = DeleteReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(remindersTable).where(eq(remindersTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
