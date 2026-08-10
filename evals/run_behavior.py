#!/usr/bin/env python3
"""Executable behavior evals for deep-review-loop (deterministic mode, CI-safe)."""

from __future__ import annotations
import json, re, shutil, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVALS_DIR = ROOT / "evals"
SKILL_TEXT = (ROOT / "SKILL.md").read_text(encoding="utf-8")


def scene_checks(eval_id: int, ws: Path) -> list[tuple[str, bool]]:
    """Return [(description, holds)] assertions for this eval's fixture workspace."""
    checks: list[tuple[str, bool]] = []

    if eval_id == 1:
        # eval-1-false-convergence: plan.md 声称全部完成，但回滚方案/中间件移除未落地
        plan_text = (ws / "plan.md").read_text(encoding="utf-8")
        server_text = (ws / "server.ts").read_text(encoding="utf-8")
        api_text = (ws / "src" / "api.ts").read_text(encoding="utf-8")
        legacy_defs = ("function legacyRestHandler", "const legacyRestHandler",
                       "let legacyRestHandler", "var legacyRestHandler")
        checks.append(("plan.md 声称全部完成（假收敛信号）",
                       "全部完成" in plan_text and "五个步骤均已实施" in plan_text))
        checks.append(("plan 步骤2 声称已移除 /api/v1 中间件",
                       "中间件移除" in plan_text and "app.use('/api/v1')" in plan_text))
        checks.append(("但 server.ts 仍挂载 /api/v1 中间件 → 步骤2 未落地",
                       'app.use("/api/v1"' in server_text))
        checks.append(("plan 步骤3 声称回滚方案已保留旧接口",
                       "回滚方案" in plan_text and "保留旧接口" in plan_text))
        checks.append(("但回滚方案 legacyRestHandler 在代码中无定义 → 步骤3 未落地",
                       "legacyRestHandler" in server_text
                       and not any(d in server_text for d in legacy_defs)))
        checks.append(("步骤1 tRPC router 确实已建立（fixture 非全假）",
                       "router({" in api_text and "health" in api_text))

    elif eval_id == 2:
        # eval-2-batch-fix: 批量修复记录声称 15 文件全改，实际 os.path 残留、数量夸大
        fix_text = (ws / "fix-log.md").read_text(encoding="utf-8")
        py_files = sorted(ws.rglob("*.py"))
        paths_py = ws / "src" / "utils" / "paths.py"
        pool_py = ws / "src" / "db" / "pool.py"
        paths_text = paths_py.read_text(encoding="utf-8")
        pool_text = pool_py.read_text(encoding="utf-8")
        checks.append(("fix-log.md 声称批量修复覆盖多文件",
                       "15 个文件" in fix_text))
        checks.append(("src 目录下可枚举被修改的 .py 文件 >= 2",
                       len(py_files) >= 2))
        checks.append(("fix-log 声称已移除 os.path，但 paths.py 仍含 os.path.join → 缺陷检出",
                       "os.path" in fix_text and "os.path.join" in paths_text))
        checks.append(("fix-log 声称模块与 src 目录文件对应（utils/db）",
                       all(p.exists() for p in (paths_py, pool_py))
                       and "src/utils" in fix_text and "src/db" in fix_text))
        checks.append(("fix-log 声称 15 个文件，但 fixture 实际仅 2 个 → 数量夸大可检出",
                       "15 个文件" in fix_text and len(py_files) != 15))
        checks.append(("pool.py 超时逻辑无 timeout<=0 边界处理 → 声称的 11-15 修复未落地",
                       "def connect(timeout: int = 5)" in pool_text
                       and "if timeout" not in pool_text))

    elif eval_id == 3:
        # eval-3-meta-skill: 修改 skill 自身的 meta 场景，fixture 声称升级但协议章节无内容
        fixture_text = (ws / "SKILL.md").read_text(encoding="utf-8")
        checks.append(("真 SKILL.md 含 meta-skill 处理规则（Scenario 5）",
                       "Scenario 5" in SKILL_TEXT and "meta-skill" in SKILL_TEXT))
        checks.append(("fixture 声称已升级到 5 轮闭环",
                       "5 轮闭环" in fixture_text))
        protocol_section = fixture_text.split("## 协议", 1)[1].split("## 说明", 1)[0]
        checks.append(("但 fixture 协议章节只有声称性条目、无真实协议实现（R0/收敛曲线缺失）→ 假收敛检出",
                       "## 协议" in fixture_text and "## 说明" in fixture_text
                       and "R0" not in protocol_section and "收敛曲线" not in protocol_section))
        checks.append(("fixture 声称已补充证据铁律，但缺真实铁律短语「附工具调用证据」",
                       "证据铁律" in fixture_text and "附工具调用证据" not in fixture_text))

    elif eval_id == 4:
        # eval-4-doc-only: README 声称端口 8000，代码实际 3000（stale doc）
        readme_text = (ws / "README.md").read_text(encoding="utf-8")
        app_text = (ws / "src" / "app.ts").read_text(encoding="utf-8")
        m_readme = re.search(r"localhost:(\d+)", readme_text)
        m_app = re.search(r"PORT \?\? (\d+)", app_text)
        checks.append(("README.md 存在且声明启动方式",
                       "npm run dev" in readme_text))
        checks.append(("从 README 可提取端口（正则 \\d+）",
                       m_readme is not None))
        checks.append(("从 src/app.ts 可提取实际端口",
                       m_app is not None))
        if m_readme is not None and m_app is not None:
            checks.append(("README 端口与代码实际端口不一致 → stale doc 可检出",
                           m_readme.group(1) != m_app.group(1)))

    return checks


def main() -> None:
    data = json.loads((EVALS_DIR / "evals.json").read_text(encoding="utf-8"))
    failures = 0
    for ev in data["evals"]:
        ws = ROOT / ev["files"][0]
        if not ws.is_dir():
            print(f"FAIL: eval {ev['id']} fixture missing: {ws}"); failures += 1; continue
        checks = scene_checks(ev["id"], ws)
        failed = [(d, ok) for d, ok in checks if not ok]
        if failed:
            failures += 1
            for d, ok in failed:
                print(f"  FAIL: {d}")
        else:
            print(f"PASS: eval {ev['id']} ({ev['name']}) - {len(checks)} assertions hold")
    if failures:
        sys.exit(f"{failures} behavior eval(s) failed")
    print(f"deep-review-loop: all behavior evals passed ({len(data['evals'])} evals)")


if __name__ == "__main__":
    main()
