#!/bin/bash
# ==============================================================
# obgnail/typora_plugin macOS Installer
# Usage: bash install.sh
# ==============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
TYPORA_APP="/Applications/Typora.app"
INDEX_HTML="$TYPORA_APP/Contents/Resources/TypeMark/index.html"
PLUGIN_DST="$TYPORA_APP/Contents/Resources/TypeMark/plugin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${GREEN}"
echo "  ______                        ___  __          _"
echo " /_  __/_ _____  ___  _______ _/ _ \\/ /_ _____ _(_)__"
echo "  / / / // / _ \\/ _ \\/ __/ _ \`/ ___/ / // / _ \`/ / _ \\"
echo " /_/  \\_, / .__/\\___/_/  \\_,_/_/  /_/\\_,_/\\_, /_/_//_/"
echo "     /___/_/                             /___/"
echo -e "${NC}"
echo -e "${CYAN}  typora_plugin macOS installer${NC}"
echo ""

# ---- Preflight ----
if [ ! -d "$TYPORA_APP" ]; then
    echo -e "${RED}✗ Typora not found at $TYPORA_APP${NC}"
    echo "  Install from: https://typora.io"
    exit 1
fi
echo -e "${GREEN}✓${NC} Typora $TYPORA_APP"

if pgrep -q Typora; then
    echo -e "${YELLOW}⚠ Typora is running. Please quit it first (Cmd+Q).${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Typora not running"

# ---- Clone / update plugin ----
PLUGIN_REPO="/tmp/typora_plugin"
if [ ! -d "$PLUGIN_REPO/.git" ]; then
    echo -e "${YELLOW}→${NC} Cloning obgnail/typora_plugin..."
    rm -rf "$PLUGIN_REPO"
    git clone --depth 1 https://github.com/obgnail/typora_plugin.git "$PLUGIN_REPO"
else
    echo -e "${YELLOW}→${NC} Updating plugin repo..."
    git -C "$PLUGIN_REPO" pull --depth 1 origin master 2>/dev/null || true
fi
echo -e "${GREEN}✓${NC} Plugin repo ready"

# ---- Install ----
echo -e "${YELLOW}→${NC} Copying plugin files..."
rm -rf "$PLUGIN_DST"
cp -r "$PLUGIN_REPO/plugin" "$PLUGIN_DST"
echo -e "${GREEN}✓${NC} $(find "$PLUGIN_DST" -type f | wc -l | tr -d ' ') files copied"

echo -e "${YELLOW}→${NC} Installing macOS adapter..."
cp "$SCRIPT_DIR/loader.mac.js" "$PLUGIN_DST/loader.mac.js"
echo -e "${GREEN}✓${NC} loader.mac.js installed"

# ---- Backup ----
if [ ! -f "$INDEX_HTML.orig" ]; then
    cp "$INDEX_HTML" "$INDEX_HTML.orig"
    echo -e "${GREEN}✓${NC} Backup: index.html.orig"
else
    echo -e "${GREEN}✓${NC} Backup exists"
fi

# ---- Inject ----
if grep -qF "loader.mac.js" "$INDEX_HTML"; then
    echo -e "${GREEN}✓${NC} Loader already injected"
else
    sed -i '' 's|</body>|<script src="./plugin/loader.mac.js" defer></script></body>|' "$INDEX_HTML"
    echo -e "${GREEN}✓${NC} Loader injected into index.html"
fi

# ---- Done ----
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Install Complete! 🎉${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  Next: open Typora. You should see:"
echo "  • A brief green 'OK' in the top-left"
echo "  • Plugin panel in the bottom-right"
echo "  • Right-click → plugin menu items"
echo ""
echo "  Uninstall : bash uninstall.sh"
echo "  Update    : bash update.sh"
echo ""
