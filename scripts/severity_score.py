#!/usr/bin/env python3
"""Severity floor scorer for the deep-review pipeline.

Deterministic external lower bound for severity classification: the model may
raise a finding's severity, never lower it below the floor derived from its
own evidence. Closes the cheapest gaming path (downgrade P1 -> P2 to slip
through the P2 auto-pass). Any `dispute` (model severity below floor) forces
the finding into the residual-risk list and trips the exit ACK gate.

Usage:
    python scripts/severity_score.py findings.jsonl   # or pipe via stdin

Input: one JSON object per line:
    {"id": "...", "file": "...", "evidence": "...", "model_severity": "P0"|"P1"|"P2"|"P3"}
    `evidence` = the raw tool output (Grep/Read/command) the finding is based on.

Output: one JSON object per line: {"id", "floor", "final", "dispute"}
Exit code: 1 if any dispute exists (CI-gateable), else 0.

Limitation (must be stated in the report): floors only cover greppable,
explicit signals — this is a lower bound, not a classifier. "No signal" is
never a justification for downgrading.

Pure stdlib, read-only, CI-safe. Same repo conventions as version-lint.py.
"""

from __future__ import annotations
import json, re, sys

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}

# P0 floor signals: crash / security / data-loss evidence.
P0_PATTERNS = [
    r"(?i)\b(AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,})\b",                                  # hardcoded cloud/LLM keys
    r"(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[\"'][^\"']{8,}",  # inline credentials
    r"(?i)\b(rm\s+-rf\s+[~/\\]|drop\s+table|truncate\s+table|git\s+push\s+(--force|-f)\b)",   # data-loss commands
    r"(?i)\b(bypass|disable|remove)\s+(auth|authentication|csrf|xss|sanitiz\w*)",        # security control removal
]

# P1 floor signals: core-function failure evidence.
P1_PATTERNS = [
    r"(?m)^\s*(Traceback \(most recent call last\)|panic:|FATAL:)",                      # failure traces
    r"(?i)\b(TODO|FIXME|HACK|XXX)\b[^`\n]{0,80}\b(auth|payment|security|money|crypto)\b",  # unfinished critical work
    r"(?i)\b(FAILED|failures?)\b\s*[:=]?\s*\d+|\b\d+\s+(failed|failing)\b",              # test-run failures
    r"(?i)\b segmentation fault |\bcore dumped\b",                                       # native crashes
]


def floor_of(evidence: str, file: str) -> str:
    blob = f"{file}\n{evidence}"
    if any(re.search(p, blob) for p in P0_PATTERNS):
        return "P0"
    if any(re.search(p, blob) for p in P1_PATTERNS):
        return "P1"
    return "P3"  # no explicit signal -> no floor above P3


def main() -> int:
    lines = sys.stdin.read().splitlines() if sys.stdin.isatty() is False else []
    path = sys.argv[1] if len(sys.argv) > 1 else None
    if path:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()

    disputes = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            f = json.loads(line)
        except json.JSONDecodeError as e:
            print(f"ERROR: invalid JSONL line skipped: {e}")
            continue
        fl = floor_of(f.get("evidence", ""), f.get("file", ""))
        ms = f.get("model_severity", "P3")
        dispute = ORDER.get(ms, 3) > ORDER[fl]
        disputes += int(dispute)
        print(json.dumps(
            {"id": f.get("id"), "floor": fl,
             "final": ms if not dispute else fl, "dispute": dispute},
            ensure_ascii=False))

    if disputes:
        print(f"disputes={disputes}: model severity below floor -> floor wins, "
              f"findings go to residual risk, exit ACK gate is triggered")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
