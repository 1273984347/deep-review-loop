# src/db/pool.py — 修复样例

import time


def connect(timeout: int = 5) -> "Connection":
    # 超时逻辑：传 timeout=0 时永不重试（边界未处理，见修复记录 11-15 声称已处理）
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            return Connection()
        except ConnectionError:
            time.sleep(0.5)
    raise TimeoutError("db connect timeout")


class Connection:
    def __init__(self) -> None:
        raise ConnectionError("simulated")
