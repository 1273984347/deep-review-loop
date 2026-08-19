---
name: deep-review-loop
description: >-
  Enforces a 5-round deep review loop (R0-R3 + V1-V5) with anti-overfit protection for plans, specs,
  skills, and long documents. Trigger when writing or modifying these artifacts, after batch fixes
  (>10 items), when the user says "deep review / 复检 / 收敛 / DRL", or when false convergence is
  suspected — even without explicit keywords. Do not trigger for one-off single-file edits with no
  structural risk, plain coding/completion without written artifacts, or casual Q&A.
  5 轮深度复检闭环（R0-R3 + V1-V5）+ 4 层过拟合防护。编写/修改方案、规范、skill、长文档时、批量修复
  （>10 项）后、用户要求「复检/收敛/DRL」、或怀疑假收敛时触发（即使未点名）。
  不触发：无结构风险的一次性单文件小改、不涉及书面产物的常规编码/补全、闲聊问答。
license: Apache-2.0
compatibility: Agent-agnostic. Requires subagent/task spawning and file search tools (Grep/Read/LS).
metadata:
  version: "1.3.0"
---

# Deep Review Loop

> 5 轮深度复检闭环：审查 → 修复 → **重新审查**，直到连续 N 轮无新问题才判定收敛。
> 内置 4 层过拟合防护（P2 残留 N / 边际收益 gate / 过拟合警报 / 严重度门槛），防止「越修越多」与「假收敛」。

**Announce at start:** "I'm using the deep-review-loop skill to run the 5-round review loop."

## 工具名映射（跨平台）

正文中的工具名按「通用能力」描述，实际执行时映射到你所在平台的等价工具：

| 正文写法 | 通用能力 | 常见平台实现 |
|:---|:---|:---|
| subagent / Task | 派独立子代理（可并行） | TRAE Task / Codex spawn_agent / Claude Code Task |
| RunCommand | 执行 shell 命令 | PowerShell / bash / sh |
| Grep 工具 | 文本搜索 | TRAE Grep / `rg` / `grep` / Select-String |
| Read / Edit / Write | 文件读写 | 各平台内建文件工具 / apply_patch |
| LS / Glob | 枚举文件与目录 | `ls` / `Get-ChildItem` / glob |
| Skill 工具 | 调用另一个 skill | 各平台 skill 机制；无则按对应 SKILL.md 手动执行 |
| NEEDS_CONTEXT | 子代理缺上下文的回退信号 | TRAE 内建；其他平台等价于子代理报「信息不足」，按 fallback 处理 |

**PowerShell 示例的 POSIX 等价命令**：

| 目的 | PowerShell | POSIX |
|:---|:---|:---|
| 行数统计 | `(Get-Content FILE).Count` | `wc -l FILE` |
| 文件/路径存在 | `Test-Path FILE` | `test -e FILE` / `test -f FILE` |
| 递归枚举 | `Get-ChildItem -Recurse -File` | `find . -type f` |
| 超大文件 | `Get-ChildItem -Recurse \| Where-Object {$_.Length -gt 50KB}` | `find . -type f -size +50k` |
| 软链目标 | `Get-Item LINK \| Select-Object Target` | `readlink -f LINK` / `ls -l LINK` |
| 命中计数 | Grep output_mode=count | `grep -c PATTERN FILE` / `rg -c PATTERN FILE` |

## 在 skill 闭环中的位置

本 skill 是「审查 → 收尾 → 沉淀」三 skill 闭环的**审查端（起点）**，与 [mem-wrap-up](https://github.com/1273984347/mem-wrap-up)（收尾）和 [self-evolution](https://github.com/1273984347/self-evolution)（沉淀）联动：

- **正向触发**（本 skill → 下游）：
  - DRL 收敛后 → 触发 **mem-wrap-up** 反向验证收尾本身
  - DRL R3 residual risk → 喂给 **self-evolution** 问题预防维度
  - DRL R1b class-level findings → 喂给 **self-evolution** 一次性工具沉淀
- **反向触发**（上游 → 本 skill）：
  - **self-evolution** 复盘发现流程撞坑 → 升级 DRL 协议
  - **mem-wrap-up** 收尾验证时调用 DRL 作为子流程

## 0. 真循环铁律（最高优先级，违反即重大失误）

- **绝不允许假收敛**：DRL 不是「审查→修复→验证」单次流程，必须是「审查→修复→**重新审查**」的循环，直到连续 N 轮重新审查均未发现新问题才判定收敛。
- **假收敛标志**：用 1 路快速审查（如仅 Grep 验证）就判 0 问题，下一轮深度审查反弹。
- **真收敛标志**：问题数严格单调递减到 0，且下一轮重新审查仍未发现新问题。
- **每轮修复后必须重新审查**：修复可能引入回归（典型：短路子句副作用、状态锁清理路径、事件拦截边界）。
- **收敛曲线必须记录**：每轮问题数（P0/P1/P2）单独记录，标注假收敛/真收敛，不允许只报最终「0 问题」。
- **P2 残留 N 规则（过拟合防护层 1）**：P0/P1 必须降到 0（真收敛硬条件，不可妥协）；P2 允许残留 N 条（N 由项目阶段决定：比赛级 N=0，生产 N=3，原型 N=10）；P3 不计入收敛判定，记录到 backlog 不当下修复。
- **过拟合防护**：DRL 目标是 P0/P1 真收敛，不是无限追求 P2/P3 完美。过拟合（越修越多）时主动报告 > 硬修。

## 1. 协议概览（5 轮 deep review loop + 5 步独立 verify）

| Round | 动作 | 执行者 | 状态 |
|:------|:-----|:-------|:----:|
| **R0** | 表面检查：file size + verdict 字眼 grep + 路径验证 | inline me | 必先跑 |
| **R1a** | 3 独立 verifier 交叉验证（factual / completeness / reusability） | 3 Task subagents parallel | 必派 |
| **R1b** | 对抗性 subagent 审查（default refuted=true + class-level scope + 不同工具/视角 + 严重度门槛） | 1 Task subagent | 必派 |
| **R2** | 独立审计 + self-revision：修 R1 findings inline（audit 由 subagent，**NOT inline**）+ 边际收益 gate | 1 Task subagent | 必派 |
| **R3** | 残余风险确认 + N residual risk（≥3）列表 + 收敛曲线 + 过拟合警报 | inline me | 必走 |

| Verify 步 | 名称 | 兜底 |
|:----------|:-----|:----:|
| **V1** | file exists + content count + link target + 行数 | 文件缺失治本 |
| **V2** | 5 步 grep 范式（size + 残留 + 期望 hits + 期望 0 hits + 实证） | 主代理主动防御 |
| **V3** | verdict 字眼 grep（完成 / PASS / OK / 没问题 / 12/12 / 闭环） | self-claim 反模式治本 |
| **V4** | memory sync（规则文件 / 项目记忆 / topics 是否需更新） | 数字 bump 一致性 |
| **V5** | 3-case dry-run（best / worst / null） | 一次性工具/scaffold 防崩 |

---

## 2. Pressure Scenarios（5 类压力下 LLM 自然违反）

> 执行前 self-check「我是否在某个场景里？」。每场景配期望行为。

### Scenario 1: 时间压力 + 测试通过
- **压力源**：user 说「快点，tests 都过了」，session 已跑 30+ 轮
- **自然违反**：跳过 R1a（3 subagent 太慢）+ 跳过 R1b（tests 过了没必要找茬）
- **期望行为**：**仍跑 R1a + R1b**。Tests pass ≠ skill/long-doc 合规。R1a 验证*改动本身*，不验证*测试覆盖的代码*。

### Scenario 2: User 紧急 + 单文件改动
- **压力源**：user 说「P0 修复，急」，改动只是 1 文件 5-10 行
- **自然违反**：跳过 R1b（单文件太小）+ 跳过 R2（没跨文件影响）+ R3 写 0 residual
- **期望行为**：**仍跑 R1b（含 class-level scope）+ R2 + R3 ≥3 residual**。单文件 fix 可能是 class-level pattern 的 1 个 instance，R1b 必查同类。

### Scenario 3: 自证 + 看起来完整
- **压力源**：agent 自己「我已手动 verify 过了」+ 改动看起来正常
- **自然违反**：R3 写 0 residual risk + 输出 verdict 字眼
- **期望行为**：**R3 必写 N（≥3）residual risk**，即使 0 finding。「看起来完整」≠「验证完整」。

### Scenario 4: Documentation-only change
- **压力源**：改动只是 .md（README / plan / quickref / 本 skill）
- **自然违反**：跳过 R1a 3 subagent（觉得「docs 无风险」）+ 跳过 R2
- **期望行为**：**仍跑 R1a（factual accuracy 维度）+ R2（memory sync 维度）**。Docs 改动常有 cross-doc 不一致。

### Scenario 5: Skill 自身修改（meta-skill）
- **压力源**：修改的 target 就是本 skill 或相关参考
- **自然违反**：跳过 R0 + R3 写 0 residual（觉得 meta 层「不重要」）
- **期望行为**：**必跑 5 轮 + R3 ≥3 residual**。Meta-skill 修改有 cascading 影响（引用断链 + 下游 task 同步）。修改前必先 Read 原文留底。

---

## 3. Rationalization Table（6 类「找借口跳轮」反模式 + 反驳）

| Excuse（LLM 找的借口） | Reality（反驳） |
|:----------------------|:---------------|
| 「Tests 都过了，R1a 不必要」 | Tests pass ≠ skill/docs 合规。R1a 验证*改动本身*，不验证*test 覆盖的代码* |
| 「User 急，R2 跳过」 | R2 是强制（NOT inline）。急不是违反硬门禁的理由 |
| 「0 finding，没 residual」 | R3 必写 N（≥3）residual。Subagent 盲点 + sample/time-point + 跨 session 必出现 |
| 「Manual check 过了，R1a subagent 冗余」 | Self-verify 是 anti-pattern。Subagent 提供 independent perspective，Manual + subagent ≠ 冗余 |
| 「单文件改动，R1b class-level 没必要」 | 单文件 fix 常是 class-level pattern 的 1 instance。R1b 必 enumerate 同类（先 Grep 项目所有相关目录） |
| 「本 skill 改了不需跑 self-review」 | Meta-skill 改动有 cascading 影响。必走 5 轮（per Scenario 5） |

---

## 4. Red Flags List（6 条 self-check）

> 每轮完成后 + 整体闭环前必 self-check。任何 1 条 hit → STOP，self-correct，不要 continue。

- [ ] 跳过任意 round 无 justification（R0/R1a/R1b/R2/R3 任何 1 个跳过 → STOP）
- [ ] 输出含 verdict 字眼（完成 / PASS / OK / 没问题 / 12/12 / 闭环 → 删 + 重写）
- [ ] R3 写 0 residual risk（≥3 必写，含 subagent 盲点 + sample/time-point + 跨 session）
- [ ] R1a subagent prompt 缺 3-lens split（factual / completeness / reusability 必覆盖）
- [ ] R1a subagent finding 未附工具调用证据
- [ ] R1b prompt 缺 default refuted=true OR 缺 class-level scope OR 缺严重度门槛
- [ ] R2 inline（违反 R2 强制「1 subagent NOT inline」。Self-audit ≠ 独立审计）

---

## 5. 5 轮详细（R0 → R3，工具映射）

### R0 surface check（inline me，必先跑）

**3 件套**（用 Grep 工具 + Read 工具，非 bash）：

1. **file size sanity**：Read 工具打开目标文件，观察行数；或 RunCommand `(Get-Content FILE).Count`（PowerShell）。
2. **residual verdict words**：Grep 工具，pattern `完成|PASS|OK|没问题|12/12|闭环`，output_mode=count，逐词或合并 regex。
3. **expected hits 必现**：Grep 工具，pattern `R0|R1a|R1b|R2|R3|residual` 等，确认结构词命中。
4. **项目阶段判定（过拟合防护层 1 前置）**：判定当前项目阶段 → N_max 取值。规则：
   - 比赛级（黑客松 / demo 提交）→ N_max=0
   - 生产（已上线 / 有真实用户）→ N_max=3
   - 原型（早期探索 / MVP / 内部测试）→ N_max=10
   - 判定依据优先级：user 显式声明 > 项目记忆字段 > cwd 路径推断 > 默认 N_max=3
   - 判定结果写入收敛曲线 Round 1 行

### R1a 3 independent verifiers（3 Task subagents parallel，必派）

**3-lens split**（缺一不算 R1a）。用 Task 工具，单消息内发 3 个 parallel 调用。每个 subagent prompt 必含 3 段：Timeout 心态 + Fail-fast + 明确 scope。

**R1a 硬性要求（防 verifier 失误）**：

- **verifier 必须附工具调用证据**：每个 finding 必须附至少 1 个工具调用输出（LS / Read / Grep / Glob 之一）作为 Trace evidence。**禁止**基于二手转述（如 R0 报告、其他 verifier 输出）下结论。
- **目录存在性声明**：verifier 声明「目录存在」或「目录缺失」时，**必须**附 LS 工具调用输出（不允许仅基于 Glob 或推断）。
- **文件存在性声明**：verifier 声明「文件存在」或「文件缺失」时，**必须**附 Read 或 LS 工具调用输出。
- **路径声明**：verifier 声明「file:line」时，**必须**附 Read 工具调用输出确认该行内容。
- **0 finding 也要附证据**：即使 verifier 0 finding，也必须附至少 1 个工具调用输出证明「已实际执行验证」（非走过场）。
- **Subagent prompt 必含此硬性要求**：派 R1a subagent 时，prompt 中必须包含上述硬性要求的明确声明（不可仅引用本 skill 文档，subagent 无访问权限）。
- **违反处置**：R2 审计时发现 R1a verifier 未附工具调用证据 → 该 finding 视为「未验证」，不计入收敛判定，要求重新派 R1a。

| Verifier | Lens | Subagent Prompt 模板 |
|:---------|:-----|:---------------------|
| **A — Factual** | 数字/路径/引用 准确 | 「Verify 文中每个数字/路径/引用 vs 源（用 Grep + Read 工具 trace 到源 file:line）。每个 claim 必 trace。0 unverifiable = 0 finding。只做研究，不改代码。」 |
| **B — Completeness** | 覆盖度 | 「Verify 文段是否覆盖声明的 scope（e.g. plan body 段是否 5 步/9 sub-steps 齐）。0 missing = 0 finding。只做研究。」 |
| **C — Reusability** | 陌生人 cold-start 能力 | 「Verify 陌生人能否凭此文 cold-start 执行。路径全名 vs 缩写、命令完整 vs 缺参数、错误处理 vs happy-path-only。0 ambiguous = 0 finding。只做研究。」 |

### R1b adversarial subagent（1 Task subagent，必派，default refuted=true + 严重度门槛）

**Subagent Prompt 必须包含 5 段**（含过拟合防护层 4 严重度门槛）：

```
You are an adversarial reviewer. Default refuted=true.

严重度门槛（过拟合防护层 4，只报以下级别）:
- P0: 崩溃/安全/数据丢失
- P1: 核心功能失效
- P2: 体验问题（记录但不强制修复）
- P3 及以下: 不报，避免过拟合审查。例外：P3 instance 若属 class-level pattern 的 1 instance（同一问题在多文件出现），则升级为 P2 报告，避免漏报

Tasks (4 必做):
1. Verify the immediate fix/skill. Attack R1a 3 verifier 判定 + verdict self-claim + silent skip。
2. Class-level pattern coverage: When finding is a "fix in file X", 先 Grep 项目根目录所有源文件定位相关目录（tests/ + src/ + 项目特定目录），再 enumerate ALL affected files。
3. Use different tool/视角 from R1a (e.g. R1a 用 Grep, 你用 Read + 手动 trace; R1a 看 src/, 你看 tests/ + 项目特定产物目录)。
4. 0 finding = N residual risk list (≥3, 含 subagent 盲点 + sample/time-point + 跨 session)。

Output: refuted=true/false + findings list (含严重度分级) + class-level enumeration + residual risks。
只做研究，不改代码。
```

#### R1b 反模式清单（7 项）

| # | 反模式 | 风险 | 覆盖机制（Red Flag） |
|:-:|:------|:-----|:--------------------|
| 1 | **silent skip 4 必做任务**（特别 Task 2 class-level enumeration） | subagent 偷懒只做 Task 1+4，跳过 Task 2/3 | R1b 输出必须含 class-level enumeration 证据 + 不同工具视角证据，缺失即 P1 |
| 2 | **正例 bias**（只验主代理声明已修复项，不主动找新问题） | R1b 沦成 R1a 重复，失去对抗性价值 | Prompt 强制：Task 1 是 Attack 不是 Verify，必须主动找新问题 |
| 3 | **0 finding 滥用**（输出 0 finding 但未实际执行验证） | R1a 已有硬性要求附工具证据，R1b 没有同等要求 | R1b 0 finding 也必须附工具调用证据（同 R1a 硬性要求） |
| 4 | **严重度降级**（把 P1 降级为 P2 逃避修复） | 严重度门槛被 subagent 主观操纵 | 降级必须附依据 + inline me 复核 |
| 5 | **class-level 偷懒**（只 enumerate 1-2 文件就声明已查） | class-level scope 形同虚设 | class-level enumeration 必须列出 ALL affected files 清单 |
| 6 | **residual risk 敷衍**（输出 ≥3 residual 但泛泛之谈） | residual 形式合规但无实际价值 | residual 必须含具体场景 + 验证命令（同 R3 evidence-based） |
| 7 | **工具证据缺失**（R1a 有硬性要求，R1b 没有） | R1b finding 无 trace evidence | R1b finding 必须附工具调用证据（同 R1a 硬性要求） |

**R1b 硬性要求（与 R1a 硬性要求对齐）**：
- R1b finding 必须附至少 1 个工具调用输出（LS / Read / Grep / Glob 之一）作为 Trace evidence
- R1b 0 finding 也必须附至少 1 个工具调用输出证明「已实际执行验证」
- R1b class-level enumeration 必须列出 ALL affected files 清单（不允许「已查 N 文件」无清单）
- R1b 严重度降级必须附依据（不允许仅声明「P2」无理由）
- 违反处置：R2 审计时发现 R1b 违反硬性要求 → 该 finding 视为「未验证」，不计入收敛判定，要求重新派 R1b

### R2 independent audit（1 Task subagent，**NOT inline**，强制 + 边际收益 gate）

> ⚠️ **R2 强制**：必须派独立 Task subagent，**不允许 inline self-audit**。Self-audit ≠ 独立审计。

**Subagent Prompt 模板**（含过拟合防护层 2 边际收益 gate）：

```
You are an independent auditor。Verify R1a + R1b findings。

Tasks:
1. Cross-check R1a 3 verifier reports vs actual findings (claim vs evidence file:line)。
2. Cross-check R1b adversarial report vs actual fix/skill content。
3. If R1a vs R1b contradictions exist, decide priority (which finding wins, why)。
4. Audit memory sync: 本轮改动是否需更新规则文件 / 项目记忆 / topics (如适用)。
5. Audit verdict 字眼 grep 结果 (must be 0)。
6. 边际收益 gate（过拟合防护层 2）: 对每个 finding 评估:
   修复成本 = token 消耗 + 回归风险 + 时间
   问题危害 = 用户影响 × 发生概率
   if 修复成本 > 问题危害 × 3: subagent 标记「建议接受残留」+ 给出理由（subagent 只做研究不改代码，决策由 inline me 执行）

Output: priority decision + audit findings + memory sync status + verdict grep status + 建议接受残留列表（inline me 决定是否采纳，subagent 仅建议）。
只做研究，不改代码。
```

### R3 N residual risks（inline me，必走，≥3）+ 收敛曲线 + 过拟合警报

**Residual risk 必含 3 类**：

1. **Subagent 盲点**：R1a/R1b 可能漏的盲点，e.g.「subagent 只 verify grep 维度，未 verify IDE / runtime 行为」
2. **Sample/time-point**：验证基于特定时间点/snapshot，e.g.「当前 version X，后续 bump 后需重 verify」
3. **跨 session**：当前 session fix 的下游影响，e.g.「本 skill 修改后相关 task 是否需重对？」

**Residual risk 模板（evidence-based）**：

> **Iron Law（NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE）**：每条 residual risk 必须附 fresh verification command + exit code + output 截取，不允许仅描述「可能存在的风险」而无验证证据。

```markdown
## Residual Risks (N 条·evidence-based)
1. **[subagent 盲点]** <具体盲点> — 验证命令: `<command>` — exit code: <0/非0> — output 截取: `<关键输出>` — 处置: <下 session / 等 user / 记 retro>
2. **[sample/time-point]** <时间点限制> — 验证命令: `<command>` — exit code: <0/非0> — output 截取: `<关键输出>` — 处置: <下 session 重 verify / 触发条件>
3. **[跨 session]** <下游影响> — 验证命令: `<command>` — exit code: <0/非0> — output 截取: `<关键输出>` — 处置: <下次相关 task / 同步动作>
```

**Evidence-based 升级说明**：
- 每条 residual 必须附 fresh verification command（本 session 实际执行的命令，非假设命令）
- exit code 必须是实际返回值（0 = 验证通过，非 0 = 验证失败）
- output 截取必须是实际输出的关键片段（非假设输出）

**收敛曲线模板**（必记，不允许只报最终 0）：

```markdown
## Convergence Curve
- Round 1: P0=X / P1=Y / P2=Z / 接受残留=P1:A1/P2:A2 / 回归率=R% (假收敛/真收敛)
- Round 2: P0=X' / P1=Y' / P2=Z' / 接受残留=P1:A1'/P2:A2' / 回归率=R'% (假收敛/真收敛)
- ...
- Round N: P0=0 / P1=0 / P2≤N_max / 接受残留=P1:A1_N/P2:A2_N / 回归率≤30% (真收敛，连续 2 轮 P0/P1 0 新发现)。N_max 按项目阶段取值（比赛级 0 / 生产 3 / 原型 10），R0 判定后填入具体数字，不允许保留 N_max 裸变量。回归率 = 本轮修复引入新 finding 数 / 本轮修复 finding 数 × 100%。接受残留 P1:A1/P2:A2 = 本轮被边际收益 gate 标记「建议接受残留」且 inline me 采纳的 finding 数（按严重度分离）。
```

**过拟合警报（层 3，触发任一即停止自动循环，向 user 报告）**：

```
警报 A（震荡）增强版（区分持平/反弹 + 严重度分层 + 窗口 4 轮 + 被动验证）:
  判定逻辑（只有「反弹」=问题数上升才触发，「持平」=问题数不变走停滞观察）:
    - P0 反弹: 立即触发（1 轮即 STOP）
    - P1 反弹: 连续 2 轮触发（P1 问题数连续 2 轮上升）
    - P2 反弹: 不触发（层 1 P2 残留 N 规则兜底）
    - P0/P1 持平: 走「停滞观察」逻辑，窗口延长到 4 轮
      —— 连续 4 轮 P0/P1 持平且无下降趋势 → 触发警报 A（停滞型）
      —— 4 轮窗口内任一轮 P0/P1 下降 → 重置计数器
  例外（不计入反弹/停滞）: 持平/上升的原因是「边际收益 gate 接受残留」
    —— 即某 finding 被标记为「建议接受残留」且 inline me 采纳后导致的 P1/P2 持平
    —— 该轮收敛曲线「接受残留」字段对应严重度 > 0 即视为有依据，不触发警报 A
    —— 证据要求: 收敛曲线必填「接受残留」字段，R2 subagent 必须产出「建议接受残留列表」
  被动验证机制:
    —— R2 subagent 自动判定持平原因（接受残留 vs 修复无效），不依赖 agent 主动声明
    —— R2 输出必须含「持平原因判定」字段（accept_residual / fix_invalid / normal_fluctuation）
    —— 若 R2 判定为 fix_invalid → 触发警报 A；若 accept_residual → 走例外条款；若 normal_fluctuation → 重置停滞计数器
警报 B（回归率）: 某轮修复的回归率 > 30%

任一警报触发 → STOP，向 user 报告:
  - 当前收敛曲线（含「接受残留」字段 + 「持平原因判定」字段）
  - 震荡/回归根因
  - 建议: 继续 / 接受残留 / 升级方案
```

> 「零容忍假收敛」是指不能谎报 0，不是指必须修到 0。过拟合时主动报告比硬修更符合训诫精神。
>
> **警报 A 例外条款**：警报 A 设计意图是检测「修复无效导致的震荡」，而非「主动接受残留导致的持平」。后者是层 1/2 过拟合防护机制的核心设计——若警报 A 否决它，实质废除了层 1/2 的「接受残留」机制。例外条款要求收敛曲线记录「接受残留」字段作为证据，防止 agent 主观滥用「我接受了」逃避警报。

**收敛判定精确化（4 层防御整合）**：

| 条件 | 判定 |
|:-----|:-----|
| P0=0 AND P1=0 AND 连续 2 轮无新 P0/P1 | ✅ 真收敛（**P0/P1 硬条件最优先**，先于此表其他所有判定） |
| P2 ≤ N_max（项目阶段决定） | ✅ P2 允许残留 |
| P2 > N_max | ❌ 继续修复 P2（优先级低于警报） |
| 警报 A 或 B 触发 | ❌ **STOP，向 user 报告**（优先级最高，覆盖 P2 超标判定） |
| 修复成本 > 问题危害 × 3 | ⚠️ 标记「接受残留」 |
| **优先级** | 警报 A/B > 边际收益 gate > P2 超标。同时触发时按此顺序判定 |
| **警报 A 与边际收益 gate 关系** | 边际收益 gate 采纳的残留导致的 P1/P2 持平不触发警报 A（例外条款）；未采纳的修复无效导致的持平仍触发警报 A |

---

## 6. 5 步独立 verify（V1 → V5）

### V1: file exists + content count + link target + 行数

```
# 用 Grep 工具 output_mode=count 验 content hit 数
# 用 Read 工具验文件存在 + 行数
# 软链用 RunCommand: Get-Item <LINK> | Select-Object Target
```

### V2: 5 步 grep 范式（主代理主动防御）

```
1. file size sanity — Read 工具观察行数
2. 残留 grep — Grep 工具 pattern "verdict|self-claim" count
3. 期望 hits 必现 — Grep 工具 pattern "R0|R1a|residual" count
4. 期望 0 hits — Grep 工具 pattern "TODO|FIXME|placeholder" count
5. post-fix 实证 — Read 工具确认改动写入
```

### V3: verdict 字眼 grep

用 Grep 工具，pattern `完成|PASS|OK|没问题|12/12|闭环`，output_mode=count。历史 log 文件例外。

### V4: memory sync 4 维度

| # | 维度 | Sync target | Check method |
|:-:|:-----|:------------|:-------------|
| 1 | user 级偏好 | `<memory_root>/user_profile.md` | Grep 工具搜相关条目 |
| 2 | 项目级规则 | `<memory_root>/projects/<project-slug>/project_memory.md` | Grep 工具搜相关条目 |
| 3 | 近期 topic | `<memory_root>/projects/<project-slug>/<date>/topics.md` | Read 工具看最新 |
| 4 | 复利经验 | 项目内 retrospective 文档（如存在） | Grep 工具搜编号 |

> **路径约定**：`<memory_root>` = agent 的 memory 根目录（如 TRAE `.trae-cn/memory`、Claude Code projects 目录，或项目内 `.agent-memory`）；`<project-slug>` = 当前 workspace 对应的 memory 项目目录名。执行时按当前环境映射。若所用环境无 memory 系统，本步标 `not-applicable`，不编造证据。

### V5: 3-case dry-run（best / worst / null）

```
# 一次性工具 / scaffold 必跑
# best-case: 正常输入预期输出
# worst-case: 边界/异常输入预期错误处理
# null-case: 空输入/不存在的 file
```

用 RunCommand（PowerShell）或 Task subagent 执行，视工具类型而定。

---

## 7. Trigger 场景（何时跑本 skill）

- 任何 plan / spec / quickref / skill / long-doc 写完后
- 批量修复（>10 项）后
- user 说「deep review」「复检」「收敛」「DRL」时
- 本 skill 自身修改后（meta-skill 闭环）
- 怀疑假收敛时（强制重新审查）
- **过拟合迹象**（越修越多 / 连续 3 轮不单调递减 / 回归率 >30%）时

---

## Related

- **mem-wrap-up skill**：[mem-wrap-up](https://github.com/1273984347/mem-wrap-up)（DRL 收敛后触发，收尾阶段反向验证）
- **self-evolution skill**：[self-evolution](https://github.com/1273984347/self-evolution)（DRL residual risk 喂给问题预防维度，复利经验喂给经验复用维度）
- **整合版**：[agent-session-loop](https://github.com/1273984347/agent-session-loop)（审查→收尾→沉淀 三步流水线）

## 8. Self-Disclosure

- 0 verdict 字眼（完成 / PASS / OK / 没问题 / 12/12 / 闭环）
- R3 必写 N residual risk（≥3），含 subagent 盲点 + sample/time-point + 跨 session
- 5 步 grep 必先 reflect（主代理主动防御 default 行为）
- memory sync 4 维度必走
- R2 NOT inline（违反 = 违反真循环铁律）
- 本 skill 修改必先 Read 留底
- 本 skill 修改必走 5 轮（meta-skill，per Scenario 5）
- 收敛曲线必记（每轮 P0/P1/P2，标注假/真收敛）
- **4 层过拟合防护必走**（P2 残留 N + 边际收益 gate + 过拟合警报 + 严重度门槛）

## 9. Reference

- **设计来源**：从真实编码会话中蒸馏的「DRL 真循环铁律」+ 4 层过拟合防护实践（2026-07 打磨，多次假收敛复现后的教训固化）
- **方法论借鉴**：superpowers 系列（verification-before-completion / systematic-debugging / requesting-code-review）的公共反模式结构
