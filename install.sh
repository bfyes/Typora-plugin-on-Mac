#!/bin/bash
# ==============================================================
# obgnail/typora_plugin macOS 安装器 / Installer
# 从官方仓库拉取插件，注入适配器，一键完成
# Clones official plugin repo, injects adapter, done.
# Usage: bash install.sh
# ==============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
TYPORA_APP="/Applications/Typora.app"
INDEX_HTML="$TYPORA_APP/Contents/Resources/TypeMark/index.html"
PLUGIN_DST="$TYPORA_APP/Contents/Resources/TypeMark/plugin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 官方插件仓库 / Official plugin repo
PLUGIN_REPO="https://github.com/obgnail/typora_plugin.git"
PLUGIN_CLONE="/tmp/typora_plugin"

echo -e "${GREEN}"
echo "  ______                        ___  __          _"
echo " /_  __/_ _____  ___  _______ _/ _ \\/ /_ _____ _(_)__"
echo "  / / / // / _ \\/ _ \\/ __/ _ \`/ ___/ / // / _ \`/ / _ \\"
echo " /_/  \\_, / .__/\\___/_/  \\_,_/_/  /_/\\_,_/\\_, /_/_//_/"
echo "     /___/_/                             /___/"
echo -e "${NC}"
echo -e "${CYAN}  typora_plugin macOS 安装器 / Installer${NC}"
echo ""

# ── 检查依赖 / Preflight ────────────────────────────────
echo -e "${YELLOW}→${NC} 检查环境 / Checking..."

if [ ! -d "$TYPORA_APP" ]; then
    echo -e "${RED}✗ 找不到 Typora / Not found: $TYPORA_APP${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Typora.app"

if pgrep -q Typora; then
    echo -e "${RED}✗ Typora 正在运行，请先退出（Cmd+Q）/ Quit Typora first.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Typora 未运行 / not running"

if ! command -v git &>/dev/null; then
    echo -e "${RED}✗ 需要 git。运行: xcode-select --install${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} git"

if [ ! -f "$SCRIPT_DIR/loader.mac.js" ]; then
    echo -e "${RED}✗ 找不到 loader.mac.js / Not found${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} loader.mac.js"
echo ""

# ── 拉取插件 / Clone plugin ──────────────────────────────
echo -e "${YELLOW}→${NC} 拉取 obgnail/typora_plugin ..."
if [ -d "$PLUGIN_CLONE/.git" ]; then
    echo "  已存在，更新中 / Updating..."
    git -C "$PLUGIN_CLONE" pull --depth 1 origin master 2>/dev/null || true
else
    echo "  克隆中 / Cloning..."
    rm -rf "$PLUGIN_CLONE"
    git clone --depth 1 "$PLUGIN_REPO" "$PLUGIN_CLONE"
fi
echo -e "  ${GREEN}✓${NC} 插件就绪 / Plugin ready"

# ── 安装 / Install ───────────────────────────────────────
echo -e "${YELLOW}→${NC} 安装中 / Installing..."

# 1. 复制插件文件 / Copy plugin
rm -rf "$PLUGIN_DST"
cp -r "$PLUGIN_CLONE/plugin" "$PLUGIN_DST"
echo -e "  ${GREEN}✓${NC} 插件文件 / Plugin files ($(find "$PLUGIN_DST" -type f | wc -l | tr -d ' ') files)"

# 2. 注入适配器 / Copy adapter
cp "$SCRIPT_DIR/loader.mac.js" "$PLUGIN_DST/loader.mac.js"
echo -e "  ${GREEN}✓${NC} loader.mac.js"

# 3. 备份 / Backup
if [ ! -f "$INDEX_HTML.orig" ]; then
    cp "$INDEX_HTML" "$INDEX_HTML.orig"
    echo -e "  ${GREEN}✓${NC} 备份 / Backup: index.html.orig"
else
    echo -e "  ${GREEN}✓${NC} 备份已存在 / Backup exists"
fi

# 4. 注入 / Inject
if grep -qF "loader.mac.js" "$INDEX_HTML"; then
    echo -e "  ${GREEN}✓${NC} 已注入 / Already injected"
else
    sed -i '' 's|</body>|<script src="./plugin/loader.mac.js" defer></script></body>|' "$INDEX_HTML"
    echo -e "  ${GREEN}✓${NC} 已注入 index.html / Injected"
fi
echo ""

# ── 验证 / Verify ────────────────────────────────────────
echo -e "${YELLOW}→${NC} 验证 / Verifying..."
E=0
[ -f "$PLUGIN_DST/loader.mac.js" ]        && echo -e "  ${GREEN}✓${NC} loader.mac.js"        || { echo -e "  ${RED}✗${NC} loader.mac.js"; E=1; }
[ -f "$PLUGIN_DST/global/core/index.js" ] && echo -e "  ${GREEN}✓${NC} plugin core"          || { echo -e "  ${RED}✗${NC} plugin core"; E=1; }
[ -f "$INDEX_HTML.orig" ]                 && echo -e "  ${GREEN}✓${NC} index.html 备份"      || { echo -e "  ${RED}✗${NC} backup"; E=1; }
grep -qF "loader.mac.js" "$INDEX_HTML"    && echo -e "  ${GREEN}✓${NC} loader 已注入"        || { echo -e "  ${RED}✗${NC} 未注入"; E=1; }
[ $E -eq 1 ] && { echo -e "\n${RED}安装失败 / Failed${NC}"; exit 1; }

# ── 完成 / Done ──────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  安装完成！/ Done! 🎉${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  打开 Typora，你应该看到："
echo "  • 左上角绿色 'OK' 闪烁 / Green OK flash"
echo "  • 右下角插件面板 / Plugin panel"
echo "  • 右键 → 插件菜单 / Right-click menu"
echo ""
echo "  卸载 / Uninstall : bash uninstall.sh"
echo "  更新 / Update    : bash install.sh  (重新跑一次)"
echo ""
