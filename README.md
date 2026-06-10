# typora-plugin-macos

> 在 macOS Typora 上运行 [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin)，一键安装。

## 安装 / Install

```bash
git clone https://github.com/bfyes/typora-plugin-macos.git
cd typora-plugin-macos
bash install.sh
```

重启 Typora。完成。/ Restart Typora. Done.

---

## 这是什么 / What

macOS 版 Typora 使用 **WKWebView**（不是 Electron），没有 Node.js 运行时。`loader.mac.js` 是一个 11KB 的适配层，用 XHR 和 JS 补丁提供了插件需要的 `fs`、`path`、`require`、`process` 等 API。

macOS Typora uses **WKWebView** (NOT Electron). No Node.js, no `require()`, no `fs`. This repo bridges the gap with an 11KB polyfill adapter.

## 脚本 / Scripts

| 脚本 | 用途 |
|------|------|
| `install.sh` | 一键安装、更新 / Install or update |
| `uninstall.sh` | 干净卸载 / Remove everything |

## 原理 / How

`install.sh` 会自动从 [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin) 官方仓库拉取插件，然后注入适配器。不捆绑任何第三方代码。

`install.sh` clones the official plugin repo at install time. No third-party code is bundled.

## 适配层 / The Adapter

```
插件期望 (Electron)               适配器提供 (WKWebView)
══════════════════════════        ══════════════════════════
global.reqnode              →     window.reqnode (XHR + eval)
require / module.exports    →     new Function() CommonJS
fs.readFile / fs.access     →     XHR (bundle) + localStorage
fs.writeFile                →     localStorage 持久化
path.join / path.dirname    →     JS polyfill
process / Buffer            →     window shim
```

## 能用的 / What Works

- ✅ ~40/46 插件（所有核心功能）
- ✅ 标签页、侧边栏增强、图片查看器、搜索、右键菜单
- ✅ 命令面板、暗色模式、图表渲染（markmap/ECharts/DrawIO）
- ✅ **设置持久化** — 通过 localStorage，重启不丢失

## 不能用的 / What Doesn't

- ❌ `updater` / `commander` / `ripgrep` — 需要 shell/进程
- ⚠️ `templater` / `resource_manager` — 无法写文件（沙箱）

## 卸载 / Uninstall

```bash
bash uninstall.sh
```

## 相关 / Related

- [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin)
- [Typora](https://typora.io)

## 许可 / License

MIT — 适配器代码原创。插件归 obgnail/typora_plugin 所有。
