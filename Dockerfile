# ---- 阶段 1：构建前端静态资源 ----
FROM node:20-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 阶段 2：运行后端（同时托管 API 与前端静态文件） ----
FROM python:3.12-slim
ENV TZ=Asia/Shanghai \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/backend

# tzdata 用于容器内时区，确保展示页时间准确
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=build /app/frontend/dist /app/frontend/dist

RUN mkdir -p data uploads
VOLUME ["/app/backend/data", "/app/backend/uploads"]
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
