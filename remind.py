#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""食堂减脂提醒。

每天 4 条微信推送：11:15 午餐 / 15:20 加餐 / 17:20 晚餐 / 18:25 锻炼，
周日 20:00 提醒更新下周菜单。推送通道为 Server酱（微信）。

本地测试：
    python3 remind.py --slot lunch --dry-run
    SENDKEY=xxx python3 remind.py --slot dinner
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
TZ = ZoneInfo("Asia/Shanghai")
WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
SERVERCHAN = "https://sctapi.ftqq.com/{key}.send"


def load_config() -> dict:
    with (ROOT / "config.json").open(encoding="utf-8") as f:
        return json.load(f)


def load_day(today: date) -> tuple[dict | None, dict | None]:
    """取当天数据；当天不在菜单周期内时，按星期几回退到最近一期菜单。"""
    menus = []
    for path in (ROOT / "menus").glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        menus.append((data.get("week_start", ""), data))
    menus.sort(key=lambda item: item[0])
    if not menus:
        return None, None

    chosen = None
    for week_start, data in menus:
        if week_start <= today.isoformat():
            chosen = data
    if chosen is None:
        chosen = menus[-1][1]

    for day in chosen.get("days", []):
        if day.get("date") == today.isoformat():
            return chosen, day
    weekday = WEEKDAYS[today.weekday()]
    for day in chosen.get("days", []):
        if day.get("weekday") == weekday:
            return chosen, day
    return chosen, None


def meal_block(meal: dict) -> str:
    lines = [
        f"**主荤**　{meal.get('main', '-')}",
        f"**配菜**　{meal.get('side', '-')}",
        f"**青菜**　{meal.get('veg', '-')}",
        f"**主食**　{meal.get('carb', '-')}",
    ]
    if meal.get("avoid"):
        lines.append("**避开**　" + " / ".join(meal["avoid"]))
    if meal.get("tip"):
        lines.append(f"> {meal['tip']}")
    return "\n\n".join(lines)


def daily_message(slot: str, day: dict, cfg: dict, today: date) -> tuple[str, str]:
    stamp = f"{today:%m/%d} {day.get('weekday', '')}"
    limits = cfg.get("targets", {})
    calorie = limits.get("calories_kcal", 1650)
    protein = limits.get("protein_g", 135)

    if slot == "lunch":
        title = f"午餐 · {stamp}"
        desp = meal_block(day["lunch"]) + f"\n\n---\n今日目标 {calorie} kcal / 蛋白 {protein}g\n\n先吃菜，再吃肉，最后吃饭。"
    elif slot == "snack":
        title = f"15:20 加餐 · {stamp}"
        desp = (
            f"**{day.get('snack', '无糖酸奶 150g')}**\n\n"
            "这顿别省，防止 17:30 下班饿到吃快吃多。\n\n"
            "顺手喝一杯水。"
        )
    elif slot == "dinner":
        title = f"晚餐 · {stamp}"
        desp = meal_block(day["dinner"]) + "\n\n---\n米饭半碗；荤菜先涮油三秒，盘底汁不碰。"
    elif slot == "workout":
        title = f"18:25 该走了 · {stamp}"
        desp = (
            f"**今日任务**　{day.get('workout', '走 6000-7000 步')}\n\n"
            "**已完成**　午餐 ✓　加餐 ✓\n\n"
            "> 21:00 之后饿就补蛋白：牛奶 200ml 或蛋白粉 1 勺，不吃碳水。\n\n"
            "走完记得喝 300ml 水。"
        )
    else:
        title = "今天吃什么"
        desp = meal_block(day["lunch"])
    return title, desp


def weekly_message() -> tuple[str, str]:
    title = "周日 20:00 · 下周菜单发我"
    desp = (
        "**把下周食堂菜单照片发我**（午餐 + 晚餐，带单价更好）。\n\n"
        "我会更新本周点餐表和推送内容，第二天自动生效。\n\n"
        "---\n顺便报一下这周晨起体重的平均值和腰围，我按数据微调主食量。"
    )
    return title, desp


def infer_slot(now: datetime) -> str:
    if now.weekday() == 6 and 19 <= now.hour < 22:
        return "weekly"
    minutes = now.hour * 60 + now.minute
    if 660 <= minutes < 720:      # 11:00-12:00
        return "lunch"
    if 900 <= minutes < 960:      # 15:00-16:00
        return "snack"
    if 1020 <= minutes < 1080:    # 17:00-18:00
        return "dinner"
    if 1080 <= minutes < 1230:    # 18:00-20:30
        return "workout"
    return "lunch"


def send(title: str, desp: str, dry_run: bool = False) -> bool:
    if dry_run:
        print(f"[dry-run] {title}\n{desp}\n")
        return True

    key = os.environ.get("SENDKEY", "").strip()
    if not key:
        print("缺少环境变量 SENDKEY，跳过推送", file=sys.stderr)
        return False

    payload = urllib.parse.urlencode({"title": title, "desp": desp}).encode("utf-8")
    request = urllib.request.Request(
        SERVERCHAN.format(key=key), data=payload, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8", "ignore")
    except Exception as exc:  # 网络或鉴权失败
        print(f"推送失败：{exc}", file=sys.stderr)
        return False

    print(body)
    try:
        return json.loads(body).get("code") == 0
    except json.JSONDecodeError:
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="食堂减脂微信提醒")
    parser.add_argument(
        "--slot",
        default="auto",
        choices=["auto", "lunch", "snack", "dinner", "workout", "weekly"],
    )
    parser.add_argument("--dry-run", action="store_true", help="只打印，不推送")
    args = parser.parse_args()

    now = datetime.now(TZ)
    today = now.date()
    slot = infer_slot(now) if args.slot == "auto" else args.slot

    if slot == "weekly":
        title, desp = weekly_message()
    else:
        cfg = load_config()
        _, day = load_day(today)
        if not day:
            print("menus/ 里没有可用菜单", file=sys.stderr)
            sys.exit(1)
        title, desp = daily_message(slot, day, cfg, today)

    sys.exit(0 if send(title, desp, args.dry_run) else 1)


if __name__ == "__main__":
    main()
