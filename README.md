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
- 密码：`admin123`

> 首次登录后请立即在「系统设置 → 修改登录密码」中修改，并建议公网部署时启用 HTTPS、限制后台访问来源。

## 设计文档

完整需求与架构见 `酒店智能房价牌系统方案.md`。
