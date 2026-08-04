// Vercel serverless entry for the Express API.
// Built by `pnpm --filter @workspace/api-server build` → dist/vercel.mjs
import app from "../artifacts/api-server/dist/vercel.mjs";

export default app;
