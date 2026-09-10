#!/usr/bin/env bash
# Rocktier Markdown — DMG 打包脚本
# 依赖: create-dmg (brew install create-dmg)
# 用法: ./scripts/package-dmg.sh

set -euo pipefail

APP_NAME="Rocktier Markdown"
WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
APP_BUNDLE="$WORKSPACE/src-tauri/target/release/bundle/macos/$APP_NAME.app"
ICON="$APP_BUNDLE/Contents/Resources/icon.icns"

# 版本号取自 tauri.conf.json，架构自动识别 — 多版本互不覆盖
VERSION="$(/usr/bin/sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$WORKSPACE/src-tauri/tauri.conf.json" | head -1)"
ARCH="$(uname -m)"
[[ "$ARCH" == "arm64" ]] && ARCH="aarch64"
DMG_NAME="${APP_NAME}_${VERSION}_${ARCH}.dmg"

# 打包产物统一只放下载文件夹（用完即删，不在项目内留冗余）
OUTPUT_DMG="$HOME/Downloads/$DMG_NAME"

if ! command -v create-dmg &>/dev/null; then
  echo "❌ 未找到 create-dmg，请 brew install create-dmg"
  exit 1
fi

echo "==> Step 1: 构建 release app（tauri build 会先执行 npm run build）..."
cd "$WORKSPACE"
npm run tauri:build

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "❌ 构建失败: 找不到 $APP_BUNDLE"
  exit 1
fi

echo "==> Step 2: 打包 DMG..."
rm -f "$OUTPUT_DMG"
SRC_DIR="$(mktemp -d)"
cp -R "$APP_BUNDLE" "$SRC_DIR/"

create-dmg \
  --volname "$APP_NAME" \
  --volicon "$ICON" \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "$APP_NAME.app" 200 200 \
  --app-drop-link 600 200 \
  --format UDZO \
  "$OUTPUT_DMG" \
  "$SRC_DIR"

rm -rf "$SRC_DIR"

echo "==> 完成 ✓"
echo "  DMG 位置: $OUTPUT_DMG"
ls -lh "$OUTPUT_DMG"
