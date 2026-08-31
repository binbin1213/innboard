"""上传文件校验。

只检查扩展名是不可靠的：攻击者可以把任意内容改名成 .jpg 上传。
这里按文件头字节（magic bytes）确认真实类型。
"""

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# 文件头 -> 扩展名；值为 None 表示需要额外校验
_SIGNATURES: list[tuple[bytes, str | None]] = [
    (b"\xff\xd8\xff", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"GIF87a", ".gif"),
    (b"GIF89a", ".gif"),
    (b"RIFF", None),  # WebP 需再确认第 8-12 字节为 WEBP
]


def sniff_image_ext(data: bytes) -> str | None:
    """根据实际内容判断图片类型，返回规范扩展名，无法识别时返回 None。"""
    if not data:
        return None
    for prefix, ext in _SIGNATURES:
        if not data.startswith(prefix):
            continue
        if ext is not None:
            return ext
        if prefix == b"RIFF" and len(data) >= 12 and data[8:12] == b"WEBP":
            return ".webp"
    return None


def validate_image(data: bytes, declared_ext: str) -> str:
    """校验上传内容确为受支持的图片。

    返回真实扩展名（可能与声明的扩展名不同，以真实类型为准，
    避免把伪装成 .jpg 的文件按 .jpg 存盘）。
    """
    if declared_ext.lower() not in ALLOWED_EXT:
        raise ValueError("仅支持 jpg/png/webp/gif 图片")
    actual = sniff_image_ext(data)
    if actual is None:
        raise ValueError("文件内容不是有效的图片")
    return actual
