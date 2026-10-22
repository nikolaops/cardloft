#!/bin/zsh
set -euo pipefail

PROJECT_DIR=${0:A:h:h}
APP_NAME="Cardloft"
APP_VERSION=$(<"$PROJECT_DIR/VERSION")
BUILD_DIR="$PROJECT_DIR/build/macos"
DIST_DIR="$PROJECT_DIR/build/dist"
APP_DIR="$BUILD_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
STAGING_DIR="$BUILD_DIR/dmg-staging"
DMG_PATH="$DIST_DIR/$APP_NAME-$APP_VERSION-macos.dmg"
SDK_PATH=$(xcrun --sdk macosx --show-sdk-path)

rm -rf "$BUILD_DIR" "$DMG_PATH"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR" "$STAGING_DIR" "$DIST_DIR"

[[ -f "$PROJECT_DIR/build/icon/AppIcon-1024.png" ]] || "$PROJECT_DIR/scripts/build-icon.sh"

# Universal binary so the app runs on both Apple silicon and Intel Macs.
clang -fobjc-arc \
  -arch arm64 -arch x86_64 \
  -mmacosx-version-min=13.0 \
  -isysroot "$SDK_PATH" \
  -framework Cocoa \
  -framework WebKit \
  "$PROJECT_DIR/macos/main.m" \
  -o "$MACOS_DIR/$APP_NAME"

cp "$PROJECT_DIR/build/icon/AppIcon-1024.png" "$RESOURCES_DIR/AppIcon.png"
cp "$PROJECT_DIR/macos/Info.plist" "$CONTENTS_DIR/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $APP_VERSION" "$CONTENTS_DIR/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $APP_VERSION" "$CONTENTS_DIR/Info.plist"
cp "$PROJECT_DIR"/web/{index.html,app.css,app.js} "$RESOURCES_DIR/"

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
