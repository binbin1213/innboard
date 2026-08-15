# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

酒店智能房价牌系统：将酒店大厅竖屏电视改造为数字房价牌，展示酒店宣传图轮播、房型价格、公告、时间与天气。管理端与展示端均通过浏览器远程访问，服务端部署在家庭服务器上。

完整需求与架构见 `酒店智能房价牌系统方案.md`（设计文档）。

技术栈：FastAPI + SQLAlchemy + SQLite（后端），React 18 + Vite + TailwindCSS + react-router-dom（前端）。

## 目录结构

- `backend/` — FastAPI 后端
  - `app/main.py` — 应用入口：lifespan 建表/迁移/seed，挂载路由，构建产物存在时直接托管 `frontend/dist`
  - `app/database.py` — SQLite engine、`SessionLocal`、`get_db`、`Base`；数据文件在 `backend/data/hotel.db`，上传文件在 `backend/uploads/`
  - `app/models.py` — 数据模型：`Room`、`PriceLog`、`Image`、`Announcement`、`Setting`（键值表）、`AuthSession`
  - `app/settings.py` — 键值形式的应用设置读写、PBKDF2 密码哈希、默认值
  - `app/auth.py` — Bearer token 会话认证与 `require_auth` 依赖
  - `app/weather.py` — 天气获取（和风天气为主，Open-Meteo 兜底），进程内 30 分钟缓存
  - `app/seed.py` — 首次启动写入默认房型与公告
  - `app/routers/` — `admin.py`（`/api` 下所有管理 CRUD）、`auth.py`（`/api/auth`）、`display.py`（`/api/display`）
- `frontend/` — React 前端
  - `src/App.jsx` — 路由：`/display`（展示页）、`/admin/*`（管理后台）
  - `src/api.js` — fetch 封装，token 存 `localStorage`（键 `hotel_admin_token`），401 自动跳登录
  - `src/pages/Display.jsx` — 展示页（1080×1920 舞台，等比缩放，30 秒轮询）
  - `src/pages/admin/` — 房价/图片/公告/设置/登录 页面与布局

## 常用命令

后端（在 `backend/` 目录下，需 Python 3.12；系统默认 `python3` 是 3.9，务必用 `python3.12`）：

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload        # 默认 8000 端口；局域网访问加 --host 0.0.0.0
```

前端（在 `frontend/` 目录下）：

```bash
npm install
npm run dev       # Vite 开发服务器，5173 端口，/api 与 /uploads 代理到 127.0.0.1:8000
npm run build     # 产物输出到 frontend/dist，由后端直接托管
```

生产部署：先 `npm run build`，再启动后端 —— `main.py` 检测到 `frontend/dist` 存在时会托管静态文件并对 `/admin/*` 深链做 SPA 回退。

无测试套件、无 lint 配置。

## 关键架构

### 展示端数据流

展示页不区分接口，全部数据来自单一公开端点 `GET /api/display`（房型、图片、公告、酒店名、轮播间隔、天气、`server_time`）。`Display.jsx` 每 30 秒轮询一次，用 `server_time` 校准本地时钟偏移以规避电视时钟漂移，网络中断时保留上次数据继续显示。

### 认证与设置存储

- 单一管理员账号 `admin`，默认密码 `admin123`（首次启动由 `ensure_defaults` 写入）；修改密码会使所有会话失效。
- 登录换取 Bearer token，存 `sessions` 表，7 天有效；所有 `/api` 管理接口（除 `/api/display`、`/api/auth/login`）都依赖 `require_auth`。
- 应用设置（酒店名、轮播间隔、天气 key、logo/二维码文件名等）全部存 `settings` 键值表，不读环境变量或配置文件。新增设置项时在 `settings.py` 的 `DEFAULT_SETTINGS` 注册。

### 数据库与迁移

SQLite 单文件 `backend/data/hotel.db`。无迁移框架，`main.py` 的 `migrate()` 用 `PRAGMA table_info` + `ALTER TABLE` 做增量加列（参考现有的 `rooms.description`、`rooms.remaining_rooms` 处理方式），启动时自动执行。给已有模型加列时须同步在这里补一段幂等迁移。

### 天气

`app/weather.py` 优先用和风天气（需在后台配置 `weather_api_key` + `weather_city`），未配置 key 时回退到 Open-Meteo 按城市名查询。结果缓存 30 分钟，任一来源失败返回缓存或 `None`（展示页优雅跳过天气模块）。

### 房型改价审计

改价会写 `price_logs` 表（含门市价/会员价的前后值），管理后台「房价管理」页展示最近 50 条。价格变更时展示页对相应房型做金色闪烁高亮。

## 约定

- 展示页固定按 1080×1920 设计稿开发，通过 CSS `transform: scale()` 等比缩放适配任意竖屏；新展示内容应沿用该舞台坐标体系与 Tailwind 任意值字号（`text-[Npx]`）。
- 后端返回给管理端的房型/图片/公告列表按 `sort_order, id` 排序，排序接口接收 `{ ids: [...] }` 全量重排。
- 代码注释、接口 `detail` 错误信息、UI 文案均为中文。
