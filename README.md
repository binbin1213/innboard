# innboard · 酒店智能房价牌

为酒店大厅竖屏电视设计的数字房价牌系统：替代传统纸质房价牌，展示酒店宣传图轮播、房型价格、公告、时间与天气。管理端与展示端均通过浏览器远程访问。

## 功能

- 酒店宣传图片自动轮播（可排序、删除）
- 实时展示房价（门市价 / 会员价）
- 后台在线修改价格，展示端 30 秒内自动刷新
- 满房状态、剩余间数展示
- 价格修改日志（便于追溯）
- 公告管理（入住/退房/早餐时间、营销活动）
- 时间（服务端校准）与天气显示（和风天气，未配置时回退 Open-Meteo）
- 酒店名称、LOGO、自助下单二维码、轮播间隔配置
- 后台登录认证

## 技术栈

- 后端：FastAPI + SQLAlchemy + SQLite
- 前端：React 18 + Vite + TailwindCSS + react-router-dom

## 目录结构

```
backend/   FastAPI 后端（数据存 data/hotel.db，上传文件存 uploads/）
frontend/  React 前端（展示页 + 管理后台）
```

## 本地运行

后端（需 Python 3.12，在 `backend/` 下）：

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload   # 默认 8000 端口
```

前端（在 `frontend/` 下）：

```bash
npm install
npm run dev    # Vite 开发服务器，5173 端口，/api 与 /uploads 代理到 8000
```

访问：

- 展示页：http://localhost:5173/display
- 管理后台：http://localhost:5173/admin

## 生产部署

先构建前端，再由后端托管静态文件：

```bash
cd frontend && npm run build
cd ../backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

后端检测到 `frontend/dist` 存在时会自动托管前端并处理 `/admin/*` 深链。

## 默认账号

- 用户名：`admin`
- 密码：**首次启动自动生成**

首次启动时系统生成一个随机密码，同时：

1. 打印到启动日志
2. 写入 `backend/data/initial_password.txt`

登录后请立即在「系统设置 → 修改登录密码」中修改，修改成功后 `initial_password.txt` 会自动删除。

> 不再提供固定默认密码，避免部署后忘记修改形成公开后门。公网部署请启用 HTTPS 并限制后台访问来源。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_ENV` | `production` | 设为 `development` 可开启 `/docs` 接口文档，生产默认关闭 |
| `ALLOWED_ORIGINS` | 空 | 允许跨域的来源，逗号分隔。前后端同源部署时无需配置 |
| `LOG_LEVEL` | `INFO` | 日志级别 |
| `MAINTENANCE_INTERVAL_HOURS` | `24` | 孤儿文件检查与数据库备份的执行间隔 |
| `CLEANUP_ORPHAN_UPLOADS` | `0` | 设为 `1` 才把未被引用的上传文件移入 `data/trash/`（默认只告警不移动） |
| `TRASH_KEEP_DAYS` | `30` | 回收目录内文件的保留天数 |
| `INNBOARD_DATA_DIR` | `backend/data` | 数据与数据库目录，测试时用于隔离 |
| `INNBOARD_UPLOAD_DIR` | `backend/uploads` | 上传文件目录 |

数据安全相关的默认行为：

- SQLite 运行在 WAL 模式，并启用外键约束
- 数据库每次启动与每 `MAINTENANCE_INTERVAL_HOURS` 小时备份一次到 `data/backups/`，保留最近 7 份
- 上传文件按真实文件头校验类型，伪装成图片的非法内容会被拒绝
- 登录失败 5 次后锁定来源 5 分钟

## 测试

```bash
cd backend
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/ -q
```

测试使用独立的临时数据目录，不会读写真实的 `data/hotel.db`。

## 设计文档

完整需求与架构见 `酒店智能房价牌系统方案.md`。
