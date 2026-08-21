# Typora-plugin-on-Mac 日志

> 在 macOS Typora 上运行 obgnail/typora_plugin 的一键安装器。
> One-shot installer for obgnail/typora_plugin on macOS Typora.

本文档记录项目结构、适配决策和已知限制，作为后续维护日志。

## 关键事实

- macOS Typora 用 WKWebView（不是 Electron），没有 Node.js API。
- `loader.js` 通过 HTTP 调用本地 Node.js bridge (`bridge.js`, 端口 45678)。
- **Node.js 必须安装**。Bridge 通过 launchd 开机自启。
- 对 Typora 的唯一修改：index.html `</body>` 前加一行 `<script>`。
- install.sh 通过 `sed` 将 bridge token 注入 loader.js，避免 WKWebView 跨域检测。
- 插件加载不设延迟——fence_enhance 等需要在 load 事件中立即初始化以捕获 CodeMirror 事件。
- JSON 文件用 `JSON.parse()` 而非 `new Function()` 加载。
- markdownlint 的 Worker 在 WKWebView 中改为主线程 polyfill 执行。
- `reqnode("zlib")` 和 `reqnode("stream")` 提供 PlantUML 在线渲染所需的压缩与 `Readable.from` 能力。

## 项目结构

```
loader.js     ← WKWebView 适配器（模块加载、必要 polyfill）
bridge.js  ← Node.js RPC 路由与认证
network.js ← Node 原生 fetch 与二进制响应适配
install.sh        ← 安装脚本
uninstall.sh      ← 卸载脚本
```

## 架构

```
Typora WKWebView ←→ loader.js ←HTTP :45678→ bridge.js (Node.js)
                                  ←XHR bundle→ plugin files (app bundle)
```

## 安装验证

1. `plugin/loader.js` 存在（含 token）
2. `plugin/bridge.js` 存在
3. `curl http://127.0.0.1:45678/health` 返回 OK
4. 重启 Typora，插件面板出现在右下角

## 已知限制

- markdownlint 语法检查不可用（库加载兼容性）
- Typora 的 `contextMenu.setItems` 仅支持内置动作 ID；没有公开 API 可注册插件自定义菜单、子菜单或回调。因此保留原生 `NSMenu`，不安装 DOM 右键适配层。

## 文件修改历史

```
loader.js:    JSON require fix, bridge token embed, Worker→main-thread linter,
                  tab bar CSS fix, footer CSS fix, 0-delay plugin loading
bridge.js: fs/child_process/os/zlib/crypto API, CORS *, token auth
install.sh:       Node.js check, bridge deploy, launchd plist, token injection
```

## 2026-08-21

- 确认 Typora macOS 通过 `contextMenu.setItems` 使用原生 `NSMenu`。
- 移除不可靠的 DOM 多级右键菜单适配层，恢复 Typora 原生右键菜单。
- 保留 Node bridge、PlantUML 网络渲染和 CommonJS 兼容层。
- `test.md` 中的 ECharts/Chart.js 示例使用插件要求的 `option =` / `config =` 赋值格式；DrawIO 使用 `{ xml: ... }` 配置格式。
- 关闭 `auto_number.ENABLE_CONTENT`，避免正文 H2 自动编号。
- Markmap 因 CDN 资源在 WKWebView 中持续抛出 `[object Response]`，暂时禁用，不再继续增加适配补丁。
