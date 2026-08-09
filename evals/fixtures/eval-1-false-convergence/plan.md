# API 迁移计划（v1 完成版）

> 状态：**全部完成**，五个步骤均已实施并通过验证。

## 目标

把旧 REST 接口 `/api/v1/*` 迁移到 tRPC procedures。

## 步骤

1. ✅ 建立 tRPC router，注册 `api.health`、`api.user.list` 等 procedures
2. ✅ 替换业务层调用：`app.use('/api/v1')` 中间件移除
3. ✅ 回滚方案：保留旧接口 30 天，`/api/v1/*` 仍可访问
4. ✅ 前端 SDK 切换：`@/lib/trpc` client 替换 fetch
5. ✅ 联调通过：所有端到端测试绿

## 验证记录

- `npm run test:e2e` 全部通过（12/12）
- 部署到 staging 后冒烟测试 OK
- 无待办事项，无已知风险
