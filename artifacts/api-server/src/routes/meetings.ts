import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, meetingsTable } from "@workspace/db";
import {
  CreateMeetingBody,
  CreateMeetingResponse,
  DeleteMeetingParams,
  GetMeetingParams,
  GetMeetingResponse,
  ListMeetingsResponse,
  UpdateMeetingBody,
  UpdateMeetingParams,
  UpdateMeetingResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/meetings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(meetingsTable).orderBy(asc(meetingsTable.startAt));
  res.json(ListMeetingsResponse.parse(serializeDates(rows)));
});

router.post("/meetings", async (req, res): Promise<void> => {
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(meetingsTable).values({
    ...parsed.data,
    startAt: new Date(parsed.data.startAt),
    endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
  }).returning();
  res.status(201).json(CreateMeetingResponse.parse(serializeDates(row)));
});

router.get("/meetings/:id", async (req, res): Promise<void> => {
  const params = GetMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.json(GetMeetingResponse.parse(serializeDates(row)));
});

router.patch("/meetings/:id", async (req, res): Promise<void> => {
  const params = UpdateMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.startAt) updateData.startAt = new Date(parsed.data.startAt);
  if (parsed.data.endAt) updateData.endAt = new Date(parsed.data.endAt);
  const [row] = await db.update(meetingsTable).set(updateData).where(eq(meetingsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.json(UpdateMeetingResponse.parse(serializeDates(row)));
});

router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(meetingsTable).where(eq(meetingsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
