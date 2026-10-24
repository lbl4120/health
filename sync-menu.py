#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把最新一期食堂菜单同步进健康工作台。

唯一数据源：
    fat-loss-reminder/config.json      （个人资料与目标）
    fat-loss-reminder/menus/*.json     （每周菜谱，取 week_start 最新一期）

生成目标：
    health-workbench/health-workbench.html 里的 <script id="menuData"> 数据块

微信推送读取的就是同一个 menus/*.json，所以同步后两边菜单天然一致。

用法：
    python3 sync-menu.py
    python3 sync-menu.py --check      # 只检查是否需要同步
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "fat-loss-reminder" / "config.json"
MENUS = ROOT / "fat-loss-reminder" / "menus"
HTML = ROOT / "health-workbench" / "index.html"
BLOCK = re.compile(
    r'(<script type="application/json" id="menuData">)(.*?)(</script>)',
    re.DOTALL,
)


def latest_menu() -> tuple[Path, dict]:
    entries = []
    for path in MENUS.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            sys.exit(f"菜单 JSON 解析失败：{path}（{exc}）")
        entries.append((data.get("week_start", ""), path, data))
    if not entries:
        sys.exit(f"{MENUS} 里没有菜单文件")
    entries.sort(key=lambda item: item[0])
    week_start, path, data = entries[-1]
    return path, data


def build_payload(config: dict, menu: dict) -> dict:
    profile = config.get("profile", {})
    targets = config.get("targets", {})
    return {
        "profile": {
            "sex": profile.get("sex", "male"),
            "age": profile.get("age"),
            "height_cm": profile.get("height_cm"),
            "start_weight_kg": profile.get("start_weight_kg"),
            "target_weight_kg": profile.get("target_weight_kg"),
            "calories_kcal": targets.get("calories_kcal"),
            "protein_g": targets.get("protein_g"),
        },
        "week_start": menu.get("week_start"),
        "week_end": menu.get("week_end"),
        "days": [
            {
                "weekday": day.get("weekday"),
                "lunch": day.get("lunch"),
                "dinner": day.get("dinner"),
                "snack": day.get("snack"),
                "workout": day.get("workout"),
            }
            for day in menu.get("days", [])
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="同步菜单到健康工作台")
    parser.add_argument("--check", action="store_true", help="只检查是否已同步")
    args = parser.parse_args()

    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    menu_path, menu = latest_menu()
    payload = build_payload(config, menu)
    serialized = json.dumps(payload, ensure_ascii=False, indent=2)

    html = HTML.read_text(encoding="utf-8")
    match = BLOCK.search(html)
    if not match:
        sys.exit(f"没有在 {HTML} 里找到 menuData 数据块")

    current = json.loads(match.group(2))
    if current == payload:
        print(f"已是最新：{menu_path.name}（{len(payload['days'])} 天）")
        return
    if args.check:
        print(f"需要同步：{menu_path.name}")
        sys.exit(2)

    html = html[: match.start(2)] + "\n" + serialized + "\n" + html[match.end(2) :]
    HTML.write_text(html, encoding="utf-8")
    print(f"已同步 {menu_path.name} → {HTML.name}（{len(payload['days'])} 天）")


if __name__ == "__main__":
    main()
