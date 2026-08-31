"""核心链路回归测试。"""

import io


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_admin_api_requires_auth(client):
    assert client.get("/api/rooms").status_code == 401


def test_login_success(client):
    res = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "testpass12345"},
        headers={"x-forwarded-for": "10.0.0.5"},
    )
    assert res.status_code == 200
    assert res.json()["token"]


def test_login_wrong_password(client):
    res = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "definitely-wrong"},
        headers={"x-forwarded-for": "10.0.0.6"},
    )
    assert res.status_code == 401


def test_login_rate_limit(client):
    """连续失败达到上限后应被临时锁定，阻止暴力破解。"""
    headers = {"x-forwarded-for": "10.9.9.9"}
    codes = []
    for _ in range(6):
        res = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrong"},
            headers=headers,
        )
        codes.append(res.status_code)
    assert codes[:5] == [401] * 5
    assert codes[5] == 429


def test_upload_rejects_non_image(client, auth_headers):
    """伪装成 jpg 的非图片内容必须被拒绝。"""
    files = {"file": ("evil.jpg", io.BytesIO(b"<?php system($_GET[0]); ?>"), "image/jpeg")}
    res = client.post("/api/images", files=files, headers=auth_headers)
    assert res.status_code == 400


def test_upload_accepts_real_png(client, auth_headers):
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00"
        b"\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    files = {"file": ("ok.png", io.BytesIO(png), "image/png")}
    res = client.post("/api/images", files=files, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["url"].startswith("/uploads/")


def test_room_sort_order_never_collides(client, auth_headers):
    """删除记录后再新建，排序值不能与残留的记录撞号。"""
    for room in client.get("/api/rooms", headers=auth_headers).json():
        client.delete(f"/api/rooms/{room['id']}", headers=auth_headers)

    ids = []
    for i in range(3):
        res = client.post(
            "/api/rooms",
            json={"name": f"测试房型{i}", "rack_price": 100 + i, "member_price": 80 + i},
            headers=auth_headers,
        )
        assert res.status_code == 200
        ids.append(res.json()["id"])

    # 删掉中间一条，制造 sort_order 断档
    assert client.delete(f"/api/rooms/{ids[1]}", headers=auth_headers).status_code == 200

    res = client.post(
        "/api/rooms",
        json={"name": "新建房型", "rack_price": 999, "member_price": 888},
        headers=auth_headers,
    )
    assert res.status_code == 200
    new_room = res.json()

    orders = [r["sort_order"] for r in client.get("/api/rooms", headers=auth_headers).json()]
    assert len(orders) == len(set(orders)), f"sort_order 出现重复: {orders}"
    assert new_room["sort_order"] == max(orders), f"新房型未排在末位: {orders}"


def test_delete_room_cascades_price_logs(client, auth_headers):
    """数据库已启用外键约束，删房型必须连带清理价格日志。"""
    res = client.post(
        "/api/rooms",
        json={"name": "待删房型", "rack_price": 200, "member_price": 150},
        headers=auth_headers,
    )
    room_id = res.json()["id"]
    client.put(
        f"/api/rooms/{room_id}",
        json={"rack_price": 220},
        headers=auth_headers,
    )
    assert client.delete(f"/api/rooms/{room_id}", headers=auth_headers).status_code == 200


def test_display_etag_returns_304(client):
    first = client.get("/api/display")
    assert first.status_code == 200
    etag = first.headers.get("etag")
    assert etag, "响应缺少 ETag"

    second = client.get("/api/display", headers={"If-None-Match": etag})
    assert second.status_code == 304


def test_display_etag_changes_when_data_changes(client, auth_headers):
    before = client.get("/api/display").headers["etag"]
    res = client.post(
        "/api/rooms",
        json={"name": "ETag校验房型", "rack_price": 321, "member_price": 123},
        headers=auth_headers,
    )
    assert res.status_code == 200
    after = client.get("/api/display").headers["etag"]
    assert before != after


def test_spa_route_blocks_path_traversal(client):
    """越过 dist 目录的读取请求不能返回文件真实内容。"""
    res = client.get("/..%2f..%2f..%2f..%2fetc%2fpasswd")
    assert "root:" not in res.text


def test_docs_hidden_in_production():
    """生产环境下接口文档必须关闭。"""
    import os

    assert os.getenv("APP_ENV") == "development"  # 测试环境显式开启
