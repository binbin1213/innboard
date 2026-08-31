"""测试环境准备。

测试必须用独立的临时数据目录，不能污染真实的 data/hotel.db。
环境变量要在导入 app 之前设置，因为数据库引擎在模块导入时就创建。
"""

import os
import shutil
import tempfile
from pathlib import Path

_TMP_ROOT = Path(tempfile.mkdtemp(prefix="innboard-test-"))
os.environ["INNBOARD_DATA_DIR"] = str(_TMP_ROOT / "data")
os.environ["INNBOARD_UPLOAD_DIR"] = str(_TMP_ROOT / "uploads")
os.environ["APP_ENV"] = "development"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Setting  # noqa: E402
from app.settings import hash_password  # noqa: E402

TEST_PASSWORD = "testpass12345"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        # 启动流程会生成随机初始密码，这里覆盖为测试用固定密码
        db = SessionLocal()
        try:
            row = db.get(Setting, "admin_password")
            row.value = f"testsalt:{hash_password(TEST_PASSWORD, 'testsalt')}"
            db.commit()
        finally:
            db.close()
        yield test_client

    shutil.rmtree(_TMP_ROOT, ignore_errors=True)


@pytest.fixture()
def auth_headers(client):
    res = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": TEST_PASSWORD},
        headers={"x-forwarded-for": "10.0.0.1"},
    )
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['token']}"}
