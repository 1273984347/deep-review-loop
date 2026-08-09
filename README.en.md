# deep-review-loop

> A 5-round deep review loop (R0-R3 + V1-V5) with 4-layer anti-overfit protection. **Review → fix → re-review** until N consecutive rounds find nothing new.

[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

## What problem it solves

After batch fixes, long documents, or editing a skill itself, LLMs tend to **false-converge** — a single shallow pass concludes "0 issues, done," and the next deep review immediately surfaces problems. This skill hardens the "no false convergence" iron law into a protocol: issue counts must monotonically drop to 0, and N consecutive re-reviews must find nothing new. Four layers of anti-overfit protection stop the review from spiraling ("fix more, find more").

## Core capabilities

- **5-round protocol**: R0 surface check → R1a 3 independent verifiers (factual / completeness / reusability) → R1b adversarial review → R2 independent audit → R3 convergence verdict
- **4-layer anti-overfit**: P2 residual N (competition 0 / production 3 / prototype 10), marginal-benefit gate (fix cost > harm ×3 → accept residual), overfit alarm (oscillation / regression rate >30% → STOP), severity threshold (P3 not reported)
- **Evidence iron law**: every finding must attach tool-call evidence; "0 findings" also requires proof you actually looked
- **Anti-skip toolkit**: 5 pressure scenarios, 6 excuse rebuttals, 7 red flags
- **5-step independent verify**: file/line count, grep patterns, verdict-word ban, memory sync, 3-case dry-run

## Installation

A standard Agent Skill (`SKILL.md` + `references/`), installable by any Agent Skills client. Pick one:

**Option A: natural-language install (recommended)**

In Claude Code, Codex, or any Agent Skills client, just say:

```text
Install this skill: https://github.com/1273984347/deep-review-loop
```

The agent clones it into your skills directory and registers it automatically. If your tool doesn't support that, copy it manually:

```bash
git clone https://github.com/1273984347/deep-review-loop.git
cp -r deep-review-loop <your-skills-dir>/deep-review-loop
```

**Option B: Claude Code plugin marketplace (one command)**

```text
/plugin marketplace add 1273984347/deep-review-loop
/plugin install deep-review-loop@deep-review-loop
```

**Option C: skills.sh CLI (the npm of agents)**

```bash
npm install -g @anthropic-ai/skills
npx skills add https://github.com/1273984347/deep-review-loop
```

## Usage

**How to trigger** (say any of these):

```
Run a deep review over this batch of changes
I finished the plan — run convergence
I just edited this skill, run DRL
Last time you said 0 issues — I suspect false convergence
```

**Does / doesn't apply**:

| ✅ Applies | ❌ Doesn't apply |
|---|---|
| After writing/modifying a plan, spec, skill, or long doc | One-off single-file edits (no structural risk) |
| After batch fixes (>10 items) | Routine coding/completion (no written artifacts) |
| User says "deep review / DRL / 复检 / 收敛" | Casual Q&A |
| False convergence suspected (forced re-review) | Doc/memory wrap-up (use [mem-wrap-up](https://github.com/1273984347/mem-wrap-up)) |
| After editing the skill itself (meta-skill scenario) | Retro/sedimentation (use [self-evolution](https://github.com/1273984347/self-evolution)) |

## Evaluation & CI

This repo ships an evaluation suite (`evals/`) with two CI layers to prevent regression:

```text
evals/
├── fixtures/                # 4 behavior-scenario workspaces (false convergence / batch fix / meta-skill / doc-only)
├── evals.json               # behavior evals: prompt + expected_output + expectations
├── trigger-eval.json        # trigger evals: 12 should-trigger / should-not-trigger queries
└── validate.py              # deterministic structural regression checks
```

- **Layer 1**: official `skills-ref validate` — frontmatter compliance
- **Layer 2**: `python evals/validate.py` — asserts description trigger markers + negative-trigger clause, protocol phrases (R0-R3 / convergence curve / evidence iron law), and fixture integrity of all evals

Both run on every push; any missing contract turns the check red.

## MCP integration (optional)

This skill and MCP are **complementary, not dependent**: MCP provides external tool/data connections; the skill orchestrates the review flow. MCP is an **optional enhancement** — without it, the skill falls back to built-in tools (Grep/Read/LS + subagents).

**Typical integrations**:

| MCP type | Purpose | Enhancement |
|---|---|---|
| Database MCP | Query real schema / data | Independent evidence source for R1a factual checks |
| API / service-status MCP | Runtime health checks | Verify runtime state, not just code |
| Code-scan MCP | Security / dependency audit | Extra lens for R1b adversarial review |

**Steps**:
1. Enable the MCP server in your agent config;
2. Declare "optional MCP: xxx" in the SKILL.md `compatibility` field with a fallback rule;
3. In-skill instruction: "use the MCP if present, else built-in tools" — never block the flow on a missing MCP.

## Version compatibility

| Check | Value |
|---|---|
| SKILL.md version | 1.3.0 |
| Agent Skills standard | Compatible ([agentskills.io](https://agentskills.io); frontmatter: name/description/license/metadata) |
| Frontmatter validation | `skills-ref validate` (CI, see [.github/workflows/validate.yml](.github/workflows/validate.yml)) |
| Structural regression | `python evals/validate.py` (CI) |
| Runtime deps | No Python/Node scripts; needs subagent spawning + file search (Grep/Read/LS) |
| MCP deps | None (optional) |
| Linked skills | [mem-wrap-up](https://github.com/1273984347/mem-wrap-up) / [self-evolution](https://github.com/1273984347/self-evolution) — works standalone |

**Client compatibility**:

| Client | Install method | Support |
|---|---|---|
| TRAE | Copy folder into skills dir, auto-registered | ✅ |
| Claude Code | `/plugin marketplace add` or copy folder | ✅ |
| Codex / Cursor / OpenCode etc. | Copy folder (Agent Skills standard clients) | ✅ |
| Others | Requires SKILL.md frontmatter + progressive disclosure | Depends |

## Environment

- Needs subagent/task spawning + file search tools (Grep/Read/LS).
- Memory paths use `<memory_root>` placeholders (mark `not-applicable` if no memory system — never fabricate evidence).

## Related repos

- [agent-session-loop](https://github.com/1273984347/agent-session-loop) — all-in-one review → wrap-up → evolution pipeline
- [mem-wrap-up](https://github.com/1273984347/mem-wrap-up) — wrap-up (triggered after DRL converges)
- [self-evolution](https://github.com/1273984347/self-evolution) — evolution (consumes DRL residual risks)

## License

[Apache-2.0](LICENSE)
