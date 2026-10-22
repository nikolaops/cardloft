#!/bin/zsh
set -euo pipefail

PROJECT_DIR=${0:A:h}
BUILD_DIR="$PROJECT_DIR/build"
APP_NAME="Local Ticketing"
APP_VERSION="1.5.0"
APP_DIR="$BUILD_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
STAGING_DIR="$BUILD_DIR/dmg-staging"
DMG_PATH="$BUILD_DIR/Local-Ticketing-$APP_VERSION.dmg"
SDK_PATH=$(xcrun --sdk macosx --show-sdk-path)

rm -rf "$APP_DIR" "$BUILD_DIR/AppIcon.iconset" "$STAGING_DIR"
rm -f "$BUILD_DIR/Local-Ticketing-1.0.0.dmg" "$BUILD_DIR/Local-Ticketing-1.1.0.dmg" "$BUILD_DIR/Local-Ticketing-1.2.0.dmg" "$BUILD_DIR/Local-Ticketing-1.3.0.dmg" "$BUILD_DIR/Local-Ticketing-1.4.0.dmg" "$DMG_PATH" "$BUILD_DIR/icon-generator" "$BUILD_DIR/AppIcon-1024.png"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR" "$STAGING_DIR"

clang -fobjc-arc \
  -mmacosx-version-min=13.0 \
  -isysroot "$SDK_PATH" \
  -framework Cocoa \
  -framework WebKit \
  "$PROJECT_DIR/Native/main.m" \
  -o "$MACOS_DIR/LocalTicketing"

clang -fobjc-arc \
  -mmacosx-version-min=13.0 \
  -isysroot "$SDK_PATH" \
  -framework Cocoa \
  "$PROJECT_DIR/Native/icon.m" \
  -o "$BUILD_DIR/icon-generator"

"$BUILD_DIR/icon-generator" "$BUILD_DIR/AppIcon-1024.png"
cp "$BUILD_DIR/AppIcon-1024.png" "$RESOURCES_DIR/AppIcon.png"
cp "$PROJECT_DIR/Packaging/Info.plist" "$CONTENTS_DIR/Info.plist"
cp "$PROJECT_DIR/Resources/index.html" "$PROJECT_DIR/Resources/app.css" "$PROJECT_DIR/Resources/app.js" "$RESOURCES_DIR/"

codesign --force --deep --sign - "$APP_DIR"

ditto "$APP_DIR" "$STAGING_DIR/$APP_NAME.app"
ln -s /Applications "$STAGING_DIR/Applications"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

echo "$DMG_PATH"
