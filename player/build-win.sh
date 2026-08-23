#!/usr/bin/env bash
# 交叉构建 Windows x64 播放器（无需 Wine）
# 原理：直接解压 Electron 官方 win32-x64 发行包，放入应用文件并重命名 exe。
set -euo pipefail
cd "$(dirname "$0")"

ELECTRON_VERSION="22.3.27"
APP_NAME="innboard-player"

# 1) 在 Electron 缓存目录里查找已下载的 win32 包
ZIP=""
for d in "$HOME/Library/Caches/electron"/*/; do
  if [ -f "${d}electron-v${ELECTRON_VERSION}-win32-x64.zip" ]; then
    ZIP="${d}electron-v${ELECTRON_VERSION}-win32-x64.zip"
    break
  fi
done
if [ -z "$ZIP" ]; then
  echo "未找到 electron-v${ELECTRON_VERSION}-win32-x64.zip"
  echo "请先运行：npm install（会触发 electron 下载），或手动下载后放入缓存目录。"
  exit 1
fi
echo "使用 Electron 包：$ZIP"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
unzip -q "$ZIP" -d "$WORK/app"

mkdir -p "$WORK/app/resources/app"
cp main.js control.html emergency.html package.json "$WORK/app/resources/app/"
rm -f "$WORK/app/resources/default_app.asar"
mv "$WORK/app/electron.exe" "$WORK/app/${APP_NAME}.exe"

DEST="dist/${APP_NAME}-win32-x64"
rm -rf "$DEST"
mkdir -p dist
mv "$WORK/app" "$DEST"

ZIPOUT="dist/${APP_NAME}-win32-x64.zip"
rm -f "$ZIPOUT"
(cd dist && zip -qr "${APP_NAME}-win32-x64.zip" "${APP_NAME}-win32-x64")

echo "完成：$DEST"
echo "压缩包：$ZIPOUT"
