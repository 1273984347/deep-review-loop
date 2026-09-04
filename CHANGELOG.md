# Changelog

本文件记录 deep-review-loop 的版本演进，遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格。版本号与 `SKILL.md` 的 `metadata.version` 保持一致。

## [Unreleased]

## [1.3.3] - 2026-09-04

### Fixed
- publish-tessl.yml：TESSL_TOKEN 提升到 job 级 env——step 自身的 env 在它自己的 `if` 求值时尚未应用，原 step 级写法条件恒为 false，配置了 secret 也永远跳过（发布流水线死代码修复）
- GitHub Actions 全部 pin 到 commit SHA（actions/checkout v4/v6、setup-python v5、tesslio/setup-tessl v2），消除可变 tag 的供应链风险
- verdict 禁词自匹配误报：R0 / V3 grep 命中先剔除禁词定义行本身再计数（meta-skill 场景目标文件内嵌禁词清单自匹配 +「OK」子串误报 TOKEN/BROKEN 等），fragment-lint 新增锚点防漂移
- 防 ping-pong 护栏：作为 mem-wrap-up Step 7b 子流程时收敛后直接返回调用方、不再回触 mem-wrap-up；mem-wrap-up 联动每 session 至多一轮

### Changed
- compatibility 字段如实声明：需要文件系统 + shell（PowerShell/POSIX）+ 文件搜索；无 shell 的纯 Web agent 不支持（原文 "Agent-agnostic" 超前）
- CI 加 windows-latest runner（skills-ref 两步在 Windows 跳过：上游 CLI 静默 exit 1）；lint/eval 步骤三平台覆盖
- .gitignore 补 `__pycache__/` 与 `.mimosa/`
- README（中/英）补 token 成本预期；运行依赖行同步 compatibility 修订

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
