#!/bin/bash
# ==============================================================
# Update obgnail/typora_plugin on macOS (self-contained)
# Usage: bash update.sh
#
# Re-copies plugin files from this repo. Settings are preserved.
# To get the latest plugin: git pull && bash update.sh
# ==============================================================
set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
TYPORA_APP="/Applications/Typora.app"
PLUGIN_DST="$TYPORA_APP/Contents/Resources/TypeMark/plugin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${YELLOW}Updating typora_plugin...${NC}"

[ -f "$PLUGIN_DST/loader.mac.js" ] || { echo -e "${RED}✗ 未安装. Run install.sh first.${NC}"; exit 1; }
pgrep -q Typora && { echo -e "${RED}✗ Quit Typora first (Cmd+Q).${NC}"; exit 1; }

# Re-copy from bundled plugin/ (preserve user settings file)
echo -e "${YELLOW}→${NC} Updating files..."
rsync -a --delete \
    --exclude='loader.mac.js' \
    --exclude='global/settings/settings.user.toml' \
    "$SCRIPT_DIR/plugin/" "$PLUGIN_DST/"
cp "$SCRIPT_DIR/loader.mac.js" "$PLUGIN_DST/loader.mac.js"

echo -e "${GREEN}✓${NC} Updated ($(find "$PLUGIN_DST" -type f | wc -l | tr -d ' ') files)"
echo ""
echo "  Settings preserved (localStorage)."
echo "  Restart Typora."
echo ""
