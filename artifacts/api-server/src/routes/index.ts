import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notesRouter from "./notes";
import remindersRouter from "./reminders";
import meetingsRouter from "./meetings";
import tasksRouter from "./tasks";
import promptsRouter from "./prompts";
import snippetsRouter from "./snippets";
import bookmarksRouter from "./bookmarks";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(notesRouter);
router.use(remindersRouter);
router.use(meetingsRouter);
router.use(tasksRouter);
router.use(promptsRouter);
router.use(snippetsRouter);
router.use(bookmarksRouter);
router.use(dashboardRouter);

export default router;
