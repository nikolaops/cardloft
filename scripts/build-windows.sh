#!/bin/zsh
# Cross-builds the Windows app from macOS with the .NET SDK and packages a portable zip.
set -euo pipefail

PROJECT_DIR=${0:A:h:h}
APP_NAME="Cardloft"
APP_VERSION=$(<"$PROJECT_DIR/VERSION")
BUILD_DIR="$PROJECT_DIR/build/windows"
DIST_DIR="$PROJECT_DIR/build/dist"
APP_DIR="$BUILD_DIR/$APP_NAME"
ZIP_PATH="$DIST_DIR/$APP_NAME-$APP_VERSION-windows.zip"

rm -rf "$BUILD_DIR" "$ZIP_PATH"
mkdir -p "$APP_DIR/resources" "$DIST_DIR"

[[ -f "$PROJECT_DIR/build/icon/AppIcon.ico" ]] || "$PROJECT_DIR/scripts/build-icon.sh"

dotnet publish "$PROJECT_DIR/windows/Cardloft.csproj" \
  --configuration Release \
  --nologo \
  -p:Version="$APP_VERSION" \
  -p:ApplicationIcon="$PROJECT_DIR/build/icon/AppIcon.ico" \
  --output "$APP_DIR"

cp "$PROJECT_DIR"/web/{index.html,app.css,app.js} "$APP_DIR/resources/"
rm -f "$APP_DIR/Microsoft.Web.WebView2.Wpf.dll"

(cd "$BUILD_DIR" && zip -qr "$ZIP_PATH" "$APP_NAME")

echo "$ZIP_PATH"
