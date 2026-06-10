---
name: Typora-plugin-on-Mac-install
description: 在 macOS Typora 上一键安装 obgnail/typora_plugin。Install obgnail/typora_plugin on macOS Typora in one shot.
---

# 在 macOS 上安装 obgnail/typora_plugin / Install on macOS

本 skill 在**不官方支持**的 macOS Typora 上安装完整的 obgnail/typora_plugin。通过 polyfill 适配器（`loader.mac.js`）将 WKWebView 桥接到 Node.js API。

This skill installs obgnail/typora_plugin on macOS Typora (NOT officially supported). It injects a polyfill adapter that bridges WKWebView → Node.js APIs.

## 用法 / Usage

用户说：**"在 Mac 上安装 typora_plugin"** 或调用此 skill。
Say: "Install typora_plugin on my Mac" or invoke this skill.

## 步骤 / Steps

### 1. 检查 / Check
Typora 在 `/Applications/Typora.app`，不运行。/ Typora at `/Applications/Typora.app`, not running.

### 2. 拷贝 / Copy
插件和适配器都已在仓库中，直接复制：
Everything is bundled in this repo — just copy:

```bash
rm -rf "/Applications/Typora.app/Contents/Resources/TypeMark/plugin"
cp -r plugin "/Applications/Typora.app/Contents/Resources/TypeMark/plugin"
cp loader.mac.js "/Applications/Typora.app/Contents/Resources/TypeMark/plugin/loader.mac.js"
```

### 3. 备份 / Backup
```bash
cp "/Applications/Typora.app/Contents/Resources/TypeMark/index.html" \
   "/Applications/Typora.app/Contents/Resources/TypeMark/index.html.orig"
```

### 4. 注入 / Inject
```bash
sed -i '' 's|</body>|<script src="./plugin/loader.mac.js" defer></script></body>|' \
    "/Applications/Typora.app/Contents/Resources/TypeMark/index.html"
```

### 5. 验证 / Verify
- `/Applications/.../plugin/loader.mac.js` 存在 / exists
- `/Applications/.../plugin/global/core/index.js` 存在 / exists
- `index.html` 包含 / contains `loader.mac.js`

### 6. 重启 / Restart
让用户重启 Typora。/ Ask user to restart Typora.

## 原理 / How it works

macOS Typora = WKWebView（非 Electron），没有 Node API。适配器提供 / provides：

| 插件期望 (Electron/Node) | 适配器 (WKWebView) |
|------|------|
| `global.reqnode` | `window.reqnode` (XHR + eval) |
| `module.exports` | `new Function()` CommonJS |
| `fs.readFile` / `access` | XHR (bundle) + localStorage |
| `fs.writeFile` | localStorage |
| `path` | JS polyfill |
| `process` / `Buffer` | `window` shim |

## 限制 / Limitations

- 文件写入走 localStorage / Writes go to localStorage（重启不丢失）
- `updater` / `commander` / `ripgrep` 不工作（需要 shell）
- 用户设置通过插件 UI 修改，自动持久化

## 卸载 / Uninstall
```bash
cp index.html.orig index.html
rm -rf "/Applications/Typora.app/Contents/Resources/TypeMark/plugin"
```
