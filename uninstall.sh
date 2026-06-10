#!/bin/bash
# ==============================================================
# Uninstall obgnail/typora_plugin from macOS Typora
# Usage: bash uninstall.sh
# ==============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
TYPORA_APP="/Applications/Typora.app"
INDEX_HTML="$TYPORA_APP/Contents/Resources/TypeMark/index.html"
PLUGIN_DST="$TYPORA_APP/Contents/Resources/TypeMark/plugin"

echo -e "${YELLOW}Uninstalling typora_plugin from macOS Typora...${NC}"
echo ""

# ---- Remove plugin files ----
if [ -d "$PLUGIN_DST" ]; then
    rm -rf "$PLUGIN_DST"
    echo -e "${GREEN}✓${NC} Plugin files removed"
else
    echo -e "${YELLOW}⚠${NC} No plugin directory found"
fi

# ---- Restore index.html ----
if [ -f "$INDEX_HTML.orig" ]; then
    cp "$INDEX_HTML.orig" "$INDEX_HTML"
    echo -e "${GREEN}✓${NC} index.html restored from backup"
elif grep -qF "loader.mac.js" "$INDEX_HTML"; then
    sed -i '' '/loader.mac.js/d' "$INDEX_HTML"
    echo -e "${GREEN}✓${NC} loader.mac.js removed from index.html"
else
    echo -e "${YELLOW}⚠${NC} No loader found in index.html"
fi

# ---- Clear localStorage settings ----
echo -e "${YELLOW}→${NC} Plugin settings are stored in Typora's localStorage."
echo "  To clear them: open Typora, right-click → Inspect Element,"
echo "  then in the Console tab run: localStorage.clear()"
echo ""

echo -e "${GREEN}Uninstall complete.${NC}"
