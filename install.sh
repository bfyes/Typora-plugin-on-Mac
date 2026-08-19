#!/bin/bash
# ==============================================================
# obgnail/typora_plugin macOS 安装器 / Installer v2
# 从官方仓库拉取插件，注入适配器 + Node.js bridge
# Requires Node.js (mandatory).
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

# Bridge settings
BRIDGE_PORT="${BRIDGE_PORT:-45678}"
LAUNCHD_PLIST="$HOME/Library/LaunchAgents/com.typora.plugin-bridge.plist"

echo -e "${GREEN}"
echo "  ______                        ___  __          _"
echo " /_  __/_ _____  ___  _______ _/ _ \\/ /_ _____ _(_)__"
echo "  / / / // / _ \\/ _ \\/ __/ _ \`/ ___/ / // / _\`/ / _ \\"
echo " /_/  \\_, / .__/\\___/_/  \\_,_/_/  /_/\\_,_/\\_, /_/_//_/"
echo "     /___/_/                             /___/"
echo -e "${NC}"
echo -e "${CYAN}  typora_plugin macOS 安装器 / Installer v2${NC}"
echo ""

# ════════════════════════════════════════════════════════
# 检查依赖 / Preflight
# ════════════════════════════════════════════════════════
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

# 检查 App Management 保护 / Check App Management protection
# com.apple.provenance 可能存在但用户仍有写入权限，先做写入测试
if xattr "$TYPORA_APP" 2>/dev/null | grep -q "com.apple.provenance"; then
    # 尝试写入测试文件，能写说明无需处理 / Try writing to check actual permission
    if touch "$TYPORA_APP/Contents/Resources/TypeMark/.prov_test" 2>/dev/null; then
        rm -f "$TYPORA_APP/Contents/Resources/TypeMark/.prov_test" 2>/dev/null
        echo -e "  ${GREEN}✓${NC} 有写入权限 / write access OK (provenance 存在但不影响)"
    else
        echo -e "  ${YELLOW}⚠${NC} com.apple.provenance 导致写入被拒 / write denied"
        echo -e "  ${YELLOW}  ${NC}macOS 会阻止写入 app bundle，导致 "Operation not permitted""
        echo ""
        echo -e "  ${CYAN}是否自动移除该属性？（需要输入密码）/ Auto-fix now?${NC}"
        echo -e "  ${CYAN}将执行 / Will run: sudo xattr -dr com.apple.provenance \"$TYPORA_APP\"${NC}"
        echo ""
        printf "  输入 y 继续，其他键跳过 / y to continue: "
        read -r PROV_ANSWER
        if [ "$PROV_ANSWER" = "y" ] || [ "$PROV_ANSWER" = "Y" ]; then
            sudo xattr -dr com.apple.provenance "$TYPORA_APP"
            if ! touch "$TYPORA_APP/Contents/Resources/TypeMark/.prov_test" 2>/dev/null; then
                echo -e "  ${RED}✗ 仍无法写入 / Still cannot write${NC}"
                echo -e "  ${YELLOW}  ${NC}请手动授权 / Grant permission manually:"
                echo -e "  ${YELLOW}  ${NC}  系统设置 → 隐私与安全性 → 应用管理 → 授权终端"
                exit 1
            fi
            rm -f "$TYPORA_APP/Contents/Resources/TypeMark/.prov_test" 2>/dev/null
            echo -e "  ${GREEN}✓${NC} 已修复 / Fixed"
        else
            echo -e "  ${YELLOW}  ${NC}已跳过。请手动处理 / Skipped:"
            echo -e "  ${YELLOW}  ${NC}  系统设置 → 隐私与安全性 → 应用管理 → 授权终端"
            exit 1
        fi
    fi
else
    echo -e "  ${GREEN}✓${NC} 无 provenance 保护 / no App Management lock"
fi

if ! command -v git &>/dev/null; then
    echo -e "${RED}✗ 需要 git。运行: xcode-select --install${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} git"

if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ 需要 Node.js。安装方法:${NC}"
    echo "    brew install node"
    echo "    或 https://nodejs.org"
    exit 1
fi
NODE_VER=$(node --version 2>/dev/null)
echo -e "  ${GREEN}✓${NC} Node.js $NODE_VER"

# ripgrep（可选，用于全文搜索 / optional, for full-text search）
if ! command -v rg &>/dev/null; then
    echo -e "  ${YELLOW}⚠${NC} 未安装 ripgrep / ripgrep not found"
    if command -v brew &>/dev/null; then
        printf "  是否安装 ripgrep？/ Install ripgrep now? [y/N]: "
        read -r RG_ANSWER
        if [ "$RG_ANSWER" = "y" ] || [ "$RG_ANSWER" = "Y" ]; then
            brew install ripgrep
            echo -e "  ${GREEN}✓${NC} ripgrep 已安装 / installed"
        else
            echo -e "  ${YELLOW}  ${NC}跳过，ripgrep 搜索功能不可用 / Skipped, search disabled"
            echo -e "  ${YELLOW}  ${NC}稍后可手动安装 / Install later: brew install ripgrep"
        fi
    else
        echo -e "  ${YELLOW}  ${NC}无 Homebrew，稍后可手动安装 / No brew, install manually: brew install ripgrep"
    fi
else
    echo -e "  ${GREEN}✓${NC} ripgrep $(rg --version 2>/dev/null | head -1 | awk '{print $2}')"
fi

for f in loader.mac.js plugin-bridge.js; do
    if [ ! -f "$SCRIPT_DIR/$f" ]; then
        echo -e "${RED}✗ 找不到 $f / Not found${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} $f"
done
echo ""

# ════════════════════════════════════════════════════════
# 拉取插件 / Clone plugin
# ════════════════════════════════════════════════════════
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

# ════════════════════════════════════════════════════════
# 安装 / Install
# ════════════════════════════════════════════════════════
echo -e "${YELLOW}→${NC} 安装中 / Installing..."

# 1. 复制插件文件 / Copy plugin
rm -rf "$PLUGIN_DST"
if ! cp -r "$PLUGIN_CLONE/plugin" "$PLUGIN_DST" 2>/tmp/typora_cp.err; then
    echo -e "  ${RED}✗ 复制插件失败 / Failed to copy plugin${NC}"
    cat /tmp/typora_cp.err
    if grep -q "Operation not permitted" /tmp/typora_cp.err 2>/dev/null; then
        echo -e "${YELLOW}→${NC} macOS App Management 保护阻止了写入。"
        echo -e "  ${YELLOW}${NC}运行以下命令后重试 / Run then retry:"
        echo -e "  ${YELLOW}${NC}  sudo xattr -dr com.apple.provenance \"$TYPORA_APP\""
    fi
    exit 1
fi
echo -e "  ${GREEN}✓${NC} 插件文件 / Plugin files ($(find "$PLUGIN_DST" -type f | wc -l | tr -d ' ') files)"

# 2. 复制 adapter 和 bridge / Copy adapter and bridge
pkill -f "plugin-bridge.js" 2>/dev/null || true
sleep 0.5

cp "$SCRIPT_DIR/plugin-bridge.js" "$PLUGIN_DST/plugin-bridge.js"
echo -e "  ${GREEN}✓${NC} plugin-bridge.js"
echo ""

# 3. 设置 launchd 自动启动 / Auto-start via launchd
echo -e "${YELLOW}→${NC} 设置自动启动 / Setting up auto-start..."
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$LAUNCHD_PLIST" << LAUNCHDEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.typora.plugin-bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>$PLUGIN_DST/plugin-bridge.js</string>
        <string>--port</string>
        <string>$BRIDGE_PORT</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/.typora_plugin_bridge.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.typora_plugin_bridge.log</string>
</dict>
</plist>
LAUNCHDEOF
echo -e "  ${GREEN}✓${NC} launchd plist → $LAUNCHD_PLIST"

# 加载 launchd
launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
launchctl load "$LAUNCHD_PLIST" 2>/dev/null
sleep 2

# 获取 bridge token / Get bridge token
BRIDGE_TOKEN=""
for i in 1 2 3; do
    BRIDGE_TOKEN=$(curl -s "http://127.0.0.1:$BRIDGE_PORT/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['token'])" 2>/dev/null || echo "")
    if [ -n "$BRIDGE_TOKEN" ]; then
        echo -e "  ${GREEN}✓${NC} Bridge started, token=${BRIDGE_TOKEN:0:8}..."
        break
    fi
    echo "  Waiting for bridge... (attempt $i)"
    sleep 2
done

if [ -z "$BRIDGE_TOKEN" ]; then
    echo -e "  ${RED}✗${NC} Bridge failed to start. Check ~/.typora_plugin_bridge.log"
    exit 1
fi

# 注入 token 到 loader / Inject token into loader
sed "s|%%BRIDGE_TOKEN%%|$BRIDGE_TOKEN|" "$SCRIPT_DIR/loader.mac.js" > "$PLUGIN_DST/loader.mac.js"
echo -e "  ${GREEN}✓${NC} loader.mac.js (token injected)"
echo ""

# 5. 备份 index.html / Backup
if [ ! -f "$INDEX_HTML.orig" ]; then
    cp "$INDEX_HTML" "$INDEX_HTML.orig"
    echo -e "  ${GREEN}✓${NC} 备份 / Backup: index.html.orig"
else
    echo -e "  ${GREEN}✓${NC} 备份已存在 / Backup exists"
fi

# 6. 注入 / Inject
if grep -qF "loader.mac.js" "$INDEX_HTML"; then
    echo -e "  ${GREEN}✓${NC} 已注入 / Already injected"
else
    sed -i '' 's|</body>|<script src="./plugin/loader.mac.js" defer></script></body>|' "$INDEX_HTML"
    echo -e "  ${GREEN}✓${NC} 已注入 index.html / Injected"
fi
echo ""

# ════════════════════════════════════════════════════════
# 验证 / Verify
# ════════════════════════════════════════════════════════
echo -e "${YELLOW}→${NC} 验证 / Verifying..."
E=0
[ -f "$PLUGIN_DST/loader.mac.js" ]        && echo -e "  ${GREEN}✓${NC} loader.mac.js"       || { echo -e "  ${RED}✗${NC} loader.mac.js"; E=1; }
[ -f "$PLUGIN_DST/plugin-bridge.js" ]     && echo -e "  ${GREEN}✓${NC} plugin-bridge.js"   || { echo -e "  ${RED}✗${NC} plugin-bridge.js"; E=1; }
[ -f "$PLUGIN_DST/global/core/index.js" ] && echo -e "  ${GREEN}✓${NC} plugin core"        || { echo -e "  ${RED}✗${NC} plugin core"; E=1; }
[ -f "$INDEX_HTML.orig" ]                 && echo -e "  ${GREEN}✓${NC} index.html 备份"    || { echo -e "  ${RED}✗${NC} backup"; E=1; }
grep -qF "loader.mac.js" "$INDEX_HTML"    && echo -e "  ${GREEN}✓${NC} loader 已注入"      || { echo -e "  ${RED}✗${NC} 未注入"; E=1; }
[ -f "$LAUNCHD_PLIST" ]                   && echo -e "  ${GREEN}✓${NC} launchd plist"      || { echo -e "  ${RED}✗${NC} launchd plist"; E=1; }
[ $E -eq 1 ] && { echo -e "\n${RED}安装失败 / Failed${NC}"; exit 1; }

# ════════════════════════════════════════════════════════
# 完成 / Done
# ════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  安装完成！/ Done! ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo "  打开 Typora，你应该看到："
echo "  • 左上角蓝色 'OK' 闪烁 / Blue OK flash"
echo "  • 右下角插件面板 / Plugin panel"
echo "  • 右键 → 插件菜单 / Right-click menu"
echo ""
echo -e "  ${CYAN}已启用的功能:${NC}"
echo "  • ripgrep + search_multi 全文搜索 / full-text search"
echo "  • markdownlint 语法检查 / Markdown lint"
echo "  • commander (shell 命令) / shell commands"
echo "  • 文件读写 → 真实文件系统 / real filesystem"
echo "  • updater → 可用 / works"
echo "  • pie_menu 圆盘菜单（Ctrl+右键）需在 preferences 启用"
echo ""
echo "  Bridge 日志: ~/.typora_plugin_bridge.log"
echo "  Bridge 状态: curl http://127.0.0.1:$BRIDGE_PORT/health"
echo ""
echo "  卸载 / Uninstall : bash uninstall.sh"
echo "  更新 / Update    : bash install.sh"
echo ""
