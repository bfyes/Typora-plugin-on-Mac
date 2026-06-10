#!/bin/bash
# ==============================================================
# obgnail/typora_plugin macOS Installer
#
# Usage: bash install.sh
#
# What it does:
# 1. Clones typora_plugin (if not already cloned)
# 2. Copies plugin files into Typora.app bundle
# 3. Injects loader.mac.js adapter into index.html
# 4. Backs up original index.html
# ==============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
echo ""
echo "  typora_plugin macOS installer"
echo -e "${NC}"

# ---- Check Typora exists ----
if [ ! -d "$TYPORA_APP" ]; then
    echo -e "${RED}ERROR: Typora not found at $TYPORA_APP${NC}"
    echo "Please install Typora from https://typora.io"
    exit 1
fi
echo -e "${GREEN}✓${NC} Typora found at $TYPORA_APP"

# ---- Clone plugin repo (if needed) ----
PLUGIN_REPO="/tmp/typora_plugin"
if [ ! -d "$PLUGIN_REPO" ]; then
    echo -e "${YELLOW}→${NC} Cloning obgnail/typora_plugin..."
    git clone --depth 1 https://github.com/obgnail/typora_plugin.git "$PLUGIN_REPO" 2>/dev/null || {
        echo -e "${RED}ERROR: Failed to clone typora_plugin${NC}"
        exit 1
    }
fi
echo -e "${GREEN}✓${NC} Plugin repo ready"

# ---- Copy plugin files ----
echo -e "${YELLOW}→${NC} Copying plugin files..."
rm -rf "$PLUGIN_DST"
cp -r "$PLUGIN_REPO/plugin" "$PLUGIN_DST"
echo -e "${GREEN}✓${NC} Plugin files copied"

# ---- Copy loader adapter ----
echo -e "${YELLOW}→${NC} Installing macOS adapter..."
cp "$SCRIPT_DIR/loader.mac.js" "$PLUGIN_DST/loader.mac.js"
echo -e "${GREEN}✓${NC} loader.mac.js installed"

# ---- Backup index.html ----
if [ ! -f "$INDEX_HTML.orig" ]; then
    cp "$INDEX_HTML" "$INDEX_HTML.orig"
    echo -e "${GREEN}✓${NC} Backup created: index.html.orig"
else
    echo -e "${GREEN}✓${NC} Backup already exists"
fi

# ---- Inject loader script ----
SCRIPT_TAG='<script src="./plugin/loader.mac.js" defer></script></body>'

if grep -qF "loader.mac.js" "$INDEX_HTML"; then
    echo -e "${GREEN}✓${NC} Loader already injected"
else
    echo -e "${YELLOW}→${NC} Injecting loader into index.html..."
    sed -i '' "s|</body>|${SCRIPT_TAG}|" "$INDEX_HTML"
    echo -e "${GREEN}✓${NC} Loader injected"
fi

# ---- Verify ----
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation Complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Please restart Typora to activate plugins."
echo ""
echo "  Verification: after restart, you should see:"
echo "  - A brief green 'OK' flash in the top-left corner"
echo "  - Plugin panel in the bottom-right corner"
echo "  - Right-click → plugin menu items"
echo ""
echo "  To uninstall:"
echo "    cp \"$INDEX_HTML.orig\" \"$INDEX_HTML\""
echo "    rm -rf \"$PLUGIN_DST\""
echo ""
