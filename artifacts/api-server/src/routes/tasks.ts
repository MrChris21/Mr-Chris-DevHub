import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  CreateTaskBody,
  CreateTaskResponse,
  DeleteTaskParams,
  GetTaskParams,
  GetTaskResponse,
  ListTasksResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/tasks", async (_req, res): Promise<void> => {
  const rows = await db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));
  res.json(ListTasksResponse.parse(serializeDates(rows)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(tasksTable).values({
    ...parsed.data,
    dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
  }).returning();
  res.status(201).json(CreateTaskResponse.parse(serializeDates(row)));
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(GetTaskResponse.parse(serializeDates(row)));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  // Allow clearing due date with null/empty string; coerce ISO strings to Date.
  if (Object.prototype.hasOwnProperty.call(parsed.data, "dueAt")) {
    const raw = parsed.data.dueAt as string | null | undefined;
    updateData.dueAt = raw ? new Date(raw) : null;
  }
  // Allow clearing description with empty string.
  if (Object.prototype.hasOwnProperty.call(parsed.data, "description")) {
    updateData.description = parsed.data.description?.trim() ? parsed.data.description : null;
  }
  const [row] = await db.update(tasksTable).set(updateData).where(eq(tasksTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(UpdateTaskResponse.parse(serializeDates(row)));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
