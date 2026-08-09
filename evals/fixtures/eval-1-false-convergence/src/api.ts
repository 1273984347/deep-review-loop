// src/api.ts — 迁移后：旧 /api/v1 中间件已移除
import { router } from "./trpc";

export const appRouter = router({
  health: healthProcedure,
  "user.list": listUsersProcedure,
});
