# src/utils/paths.py — 修复样例（声称已改 pathlib）

import os  # 注意：仍在使用 os.path，与修复记录「统一改用 pathlib」矛盾
from pathlib import Path


def resolve_config(base: str) -> Path:
    # os.path 残留（修复记录声称已全部移除）
    return Path(os.path.join(base, "config", "app.yaml"))
