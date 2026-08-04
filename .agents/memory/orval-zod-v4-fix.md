---
name: Orval Zod v4 Codegen Fix
description: Orval 8.23 generates zod/v4 syntax (zod.int()) but the workspace pins zod@^3. Fixed by a sed post-process step in the codegen script.
---

# Orval Zod v4 Codegen Fix

## The rule
After running Orval codegen, the generated `api-zod` file must have its import rewritten from `from 'zod'` to `from 'zod/v4'`.

**Why:** Orval 8.23 generates code using the Zod v4 API (e.g. `zod.int()`) but the workspace catalog pins `zod@^3.25.76`. Zod v3 ships a `zod/v4` compatibility shim that exposes the v4 API surface, so importing from `zod/v4` resolves correctly with the v3 package.

**How to apply:**
- The fix is already baked into `lib/api-spec/package.json` codegen script as a `sed` post-process.
- Pattern: `sed -i "s/from 'zod'/from 'zod\/v4'/g" <output-file>`.
- Re-run codegen with `pnpm --filter @workspace/api-spec run codegen` any time `openapi.yaml` changes.
- After codegen, rebuild lib declarations with `pnpm run typecheck:libs` (runs `tsc --build`) so downstream packages see the updated types.
