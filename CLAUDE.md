# Typora-plugin-on-Mac

> 在 macOS Typora 上运行 obgnail/typora_plugin 的一键安装器。
> One-shot installer for obgnail/typora_plugin on macOS Typora.

## 关键事实

- macOS Typora 用 WKWebView（不是 Electron），没有 Node.js API。
- `loader.mac.js` 通过 HTTP 调用本地 Node.js bridge (`plugin-bridge.js`, 端口 45678)。
- **Node.js 必须安装**。Bridge 通过 launchd 开机自启。
- 对 Typora 的唯一修改：index.html `</body>` 前加一行 `<script>`。
- install.sh 通过 `sed` 将 bridge token 注入 loader.mac.js，避免 WKWebView 跨域检测。
- 插件加载不设延迟——fence_enhance 等需要在 load 事件中立即初始化以捕获 CodeMirror 事件。
- JSON 文件用 `JSON.parse()` 而非 `new Function()` 加载。
- Worker 被拦截为假对象，markdownlint 主线程执行（但语法检查仍不可用）。

## 项目结构

```
loader.mac.js     ← WKWebView 适配器 (~720 行)
plugin-bridge.js  ← Node.js 后端 (~509 行)
install.sh        ← 安装脚本
uninstall.sh      ← 卸载脚本
```

## 架构

```
Typora WKWebView ←→ loader.mac.js ←HTTP :45678→ plugin-bridge.js (Node.js)
                                  ←XHR bundle→ plugin files (app bundle)
```

## 安装验证

1. `plugin/loader.mac.js` 存在（含 token）
2. `plugin/plugin-bridge.js` 存在
3. `curl http://127.0.0.1:45678/health` 返回 OK
4. 重启 Typora，插件面板出现在右下角

## 已知限制

- markdownlint 语法检查不可用（库加载兼容性）
- 右键菜单与 macOS 原生菜单并存

## 文件修改历史

```
loader.mac.js:    JSON require fix, bridge token embed, Worker→main-thread linter,
                  tab bar CSS fix, footer CSS fix, 0-delay plugin loading
plugin-bridge.js: fs/child_process/os/zlib/crypto API, CORS *, token auth
install.sh:       Node.js check, bridge deploy, launchd plist, token injection
```
