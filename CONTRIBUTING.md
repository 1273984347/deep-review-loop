# 贡献指南

欢迎贡献！任何让这个 Agent Skill 更好用的改进都值得提出来。

## 仓库结构

- `SKILL.md`：skill 主文件（frontmatter + 协议正文，遵循渐进披露，正文 <500 行）
- `references/`：按需加载的细节文档，不占主文件上下文
- `evals/`：评估体系（`validate.py` 结构回归 + `evals.json` 行为描述 + `fixtures/` 场景工作区）
- `.github/workflows/validate.yml`：双层 CI（`skills-ref validate` + `python evals/validate.py`）

## 改 `SKILL.md` 前的检查清单

1. **frontmatter 合规**：`name` 必须等于仓库名；`description` ≤1024 字符（含触发合同三层：显式触发词 + intent 触发 + 反触发）；`license`；`metadata.version`（semver）
2. **触发合同**：改 description 时同步更新 `evals/trigger-eval.json` 的应触发/不应触发查询
3. **渐进披露**：正文超过 500 行时，把细节拆到 `references/`
4. **本地验证**：`python evals/validate.py` 必须全 PASS
5. **版本联动**：升级 `metadata.version` 时，同步更新 README 版本兼容性表、CHANGELOG、并发布对应 git tag / Release

## 提交规范

- Conventional Commits：`feat:` / `fix:` / `docs:` / `refactor:` / `test:`
- 一次提交一个逻辑变更
- 每个 skill 行为变更必须附带对应 evals 更新

## 流程

1. Fork 本仓库并创建分支
2. 修改 + 本地验证（跑一遍 `evals/validate.py`）
3. 提交时说明改动与验证结果
4. 开 PR，描述里写明影响面（description / 协议 / CI）
