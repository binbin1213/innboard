from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .database import BASE_DIR, UPLOAD_DIR, Base, SessionLocal, engine
from .routers import admin, auth, display
from .seed import seed_data
from .settings import ensure_defaults


class CachedStaticFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200):
        response = super().file_response(full_path, stat_result, scope, status_code)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


DIST_DIR = Path(BASE_DIR.parent / "frontend" / "dist")


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
    finally:
        db.close()
    yield


app = FastAPI(title="酒店智能房价牌", lifespan=lifespan)

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
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() != b"cache-control"]
                headers.append((b"cache-control", b"no-store"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)



app.add_middleware(NoStoreMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(display.router)

app.mount("/uploads", CachedStaticFiles(directory=UPLOAD_DIR), name="uploads")

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        candidate = DIST_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST_DIR / "index.html")

else:

    @app.get("/", include_in_schema=False)
    def root():
        return {"message": "后端运行中。前端未构建，请在 frontend 目录执行 npm run build"}
