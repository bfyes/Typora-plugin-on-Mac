# Typora-plugin-on-Mac

> 在 macOS Typora 上运行 obgnail/typora_plugin 的一键安装器。
> One-shot installer for obgnail/typora_plugin on macOS Typora.

## 关键事实 / Key facts

- macOS Typora 使用 **WKWebView**，不是 Electron。没有 `fs`、`path`、`require`、`process`。
  macOS Typora uses **WKWebView**, NOT Electron. Node APIs don't exist.
- `loader.mac.js` 是 11KB 的自包含 polyfill，提供 CommonJS 模块加载和 Node.js shim。
  `loader.mac.js` is a self-contained 11KB polyfill providing CommonJS + Node shims.
- 设置通过 **localStorage** 持久化（WKWebView 沙箱禁止写文件）。
  Settings persisted via **localStorage** (sandbox prevents file writes).
- 对 Typora 的**唯一修改**是在 `index.html` 的 `</body>` 前加一行 `<script>`。
  The ONLY modification to Typora is ONE `<script>` tag before `</body>`.

## 项目结构 / Project structure

```
loader.mac.js    ← Polyfill 适配器 (11KB)
install.sh       ← 一键安装、更新 / Install or update
uninstall.sh     ← 卸载 / Remove everything
CLAUDE.md        ← AI agent 上下文（本文件）
.claude/skills/install.md  ← Claude Code skill
```

## 当用户要求安装时 / When a user asks to install

直接运行 `bash install.sh`。验证清单：
Just run `bash install.sh`. Verification:

1. `/Applications/Typora.app/Contents/Resources/TypeMark/plugin/loader.mac.js` 存在 / exists
2. `index.html` 的 `</body>` 前有 `<script src="./plugin/loader.mac.js" defer>` / has the script tag
3. 用户重启 Typora 后看到绿色 "OK" 闪烁 / green "OK" flash after restart
4. 右下角出现插件面板 / plugin panel in bottom-right
5. 右键有插件菜单项 / right-click shows plugin menu

## 已知限制 / Known limitations

- `updater`、`commander`、`ripgrep` 不工作 / won't work（需要 shell/进程）
- `templater`、`resource_manager` 不能写文件 / can't write files（沙箱/sandbox）
- 设置存在 localStorage 中 / Settings in localStorage（重启不丢失，清 WebView 数据会丢失）

## 适配器原理 / How the adapter works

```
插件期望 (Electron/Node)          适配器提供 (WKWebView)
═══════════════════════════        ═══════════════════════
global.reqnode              →      window.reqnode (XHR + eval)
module.exports              →      new Function() CommonJS
fs.readFile / fs.access     →      XHR (bundle) + localStorage
fs.writeFile                →      localStorage
path.join / path.dirname    →      JS polyfill
process / Buffer            →      window shim
```
