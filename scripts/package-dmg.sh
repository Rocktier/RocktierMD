#!/usr/bin/env bash
# Rocktier Markdown — DMG 打包脚本
# 依赖: create-dmg (brew install create-dmg)
# 用法: ./scripts/package-dmg.sh

set -euo pipefail

APP_NAME="Rocktier Markdown"
DMG_NAME="Rocktier Markdown_0.1.0_aarch64.dmg"
WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
APP_BUNDLE="$WORKSPACE/src-tauri/target/release/bundle/macos/$APP_NAME.app"
ICON="$APP_BUNDLE/Contents/Resources/icon.icns"
OUTPUT_DMG="$WORKSPACE/$DMG_NAME"

if ! command -v create-dmg &>/dev/null; then
  echo "❌ 未找到 create-dmg，请 brew install create-dmg"
  exit 1
fi

echo "==> Step 1: 构建 release app..."
cd "$WORKSPACE"
npm run build
cd "$WORKSPACE/src-tauri"
 cargo tauri build

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
