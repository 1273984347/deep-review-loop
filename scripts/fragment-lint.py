#!/usr/bin/env python3
"""Shared-fragment consistency lint for a skill repo.

Guards the cross-file protocol snippets that must stay identical across the
three-skill loop repos (deep-review-loop / mem-wrap-up / self-evolution /
agent-session-loop): the 7-word verdict-ban list, the tool-name mapping
table, and the ban self-match carve-out. The canonical fragments are
hardcoded below — every repo runs this same script (md5-identical), so a
pass here means the fragment agrees with the canonical wording and the
6-word legacy order never reappears.

Pure stdlib, read-only, CI-safe. Mirror of scripts/version-lint.py.
"""

from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Canonical 7-word verdict ban (full order, shared across the three-skill loop).
CANONICAL_BAN = "完成|PASS|12/12|闭环|OK|没问题|looks good"
# Legacy 6-word orders that used to drift in some repos — must not reappear.
LEGACY_BANS = [
    "完成|PASS|OK|没问题|12/12|闭环",
]
# Tool-mapping table anchor rows that every SKILL.md must carry.
ANCHOR_ROWS = [
    "| subagent / Task |",
    "| Grep 工具 |",
    "| Read / Edit / Write |",
]

# Ban self-match carve-out: SKILL.md must instruct the reviewer to exclude the
# ban-list definition line itself before counting hits (meta-skill targets
# embed the ban string, so raw grep always false-positives).
CARVEOUT_ANCHOR = "剔除禁词定义行"

# Cross-repo links that must appear in README (three-skill loop self-references).
SIBLING_REPOS = [
    "1273984347/deep-review-loop",
    "1273984347/mem-wrap-up",
    "1273984347/self-evolution",
    "1273984347/agent-session-loop",
]


def check_readme_links() -> int:
    """Every sibling repo URL must appear in README.md (and README.en.md if present)."""
    errors = 0
    for fname in ("README.md", "README.en.md"):
        readme = ROOT / fname
        if not readme.exists():
            continue
        text = readme.read_text(encoding="utf-8")
        for repo in SIBLING_REPOS:
            if repo not in text:
                print(f"FAIL: {fname} missing cross-repo link ({repo})")
                errors += 1
    return errors


def check_skill() -> int:
    skill = ROOT / "SKILL.md"
    if not skill.exists():
        print("SKIP: SKILL.md not found")
        return 0
    text = skill.read_text(encoding="utf-8")
    errors = 0
    if CANONICAL_BAN not in text:
        print(f"FAIL: SKILL.md missing canonical verdict ban ({CANONICAL_BAN})")
        errors += 1
    for legacy in LEGACY_BANS:
        if legacy in text:
            print(f"FAIL: SKILL.md contains legacy verdict ban order ({legacy})")
            errors += 1
    for row in ANCHOR_ROWS:
        if row not in text:
            print(f"FAIL: SKILL.md missing tool-mapping anchor row ({row})")
            errors += 1
    if CARVEOUT_ANCHOR not in text:
        print(f"FAIL: SKILL.md missing ban self-match carve-out ({CARVEOUT_ANCHOR})")
        errors += 1
    return errors


def check_references() -> int:
    refs = ROOT / "references"
    if not refs.exists():
        return 0
    errors = 0
    for f in sorted(refs.glob("*.md")):
        text = f.read_text(encoding="utf-8")
        # Only files that actually embed a pipe-separated ban list are checked.
        has_ban_regex = "PASS|" in text
        if has_ban_regex and CANONICAL_BAN not in text:
            print(f"FAIL: {f.name} embeds a verdict ban list that is not canonical ({CANONICAL_BAN})")
            errors += 1
        for legacy in LEGACY_BANS:
            if legacy in text:
                print(f"FAIL: {f.name} contains legacy verdict ban order ({legacy})")
                errors += 1
    return errors


def main() -> int:
    errors = check_skill() + check_references() + check_readme_links()
    if errors:
        print(f"FAIL: fragment lint found {errors} issue(s)")
        return 1
    print(f"PASS: fragment lint OK ({CANONICAL_BAN})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
