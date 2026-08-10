#!/usr/bin/env python3
"""Cross-source version consistency lint for a skill repo.

Checks that the semantic version declared in SKILL.md frontmatter matches every
other source of truth in the repo: README compatibility table, CHANGELOG head,
and .claude-plugin/marketplace.json. Pure stdlib, read-only, CI-safe.
"""

from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_version() -> str:
    text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    m = re.search(r'version:\s*"?(\d+\.\d+\.\d+)"?', text.split("---", 2)[1])
    if not m:
        sys.exit("FAIL: SKILL.md frontmatter has no semver metadata.version")
    return m.group(1)


def check_readme(v: str) -> None:
    readme = ROOT / "README.md"
    if not readme.exists():
        print("SKIP: README.md not found")
        return
    text = readme.read_text(encoding="utf-8")
    if f"SKILL.md 版本 | {v}" not in text and f"SKILL.md version | {v}" not in text:
        sys.exit(f"FAIL: README version table does not match SKILL.md ({v})")


def check_changelog(v: str) -> None:
    cl = ROOT / "CHANGELOG.md"
    if not cl.exists():
        print("SKIP: CHANGELOG.md not found")
        return
    head = cl.read_text(encoding="utf-8")
    m = re.search(r"## \[\d+\.\d+\.\d+\]", head)
    if not m:
        sys.exit("FAIL: CHANGELOG.md has no version headers")
    if f"## [{v}]" not in head:
        sys.exit(f"FAIL: CHANGELOG head does not match SKILL.md ({v})")


def check_marketplace(v: str) -> None:
    mp = ROOT / ".claude-plugin" / "marketplace.json"
    if not mp.exists():
        print("SKIP: marketplace.json not found")
        return
    data = json.loads(mp.read_text(encoding="utf-8"))
    meta = data.get("metadata", {})
    if meta.get("version") != v:
        sys.exit(f"FAIL: marketplace.json metadata.version ({meta.get('version')}) != SKILL.md ({v})")


def main() -> None:
    v = read_version()
    check_readme(v)
    check_changelog(v)
    check_marketplace(v)
    print(f"PASS: version lint OK ({v}) across SKILL.md/README/CHANGELOG/marketplace.json")


if __name__ == "__main__":
    main()
