#!/bin/zsh
# Renders the app icon from macos/icon.m and derives the Windows .ico from it.
set -euo pipefail

PROJECT_DIR=${0:A:h:h}
ICON_DIR="$PROJECT_DIR/build/icon"
SDK_PATH=$(xcrun --sdk macosx --show-sdk-path)

rm -rf "$ICON_DIR"
mkdir -p "$ICON_DIR/sizes"

clang -fobjc-arc \
  -mmacosx-version-min=13.0 \
  -isysroot "$SDK_PATH" \
  -framework Cocoa \
  "$PROJECT_DIR/macos/icon.m" \
  -o "$ICON_DIR/icon-generator"

"$ICON_DIR/icon-generator" "$ICON_DIR/AppIcon-1024.png"

for size in 16 24 32 48 64 128 256; do
  sips -z $size $size "$ICON_DIR/AppIcon-1024.png" --out "$ICON_DIR/sizes/$size.png" >/dev/null
done
python3 -I "$PROJECT_DIR/scripts/png2ico.py" "$ICON_DIR/AppIcon.ico" "$ICON_DIR"/sizes/*.png
