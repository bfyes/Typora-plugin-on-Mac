#!/bin/bash
# ==============================================================
# obgnail/typora_plugin macOS Installer (self-contained)
# Usage: bash install.sh
#
# Zero external dependencies — everything is bundled.
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
echo -e "${CYAN}  typora_plugin macOS installer (self-contained)${NC}"
echo ""

# ── Preflight ──────────────────────────────────────────
echo -e "${YELLOW}→${NC} Checking..."

if [ ! -d "$TYPORA_APP" ]; then
    echo -e "${RED}✗ Typora not found at $TYPORA_APP${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Typora.app"

if pgrep -q Typora; then
    echo -e "${RED}✗ Typora is running. Quit it (Cmd+Q) first.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Typora not running"

if [ ! -f "$SCRIPT_DIR/loader.mac.js" ]; then
    echo -e "${RED}✗ loader.mac.js not found in $SCRIPT_DIR${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} loader.mac.js"

if [ ! -d "$SCRIPT_DIR/plugin" ]; then
    echo -e "${RED}✗ plugin/ not found in $SCRIPT_DIR${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} plugin/ ($(find "$SCRIPT_DIR/plugin" -type f | wc -l | tr -d ' ') files)"
echo ""

# ── Install ────────────────────────────────────────────
echo -e "${YELLOW}→${NC} Installing..."

# 1. Copy plugin files
rm -rf "$PLUGIN_DST"
cp -r "$SCRIPT_DIR/plugin" "$PLUGIN_DST"
echo -e "  ${GREEN}✓${NC} Plugin files copied"

# 2. Copy adapter
cp "$SCRIPT_DIR/loader.mac.js" "$PLUGIN_DST/loader.mac.js"
echo -e "  ${GREEN}✓${NC} loader.mac.js installed"

# 3. Backup
if [ ! -f "$INDEX_HTML.orig" ]; then
    cp "$INDEX_HTML" "$INDEX_HTML.orig"
    echo -e "  ${GREEN}✓${NC} Backup: index.html.orig"
else
    echo -e "  ${GREEN}✓${NC} Backup exists"
fi

# 4. Inject
if grep -qF "loader.mac.js" "$INDEX_HTML"; then
    echo -e "  ${GREEN}✓${NC} Loader already injected"
else
    sed -i '' 's|</body>|<script src="./plugin/loader.mac.js" defer></script></body>|' "$INDEX_HTML"
    echo -e "  ${GREEN}✓${NC} Loader injected into index.html"
fi
echo ""

# ── Verify ─────────────────────────────────────────────
echo -e "${YELLOW}→${NC} Verifying..."
E=0
[ -f "$PLUGIN_DST/loader.mac.js" ]        && echo -e "  ${GREEN}✓${NC} loader.mac.js"        || { echo -e "  ${RED}✗${NC} loader.mac.js MISSING"; E=1; }
[ -f "$PLUGIN_DST/global/core/index.js" ] && echo -e "  ${GREEN}✓${NC} plugin core"          || { echo -e "  ${RED}✗${NC} plugin core MISSING"; E=1; }
[ -f "$INDEX_HTML.orig" ]                 && echo -e "  ${GREEN}✓${NC} index.html backup"     || { echo -e "  ${RED}✗${NC} index.html backup MISSING"; E=1; }
grep -qF "loader.mac.js" "$INDEX_HTML"    && echo -e "  ${GREEN}✓${NC} loader injected"       || { echo -e "  ${RED}✗${NC} loader NOT injected"; E=1; }
if [ $E -eq 1 ]; then echo -e "\n${RED}Installation failed.${NC}"; exit 1; fi

# ── Done ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Done! 🎉${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  Open Typora. You should see:"
echo "  • Green 'OK' flash in the corner"
echo "  • Plugin panel at bottom-right"
echo "  • Right-click → plugin menu"
echo ""
echo "  Uninstall : bash uninstall.sh"
echo "  Update    : bash update.sh"
echo ""
