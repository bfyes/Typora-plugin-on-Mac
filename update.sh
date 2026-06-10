#!/bin/bash
# ==============================================================
# Update obgnail/typora_plugin on macOS Typora
# Pulls latest plugin from GitHub, keeps your settings.
# Usage: bash update.sh
# ==============================================================
set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
TYPORA_APP="/Applications/Typora.app"
PLUGIN_DST="$TYPORA_APP/Contents/Resources/TypeMark/plugin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_REPO="/tmp/typora_plugin"

echo -e "${YELLOW}Updating typora_plugin...${NC}"

# ---- Check installed ----
if [ ! -f "$PLUGIN_DST/loader.mac.js" ]; then
    echo -e "${RED}✗ Plugin not installed. Run install.sh first.${NC}"
    exit 1
fi

if pgrep -q Typora; then
    echo -e "${RED}✗ Quit Typora first (Cmd+Q).${NC}"
    exit 1
fi

# ---- Pull latest plugin ----
if [ -d "$PLUGIN_REPO/.git" ]; then
    echo -e "${YELLOW}→${NC} Pulling latest plugin..."
    git -C "$PLUGIN_REPO" pull --depth 1 origin master
else
    echo -e "${YELLOW}→${NC} Cloning plugin..."
    git clone --depth 1 https://github.com/obgnail/typora_plugin.git "$PLUGIN_REPO"
fi

# ---- Update plugin files (keep loader and settings) ----
echo -e "${YELLOW}→${NC} Updating plugin files..."
rsync -a --delete --exclude='loader.mac.js' --exclude='global/settings/settings.user.toml' \
    "$PLUGIN_REPO/plugin/" "$PLUGIN_DST/"

# Re-apply the loader (in case it was overwritten)
cp "$SCRIPT_DIR/loader.mac.js" "$PLUGIN_DST/loader.mac.js"

echo -e "${GREEN}✓${NC} Plugin updated!"
echo ""
echo "  Your settings (localStorage) are preserved."
echo "  Restart Typora to use the updated plugins."
echo ""
