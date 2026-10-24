# 食堂减脂提醒（微信）

每天 4 条微信推送 + 周日 1 条，内容来自 `menus/` 里的当周菜单。

## 目录

```
fat-loss-reminder/
├── config.json                     # 个人数据与目标
├── menus/2026-10-19.json           # 当周点餐表（每周替换）
├── remind.py                       # 推送脚本
└── .github/workflows/remind.yml    # 定时任务（GitHub Actions）
```

## 推送时间（北京时间）

| 时间 | 内容 |
|---|---|
| 11:15 | 今天午餐点什么 |
| 15:20 | 加餐提醒 |
| 17:20 | 晚餐组合 + 涮油提醒 |
| 18:25 | 锻炼任务 |
| 周日 20:00 | 提醒发下周菜单 |

## 部署（一次，约 10 分钟）

1. 打开 https://sct.ftqq.com，微信扫码登录，复制 **SendKey**。
2. 新建一个 **私有** GitHub 仓库，把本目录内容推上去。
3. 仓库 → Settings → Secrets and variables → Actions → New repository secret：
   - Name：`SENDKEY`
   - Value：上一步复制的 SendKey
4. 仓库 → Actions → 启用 workflow；点 **Run workflow**，slot 选 `lunch`，确认微信收到消息。
5. 手机微信关注「方糖」服务号，之后消息会以服务号通知出现。

## 每周更新

1. 把新菜单图发给 AI，按 `.trae/skills/canteen-diet-coach` 生成 `menus/<周一日期>.json`。
2. 在 `/workspace` 执行 `python3 sync-menu.py`，把同一份菜单同步进健康工作台。
3. push 后，微信推送与工作台同时生效，不需要改代码。

## 数据关系

| 数据 | 存放位置 | 谁在用 |
|---|---|---|
| 每周菜单 | `menus/*.json`（唯一数据源） | 微信推送 + 工作台（由 sync-menu.py 同步） |
| 个人资料与目标 | `config.json` | 两者共用 |
| 体重 / 打卡 | 手机浏览器 localStorage | 仅工作台，不上传 |

## 本地测试

```bash
python3 remind.py --slot lunch --dry-run     # 只打印
SENDKEY=你的key python3 remind.py --slot dinner   # 真发一条
```

## 注意

- Server酱免费版每天有推送条数上限（约 5 条），本方案每天 4 条、周日 5 条，接近上限但不超过；超限时删掉 15:20 那条。
- GitHub Actions 的 cron 可能延迟 5–15 分钟，属正常。
- `SENDKEY` 只放 GitHub Secrets，不要写进代码或提交历史。
- 沙盒/公司网络访问 `sctapi.ftqq.com` 需要走代理，GitHub Actions 不需要。
