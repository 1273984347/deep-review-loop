#!/usr/bin/env python3
"""LLM behavior evals for deep-review-loop (manual gate, NOT in CI).

Runs the real LLM against the eval fixtures so the skill's *behavior* is
verified, not just its file contents. Two modes:

  --api     Call an LLM directly (needs OPENAI_API_KEY or ANTHROPIC_API_KEY).
            Writes responses to evals/output/eval-N-response.txt.
  --manual  Generate prompts to evals/output/eval-N-prompt.txt; you run each
            prompt in any agent and paste the response into
            evals/output/eval-N-response.txt.
  --check   (default) Structural-check all responses in evals/output/ and print
            PASS/FAIL + items that need human confirmation.

Design notes:
- NOT wired into CI: requires API keys + human judgment on LLM output quality.
  Run before release, or after any protocol change (R rounds / gates).
- The structural checks are intentionally loose: they verify the output
  *contains the required protocol artifacts* (convergence curve, >=3 residual,
  tool evidence, no verdict words), not the semantic quality — that part is
  the human's job, and this script prints explicit "human review" rows.
- Pure stdlib (urllib), read-only except writing evals/output/.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVALS = ROOT / "evals"
FIXTURES = EVALS / "fixtures"
OUT = EVALS / "output"

# Mirrors the canonical verdict ban (kept in sync with fragment-lint).
VERDICT_BAN = ["完成", "PASS", "12/12", "闭环", "OK", "没问题", "looks good"]


def load_evals() -> dict:
    return json.loads((EVALS / "evals.json").read_text(encoding="utf-8"))


def fixture_tree(files: list[str]) -> str:
    """Build a compact tree of the fixture files so the LLM prompt is self-contained."""
    lines = []
    for rel in files:
        p = ROOT / rel
        if not p.exists():
            lines.append(f"[missing] {rel}")
            continue
        if p.is_dir():
            for f in sorted(p.rglob("*")):
                if f.is_file():
                    lines.append(f"{f.relative_to(ROOT).as_posix()}  ({f.stat().st_size} B)")
        else:
            lines.append(f"{rel}  ({p.stat().st_size} B)")
    return "\n".join(lines)


def build_prompt(eval_: dict, skill_name: str) -> str:
    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    return (
        f"You are executing the {skill_name} skill in a real workspace.\n"
        f"--- SKILL.md (protocol to follow) ---\n{skill}\n"
        f"--- End SKILL.md ---\n\n"
        f"Workspace files:\n{fixture_tree(eval_['files'])}\n\n"
        f"Task: {eval_['prompt']}\n\n"
        f"Run the full protocol on this workspace and report your findings.\n"
        f"Expected output must include: a convergence curve, >=3 residual risks, "
        f"tool-call evidence for every finding, and no verdict words from the ban list."
    )


def call_api(prompt: str, model: str | None) -> str:
    key = os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        sys.exit("FAIL: no OPENAI_API_KEY / ANTHROPIC_API_KEY set (use --manual instead)")
    provider = "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "openai"
    if provider == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 4000,
        }
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        with urllib.request.urlopen(
            urllib.request.Request(url, json.dumps(payload).encode(), headers)
        ) as resp:
            data = json.loads(resp.read().decode())
            return data["choices"][0]["message"]["content"]
    else:
        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": model or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            "max_tokens": 4000,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        with urllib.request.urlopen(
            urllib.request.Request(url, json.dumps(payload).encode(), headers)
        ) as resp:
            data = json.loads(resp.read().decode())
            return data["content"][0]["text"]


def structural_checks(text: str, eval_: dict) -> list[tuple[str, bool]]:
    """Loose structural assertions. Semantic quality is a human-review item."""
    checks: list[tuple[str, bool]] = []
    checks.append(("含收敛曲线（Round/P0/P1）", bool(re.search(r"(Round|P0|P1)", text))))
    checks.append(("residual risk ≥3 条", len(re.findall(r"residual", text, re.I)) >= 3))
    checks.append(("附工具证据（Grep/Read/file:）", bool(re.search(r"(Grep|Read|file:)", text))))
    checks.append(("无 verdict 禁词", not any(w in text for w in VERDICT_BAN)))
    return checks


def run(evals: dict, use_api: bool, model: str | None) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    skill_name = evals.get("skill_name", "skill")
    for eval_ in evals["evals"]:
        n = eval_["id"]
        prompt = build_prompt(eval_, skill_name)
        p_prompt = OUT / f"eval-{n}-prompt.txt"
        p_resp = OUT / f"eval-{n}-response.txt"
        p_prompt.write_text(prompt, encoding="utf-8")
        if use_api:
            print(f"== calling API for eval {n} ({eval_['name']}) ...")
            resp = call_api(prompt, model)
            p_resp.write_text(resp, encoding="utf-8")
            print(f"   -> saved {p_resp.relative_to(ROOT)}")
        else:
            print(f"== prompt for eval {n} ({eval_['name']}) -> {p_prompt.relative_to(ROOT)}")
            if not p_resp.exists():
                print("   (no response yet; run the prompt and save the response file)")


def check(evals: dict) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    n_total = n_fail = 0
    for eval_ in evals["evals"]:
        n = eval_["id"]
        p_resp = OUT / f"eval-{n}-response.txt"
        if not p_resp.exists():
            print(f"[SKIP] eval {n} ({eval_['name']}): no response file yet")
            continue
        text = p_resp.read_text(encoding="utf-8")
        n_total += 1
        rows = structural_checks(text, eval_)
        bad = [name for name, ok in rows if not ok]
        n_fail += 1 if bad else 0
        print(f"[{'FAIL' if bad else 'PASS'}] eval {n} ({eval_['name']})")
        for name, ok in rows:
            print(f"   {'✓' if ok else '✗'} {name}")
        print("   [HUMAN REVIEW] 人工核对（脚本不判语义）：")
        for exp in eval_["expectations"]:
            print(f"     - {exp}")
    print(f"\n== structural: {n_total - n_fail}/{n_total} passed (semantic quality = human review above)")
    return 1 if n_fail else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="LLM behavior evals for deep-review-loop")
    ap.add_argument("--api", action="store_true", help="call LLM API (needs OPENAI/ANTHROPIC key)")
    ap.add_argument("--manual", action="store_true", help="generate prompts only")
    ap.add_argument("--check", action="store_true", help="structural-check saved responses")
    ap.add_argument("--model", default=None, help="model name override")
    args = ap.parse_args()
    evals = load_evals()
    if args.api:
        run(evals, use_api=True, model=args.model)
    elif args.manual:
        run(evals, use_api=False, model=None)
    else:  # default: check
        return check(evals)
    return 0


if __name__ == "__main__":
    sys.exit(main())
