#!/bin/bash
# ==============================================================
# Uninstall obgnail/typora_plugin from macOS Typora v2
# Removes plugin files, bridge, launchd, and restores index.html
# Usage: bash uninstall.sh
# ==============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
TYPORA_APP="/Applications/Typora.app"
INDEX_HTML="$TYPORA_APP/Contents/Resources/TypeMark/index.html"
PLUGIN_DST="$TYPORA_APP/Contents/Resources/TypeMark/plugin"
LAUNCHD_PLIST="$HOME/Library/LaunchAgents/com.typora.plugin-bridge.plist"
BRIDGE_TOKEN_FILE="$HOME/.typora_plugin_bridge_token"
BRIDGE_LOG="$HOME/.typora_plugin_bridge.log"

echo -e "${YELLOW}Uninstalling typora_plugin from macOS Typora...${NC}"
echo ""

# ── Stop and remove Bridge ───────────────────────────────
echo -e "${YELLOW}→${NC} 停止 Bridge / Stopping bridge..."

# Kill any running bridge process
pkill -f "bridge.js" 2>/dev/null && echo -e "  ${GREEN}✓${NC} Bridge process killed" || echo -e "  ${YELLOW}⚠${NC} No bridge process found"

# Unload and remove launchd plist
if [ -f "$LAUNCHD_PLIST" ]; then
    launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
    rm -f "$LAUNCHD_PLIST"
    echo -e "  ${GREEN}✓${NC} launchd plist removed"
else
    echo -e "  ${YELLOW}⚠${NC} No launchd plist found"
fi

# Remove token and log files
rm -f "$BRIDGE_TOKEN_FILE" 2>/dev/null && echo -e "  ${GREEN}✓${NC} Bridge token removed" || true
rm -f "$BRIDGE_LOG" 2>/dev/null && echo -e "  ${GREEN}✓${NC} Bridge log removed" || true
echo ""

# ── Remove plugin files ──────────────────────────────────
echo -e "${YELLOW}→${NC} 删除插件文件 / Removing plugin files..."
if [ -d "$PLUGIN_DST" ]; then
    rm -rf "$PLUGIN_DST"
    echo -e "  ${GREEN}✓${NC} Plugin files removed"
else
    echo -e "  ${YELLOW}⚠${NC} No plugin directory found"
fi

# ── Restore index.html ──────────────────────────────────
echo -e "${YELLOW}→${NC} 恢复 index.html / Restoring index.html..."
if [ -f "$INDEX_HTML.orig" ]; then
    cp "$INDEX_HTML.orig" "$INDEX_HTML"
    echo -e "  ${GREEN}✓${NC} index.html restored from backup"
elif grep -qF "loader.js" "$INDEX_HTML"; then
    sed -i '' '/loader.js/d' "$INDEX_HTML"
    echo -e "  ${GREEN}✓${NC} loader.js removed from index.html"
else
    echo -e "  ${YELLOW}⚠${NC} No loader found in index.html"
fi
echo ""

# ── Clear localStorage ──────────────────────────────────
echo -e "${YELLOW}→${NC} Plugin settings are stored in Typora's localStorage."
echo "  To clear them: open Typora, right-click → Inspect Element,"
echo "  then in the Console tab run: localStorage.clear()"
echo ""

# ── Optionally uninstall ripgrep ─────────────────────────
echo -e "${YELLOW}→${NC} ripgrep (可选 / optional)"
if command -v rg &>/dev/null; then
    if command -v brew &>/dev/null && brew list ripgrep &>/dev/null 2>&1; then
        echo -e "  ripgrep 是本插件通过 brew 安装的依赖（约 6MB）。"
        printf "  是否卸载 ripgrep？/ Uninstall ripgrep? [y/N]: "
        read -r RG_ANSWER
        if [ "$RG_ANSWER" = "y" ] || [ "$RG_ANSWER" = "Y" ]; then
            brew uninstall ripgrep
            echo -e "  ${GREEN}✓${NC} ripgrep 已卸载 / uninstalled"
        else
            echo -e "  ${YELLOW}  ${NC}保留 ripgrep / Kept ripgrep"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} ripgrep 非本脚本安装，跳过 / not installed by this script, skipped"
    fi
else
    echo -e "  ${YELLOW}⚠${NC} ripgrep 未安装 / not installed"
fi
echo ""

echo -e "${GREEN}Uninstall complete.${NC}"
