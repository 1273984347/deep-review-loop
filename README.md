# deep-review-loop

> 5 轮深度复检闭环（R0-R3 + V1-V5）+ 4 层过拟合防护。**审查 → 修复 → 重新审查**，直到连续 N 轮无新问题才判定收敛。

[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

## 解决什么问题

LLM 在「批量修复、写长文档、改 skill 自身」后极易**假收敛**——用 1 路快速检查就宣称「0 问题」，下一轮深度审查立刻反弹。本 skill 把「真循环铁律」固化为协议：问题数单调递减到 0，且连续 N 轮重新审查无新问题才算收敛，并内置 4 层过拟合防护防止「越修越多」。

## 核心能力

- **5 轮协议**：R0 表面检查 → R1a 3 独立 verifier（factual/completeness/reusability）→ R1b 对抗性审查 → R2 独立审计 → R3 收敛判定
- **4 层过拟合防护**：P2 残留 N（比赛级 0/生产 3/原型 10）、边际收益 gate（修复成本 > 危害×3 接受残留）、过拟合警报（震荡/回归率>30% STOP）、严重度门槛（P3 不报）
- **证据铁律**：每个 finding 必须附工具调用证据；0 finding 也要附「已实际验证」证据
- **防跳轮三件套**：5 类压力场景、6 类借口反驳表、7 条 Red Flags
- **5 步独立 verify**：file/行数、grep 范式、verdict 禁词、memory sync、3-case dry-run

## 安装

标准 Agent Skill（`SKILL.md` + `references/`），任何支持 Agent Skills 的客户端都能装。三种方式任选：

**方式 A：自然语言安装（推荐）**

在 Claude Code、Codex 等支持 Agent Skills 的工具里，直接说：

```text
帮我安装这个 skill：https://github.com/1273984347/deep-review-loop
```

Agent 会自动 clone 到 skills 目录并注册，不用手动找路径。工具不支持时，手动复制：

```bash
git clone https://github.com/1273984347/deep-review-loop.git
cp -r deep-review-loop <your-skills-dir>/deep-review-loop
```

**方式 B：Claude Code 插件市场（一条命令）**

```text
/plugin marketplace add 1273984347/deep-review-loop
/plugin install deep-review-loop@deep-review-loop
```

**方式 C：skills.sh CLI（Agent 界的 npm）**

```bash
npm install -g @anthropic-ai/skills
npx skills add https://github.com/1273984347/deep-review-loop
```

## 使用

**怎么触发**（说这些就会跑起来）：

```
帮我复检一下这批改动，跑 deep review
写完方案了，帮我收敛一遍
这个 skill 我刚改过，跑 DRL
上次说 0 问题，我怀疑假收敛
```

**适用 / 不适用**：

| ✅ 适用 | ❌ 不适用 |
|---|---|
| plan / spec / skill / 长文档写完或修改后 | 一次性单文件小改（无结构风险） |
| 批量修复（>10 项）后 | 常规编码 / 补全（不涉及书面产物） |
| 用户说「复检 / 收敛 / DRL / deep review」 | 闲聊问答 |
| 怀疑假收敛时（强制重新审查） | 文档 / 记忆收尾（用 [mem-wrap-up](https://github.com/1273984347/mem-wrap-up)） |
| skill 自身修改后（meta-skill 场景） | 复盘沉淀（用 [self-evolution](https://github.com/1273984347/self-evolution)） |

## 评估与 CI

本仓库自带评估体系（`evals/`），两层 CI 检查保证 skill 不回归：

```text
evals/
├── fixtures/                # 4 个行为场景工作区（假收敛/批量修复/meta-skill/文档改动）
├── evals.json               # 行为级评估：prompt + expected_output + expectations
├── trigger-eval.json        # 触发评估：应触发 / 不应触发 共 12 条查询
└── validate.py              # 确定性结构回归检查（frontmatter/触发合同/协议短语/评估一致性）
```

- **第 1 层**：官方 `skills-ref validate` 校验 frontmatter 合规
- **第 2 层**：`python evals/validate.py` 断言 description 触发词与反触发条款、R0-R3/收敛曲线/证据铁律等协议短语、4 个 eval 的 fixture 完整性

每次 push 自动跑，任何一项丢失立即标红。

## MCP 接入（可选）

本 skill 与 MCP **互补而非依赖**：MCP 提供外部工具/数据连接，本 skill 负责编排审查流程。MCP 作为**可选增强**，无 MCP 时自动回退到内建工具（Grep/Read/LS + subagent）。

**典型接入场景**：

| MCP 类型 | 用途 | 增强点 |
|---|---|---|
| 数据库 MCP | 查询真实 schema / 数据核对 | R1a 事实验证的独立证据源 |
| API / 服务状态 MCP | 运行时健康检查 | 验证「运行态」而非只查代码 |
| 代码扫描 MCP | 安全 / 依赖检查 | R1b 对抗性审查的补充视角 |

**接入步骤**：
1. 在你的 agent 配置中启用对应 MCP server；
2. 在 SKILL.md 的 `compatibility` 字段声明「可选 MCP：xxx」，并注明 fallback 规则；
3. skill 内写「有 xxx MCP 则调用其验证，无则用内建工具」——绝不因 MCP 缺失而中断流程。

## 版本兼容性

| 检查项 | 值 |
|---|---|
| SKILL.md 版本 | 1.3.0 |
| Agent Skills 标准 | 兼容（[agentskills.io](https://agentskills.io) 开放标准，frontmatter: name/description/license/metadata） |
| frontmatter 校验 | 通过 `skills-ref validate`（CI 自动检查，见 [.github/workflows/validate.yml](.github/workflows/validate.yml)） |
| 结构回归检查 | 通过 `python evals/validate.py`（CI 自动检查） |
| 运行依赖 | 无 Python/Node 脚本；需 subagent/task 派生 + 文件搜索工具（Grep/Read/LS） |
| MCP 依赖 | 无（可选接入） |
| 联动 skill | [mem-wrap-up](https://github.com/1273984347/mem-wrap-up)（收尾）/ [self-evolution](https://github.com/1273984347/self-evolution)（沉淀）——不装也能独立运行 |

**客户端兼容矩阵**：

| 客户端 | 安装方式 | 支持 |
|---|---|---|
| TRAE | 复制目录到 skills 目录，自动注册 | ✅ |
| Claude Code | `/plugin marketplace add` 或复制目录 | ✅ |
| Codex / Cursor / OpenCode 等 | 复制目录（Agent Skills 标准客户端） | ✅ |
| 其他 | 需支持 SKILL.md frontmatter + 渐进披露 | 视实现 |

## 环境适配

- 需要 subagent/task 派生能力 + 文件搜索工具（Grep/Read/LS）。
- memory 同步使用 `<memory_root>` 占位符（无 memory 系统时标 `not-applicable`，不编造证据）。

## 相关仓库

- [agent-session-loop](https://github.com/1273984347/agent-session-loop)（整合版：审查→收尾→沉淀流水线）
- [mem-wrap-up](https://github.com/1273984347/mem-wrap-up)（收尾：DRL 收敛后触发）
- [self-evolution](https://github.com/1273984347/self-evolution)（沉淀：residual risk 喂给问题预防）

## 许可证

[Apache-2.0](LICENSE)
