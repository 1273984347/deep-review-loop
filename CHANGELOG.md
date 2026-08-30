# Changelog

本文件记录 deep-review-loop 的版本演进，遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格。版本号与 `SKILL.md` 的 `metadata.version` 保持一致。

## [Unreleased]

## [1.3.2] - 2026-08-31

### Fixed
- 出口 ACK 门禁：收敛判定含「接受残留」或 P1+ 残留 → 等人类 `ACK + 风险接受` 才能闭环（漏洞 6）
- 双层严重度制：结构性硬指标由脚本判定，AI 语义判定必须附可复现证据链（漏洞 3）
- 路径预检 + Grep 空结果判别：占位符使用前强制 `test -e`，预检失败中断问用户（漏洞 7/9/15）

### Added
- LLM 行为 eval（evals/run_behavior_llm.py，双模式 --api/--manual，发布前手动门禁，不进 CI）
- fragment-lint 交叉引用校验（三 skill 互链必须在 README 出现）
- version-lint 内容漂移软告警（内容变版本未变 → WARN）
- README badge 改动态 release badge；CI 加 macos-latest runner + skills-ref pin 到 commit SHA

## [1.3.1] - 2026-08-31

### Fixed
- verdict 禁词统一 7 词全序（补 `looks good`，对齐三 skill 闭环其余仓库）
- R0 file size sanity 补目标值（≤500 行 / 5000 tokens，对齐 references 详案）

### Added
- scripts/fragment-lint.py 共享片段一致性 lint + CI 接入（守护 verdict 禁词 / 工具映射表四仓库同步）

### Changed
- 跨平台清理：NEEDS_CONTEXT 信号通用化（去掉 TRAE 平台绑定），compatibility 字段改为 subagent optional
- 新增「无子代理平台的降级模式」：并行 subagent → 串行/主代理分轮内审，独立审查 → 自我对抗（显式标注 `degraded (no-subagent)`），降级 ≠ 跳过
- 四源版本同步（SKILL.md / README / CHANGELOG / marketplace.json）

## [1.3.0] - 2026-08-10

### Added
- evals 评估体系：4 个行为场景 fixtures + trigger-eval 12 条触发查询 + 双层 CI
- description 三层触发合同（显式触发词 + intent 触发 + 反触发条款）
- 英文 README + 中英导航切换
- README 叙事升级（金句 + 痛点故事线）
- GitHub Release v1.3.0、Discussions、项目文档（CONTRIBUTING/CoC/SECURITY/CHANGELOG）

### Changed
- description 与 README 全面重写，触发示例自然语言化

## [1.2.0]

### Added
- 4 层过拟合防护（P2 残留 N / 边际收益 gate / 过拟合警报 / 严重度门槛）

## [1.0.0] - 初始发布

### Added
- 5 轮深度复检闭环（R0-R3）+ 证据铁律 + 防跳轮三件套
