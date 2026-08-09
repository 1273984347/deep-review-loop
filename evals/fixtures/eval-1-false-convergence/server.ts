// server.ts — 注意：旧 REST 挂载点仍存在（与 plan.md 声称的「已移除」矛盾）
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./api";

// Legacy REST route still mounted here — plan.md says this was removed in step 2.
app.use("/api/v1", legacyRestHandler);

createHTTPServer({ router: appRouter }).listen(3000);
