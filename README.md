# deep-review-loop

> 5 轮深度复检闭环（R0-R3 + V1-V5）+ 4 层过拟合防护。**审查 → 修复 → 重新审查**，直到连续 N 轮无新问题才判定收敛。

## 解决什么问题

LLM 在「批量修复、写长文档、改 skill 自身」后极易**假收敛**——用 1 路快速检查就宣称「0 问题」，下一轮深度审查立刻反弹。本 skill 把「真循环铁律」固化为协议：问题数单调递减到 0，且连续 N 轮重新审查无新问题才算收敛，并内置 4 层过拟合防护防止「越修越多」。

## 核心能力

- **5 轮协议**：R0 表面检查 → R1a 3 独立 verifier（factual/completeness/reusability）→ R1b 对抗性审查 → R2 独立审计 → R3 收敛判定
- **4 层过拟合防护**：P2 残留 N（比赛级 0/生产 3/原型 10）、边际收益 gate（修复成本 > 危害×3 接受残留）、过拟合警报（震荡/回归率>30% STOP）、严重度门槛（P3 不报）
- **证据铁律**：每个 finding 必须附工具调用证据；0 finding 也要附「已实际验证」证据
- **防跳轮三件套**：5 类压力场景、6 类借口反驳表、7 条 Red Flags
- **5 步独立 verify**：file/行数、grep 范式、verdict 禁词、memory sync、3-case dry-run

## 安装

```bash
git clone https://github.com/1273984347/deep-review-loop.git
cp -r deep-review-loop <your-skills-dir>/deep-review-loop
```

## 使用

编写 plan/spec/skill/长文档后、批量修复（>10 项）后、用户说「复检 / 收敛 / DRL」、或怀疑假收敛时触发。

## 环境适配

- 需要 subagent/task 派生能力 + 文件搜索工具（Grep/Read/LS）。
- memory 同步使用 `<memory_root>` 占位符（无 memory 系统时标 `not-applicable`）。
- **MCP 扩展**：如需外部工具参与审查（如调用某个 MCP 做运行时验证），作为可选工具接入，无 MCP 时回退到内建工具。

## 相关仓库

- [agent-session-loop](https://github.com/1273984347/agent-session-loop)（整合版：审查→收尾→沉淀流水线）
- [mem-wrap-up](https://github.com/1273984347/mem-wrap-up)（收尾：DRL 收敛后触发）
- [self-evolution](https://github.com/1273984347/self-evolution)（沉淀：residual risk 喂给问题预防）

## 许可证

[Apache-2.0](LICENSE)
