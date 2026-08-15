import threading
from datetime import datetime, timedelta

import httpx

QF_GEO_URL = "https://geoapi.qweather.com/v2/city/lookup"
QF_NOW_URL = "https://devapi.qweather.com/v7/weather/now"
OM_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"
OM_NOW_URL = "https://api.open-meteo.com/v1/forecast"

CACHE_TTL = timedelta(minutes=30)

_lock = threading.Lock()
_cache = {"key": None, "data": None, "at": None}

OM_TEXT = {
    0: "晴", 1: "晴间多云", 2: "多云", 3: "阴", 45: "雾", 48: "雾凇",
    51: "毛毛雨", 53: "小雨", 55: "中雨", 61: "小雨", 63: "中雨", 65: "大雨",
    66: "冻雨", 67: "冻雨", 71: "小雪", 73: "中雪", 75: "大雪", 77: "雪粒",
    80: "阵雨", 81: "阵雨", 82: "强阵雨", 85: "阵雪", 86: "阵雪",
    95: "雷阵雨", 96: "雷阵雨伴冰雹", 99: "雷阵雨伴冰雹",
}


def _qf_cat(text: str) -> str:
    if "雷" in text:
        return "storm"
    if "雪" in text:
        return "snow"
    if "雨" in text:
        return "rain"
    if "雾" in text or "霾" in text or "沙" in text:
        return "fog"
    if "晴" in text:
        return "sunny"
    if "阴" in text:
        return "overcast"
    if "云" in text:
        return "cloudy"
    return "cloudy"


def _om_cat(code: int) -> str:
    if code == 0:
        return "sunny"
    if code in (1, 2):
        return "cloudy"
    if code == 3:
        return "overcast"
    if 45 <= code <= 48:
        return "fog"
    if 51 <= code <= 67 or 80 <= code <= 82:
        return "rain"
    if 71 <= code <= 77 or 85 <= code <= 86:
        return "snow"
    if 95 <= code <= 99:
        return "storm"
    return "cloudy"


def get_weather(api_key: str, city: str):
    if not city:
        return None
    cache_key = f"{api_key}:{city}"
    with _lock:
        if _cache["key"] == cache_key and _cache["at"] and datetime.now() - _cache["at"] < CACHE_TTL:
            return _cache["data"]

    result = _fetch_qweather(api_key, city) if api_key else _fetch_open_meteo(city)
    if result:
        with _lock:
            _cache["key"] = cache_key
            _cache["data"] = result
            _cache["at"] = datetime.now()
        return result

    with _lock:
        if _cache["key"] == cache_key:
            return _cache["data"]
    return None


def _fetch_qweather(api_key: str, city: str):
    try:
        geo = httpx.get(QF_GEO_URL, params={"location": city, "key": api_key}, timeout=10).json()
        if geo.get("code") != "200" or not geo.get("location"):
            return None
        location_id = geo["location"][0]["id"]
        now = httpx.get(QF_NOW_URL, params={"location": location_id, "key": api_key}, timeout=10).json()
        if now.get("code") != "200":
            return None
        text = now["now"]["text"]
        return {"temp": now["now"]["temp"], "text": text, "cat": _qf_cat(text)}
    except Exception:
        return None


def _fetch_open_meteo(city: str):
    try:
        geo = httpx.get(
            OM_GEO_URL,
            params={"name": city, "count": 1, "language": "zh"},
            timeout=10,
        ).json()
        results = geo.get("results")
        if not results:
            return None
        lat, lon = results[0]["latitude"], results[0]["longitude"]
        now = httpx.get(
            OM_NOW_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,weather_code",
                "timezone": "auto",
            },
            timeout=10,
        ).json()
        current = now.get("current")
        if not current:
            return None
        code = current["weather_code"]
        return {
            "temp": str(round(current["temperature_2m"])),
            "text": OM_TEXT.get(code, "多云"),
            "cat": _om_cat(code),
        }
    except Exception:
        return None
