import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .auth import purge_expired_sessions
from .database import BASE_DIR, UPLOAD_DIR, Base, SessionLocal, engine
from .maintenance import run_maintenance, start_maintenance_worker
from .routers import admin, auth, display
from .seed import seed_data
from .settings import ensure_defaults

APP_ENV = os.getenv("APP_ENV", "production").lower()
IS_PRODUCTION = APP_ENV == "production"

# 前端与后端同源部署，默认不需要跨域；本地开发时通过环境变量放开
ALLOWED_ORIGINS = [o for o in (x.strip() for x in os.getenv("ALLOWED_ORIGINS", "").split(",")) if o]
MAINTENANCE_INTERVAL_HOURS = float(os.getenv("MAINTENANCE_INTERVAL_HOURS", "24"))

LOG_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


def configure_logging() -> None:
    """uvicorn 会先配置 root logger，这里统一成项目自己的格式。"""
    root = logging.getLogger()
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    formatter = logging.Formatter(LOG_FORMAT)
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
        root.addHandler(handler)
    else:
        for handler in root.handlers:
            handler.setFormatter(formatter)

    # 第三方库的 INFO 日志噪音很大（每条出站请求都会记一条），只保留告警及以上
    for noisy in ("httpx", "httpcore", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


configure_logging()
logger = logging.getLogger("innboard")


class CachedStaticFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200):
        response = super().file_response(full_path, stat_result, scope, status_code)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


DIST_DIR = Path(BASE_DIR.parent / "frontend" / "dist")


def no_cache_response(path: Path) -> FileResponse:
    """HTML 与 sw.js 需每次向源站校验，避免被 Cloudflare 缓存旧页面。"""
    response = FileResponse(path)
    response.headers["Cache-Control"] = "no-cache"
    return response


def migrate():
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(rooms)"))}
        if "description" not in cols:
            conn.execute(text("ALTER TABLE rooms ADD COLUMN description VARCHAR(200) NOT NULL DEFAULT ''"))
        if "remaining_rooms" not in cols:
            conn.execute(text("ALTER TABLE rooms ADD COLUMN remaining_rooms INTEGER"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    migrate()
    db = SessionLocal()
    try:
        ensure_defaults(db)
        seed_data(db)
        purge_expired_sessions(db)
    finally:
        db.close()

    try:
        run_maintenance()
    except Exception:
        logger.exception("启动维护任务失败，服务继续启动")
    start_maintenance_worker(MAINTENANCE_INTERVAL_HOURS)
    logger.info("服务启动完成（环境: %s）", APP_ENV)
    yield


app = FastAPI(
    title="酒店智能房价牌",
    lifespan=lifespan,
    # 生产环境不暴露接口文档，避免接口结构外泄
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# 所有 API 一律 no-store，禁止任何中间层缓存。
# 历史教训：/api/display 曾用 no-cache+ETag(排除 server_time) 做 304 优化，
# 但 Cloudflare 边缘缓存了完整响应体且 revalidate 恒得 304 → server_time 永不更新，
# 电视端时钟校准被拽回缓存时刻，右上角分钟卡死。故 display 也必须 no-store，每次回源实时生成。
REVALIDATE_PATHS = set()


class NoStoreMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")

        async def send_wrapper(message):
            if message["type"] == "http.response.start" and path.startswith("/api/"):
                value = b"no-cache" if path in REVALIDATE_PATHS else b"no-store"
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() != b"cache-control"]
                headers.append((b"cache-control", value))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


app.add_middleware(NoStoreMiddleware)

if ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.info("已启用跨域访问，允许的来源: %s", ALLOWED_ORIGINS)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(display.router)


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "env": APP_ENV}


app.mount("/uploads", CachedStaticFiles(directory=UPLOAD_DIR), name="uploads")

if DIST_DIR.exists():
    app.mount("/assets", CachedStaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # 必须解析真实路径并校验落在 dist 内，否则 /../../ 可越过目录读取任意文件
        dist_root = DIST_DIR.resolve()
        candidate = (DIST_DIR / full_path).resolve() if full_path else None
        if candidate and candidate.is_file() and candidate.is_relative_to(dist_root):
            return no_cache_response(candidate)
        return no_cache_response(DIST_DIR / "index.html")

else:

    @app.get("/", include_in_schema=False)
    def root():
        return {"message": "后端运行中。前端未构建，请在 frontend 目录执行 npm run build"}
