# Typora-plugin-on-Mac

> 在 macOS Typora 上运行 [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin)。
>
> ⚠️ **本项目是 Windows/Linux 插件的非官方 macOS 移植。**
> 部分功能不可用。

![screenshot1](https://github.com/bfyes/Typora-plugin-on-Mac/blob/main/README.assets/1Capture%202026-06-11%2012.11.05.png?raw=true)

![screenshot2](https://github.com/bfyes/Typora-plugin-on-Mac/blob/main/README.assets/1Capture%202026-06-11%2012.11.09.png?raw=true)

### 全文搜索 / Full-text Search

![search](https://github.com/user-attachments/assets/4dc13c7a-bedd-468d-9323-8dc8019639d5)

### 语法检查 / Markdown Lint

![markdownlint](https://github.com/user-attachments/assets/5d105725-f3ce-408b-ae0c-5d6eaf4e6de9)

> 支持中文界面，右下角设置图标中设置语言即可。

## 前置要求 / Prerequisites

- macOS Typora
- **Node.js**（必须）— `brew install node` 或 https://nodejs.org
- **ripgrep**（可选，用于全文搜索）— `brew install ripgrep`
- git

## 安装 / Install

```bash
git clone https://github.com/bfyes/Typora-plugin-on-Mac.git
cd Typora-plugin-on-Mac
bash install.sh
```

重启 Typora 即完成。

## 原理 / How it works

开发记录见 [`LOG.md`](./LOG.md)。

macOS 版 Typora 使用 **WKWebView**（不是 Electron），没有 Node.js 运行时。本项目通过两层提供插件运行环境：

| 组件 | 说明 |
|------|------|
| `loader.js` | WKWebView 适配器、模块加载与少量 Node polyfill |
| `bridge.js` | 本地 Node.js RPC 路由与认证 |
| `network.js` | Node 原生 fetch 与二进制响应适配 |

```
Typora WKWebView ←→ loader.js ←HTTP→ bridge.js (Node.js)
```

### 插件来源 / Plugin source

安装器使用作者仓库的源码：

```text
https://github.com/obgnail/typora_plugin.git (master, shallow clone)
    → /tmp/typora_plugin/plugin
    → /Applications/Typora.app/Contents/Resources/TypeMark/plugin
```

安装时会把当前 commit 记录到 `~/.config/typora_plugin/install-info.txt`。作者插件本身不会被改写；macOS 适配代码只额外安装 `loader.js`、`bridge.js` 和 `network.js`。右键菜单保留 Typora 经 macOS 原生桥接创建的 `NSMenu`；Typora 没有公开 API 可向它注册任意插件的子菜单或回调。

默认跟踪 `master`；需要固定到某个分支或 tag 时可在安装前指定：

```bash
PLUGIN_REF=v1.0.0 bash install.sh
```

### 适配 Hack / Adaptation Hacks

为让原本依赖 Electron 的插件在 WKWebView 上运行，做了以下适配：

| Hack | 说明 |
|------|------|
| `vscode-ripgrep` 伪造 | ripgrep 插件 `reqnode("vscode-ripgrep").rgPath` → bridge 探测系统 `rg` 路径 |
| PATH 注入 | launchd 环境 PATH 缺少 homebrew，bridge 启动时自动注入 `/opt/homebrew/bin` 等 |
| `spawn` 环境合并 | 插件传入的 `env` 与 `process.env` 合并，避免 PATH 丢失 |
| `fs.stat` 序列化 | 异步 stat 返回的对象经 HTTP 传输后丢失原型方法，bridge 序列化 `isFile()` / `isDirectory()` |
| Worker polyfill | WKWebView 的 Blob Worker 无法 XHR `file://`，markdownlint 改为主线程内联执行 |
| Electron stub | `ipcRenderer` / `remote.dialog` / `BrowserWindow` 等 Electron API 返回空桩 |
| 模块加载器 require 补全 | Worker polyfill 中的 `require("fs")` / `require("os")` 路由到 bridge stub |

## 功能 / Features

原仓库共 45 个插件。以下按 macOS 实际兼容情况分类：

### ✅ 可用（纯前端，无 Node 依赖）

| 插件 | 功能 | 默认 |
|------|------|------|
| `auto_number` | 章节、表格、图片、代码块自动编号 | ✅ |
| `resize_image` | 调整图片显示大小 | ✅ |
| `resize_table` | 调整表格行高列宽 | ✅ |
| `text_stylize` | 文字风格化（字体、字号、颜色、样式） | ✅ |
| `fence_enhance` | 代码块增强（复制、折叠、格式化） | ✅ |
| `md_padding` | 中英文混排自动空格 | ✅ |
| `easy_modify` | 编辑工具 | ✅ |
| `editor_width_slider` | 写作区宽度调整 | ✅ |
| `cjk_symbol_pairing` | 中文符号配对 | ✅ |
| `right_outline` | 右侧大纲目录 | ✅ |
| `slash_commands` | 斜杠命令 | ✅ |
| `templater` | 文件模板 | ✅ |
| `callouts` | Callouts 提示框 | ✅ |
| `kanban` | 看板 | ✅ |
| `timeline` | 时间线 | ✅ |
| `dark` | 夜间模式 | ✅ |
| `no_image` | 无图模式 | ✅ |
| `blur` | 模糊模式 | ✅ |
| `myopic_defocus` | 离焦视力舒缓 | ✅ |
| `read_only` | 只读模式 | ✅ |
| `image_viewer` | 图片查看器 | ✅ |
| `sidebar_enhance` | 侧边栏增强 | ✅ |
| `preferences` | 插件配置面板 | ✅ |
| `command_palette` | 命令面板 | ✅ |
| `markmap` | 思维导图 | 已放弃（远程资源在 WKWebView 中不稳定） |
| `echarts` | Echarts 图表 | ✅ |
| `chart` | Chart.js 图表 | ✅ |
| `drawIO` | DrawIO 图表 | ✅ |
| `abc` | 乐谱（abc.js） | ✅ |
| `calendar` | 日历组件 | ✅ |
| `wavedrom` | 时序波形图 | ✅ |
| `marp` | Marp 演示文稿 | 受 WKWebView 兼容性影响，当前版本可能失败 |
| `window_tab` | 标签页管理 | ✅ |

### ✅ 可用（通过 bridge 提供后端能力）

| 插件 | 功能 | 说明 |
|------|------|------|
| `ripgrep` | 全文搜索 | 需 `brew install ripgrep` |
| `search_multi` | 多元文件搜索 | bridge 提供 fs |
| `markdownlint` | Markdown 语法检查 | 支持中文 |
| `commander` | 命令行环境 | bridge 提供 child_process |
| `updater` | 一键升级插件 | bridge 提供 fs |
| `plantUML` | PlantUML 图表 | 默认使用在线渲染服务；支持 GET/POST 自动降级 |
| `right_click_menu` | 插件右键菜单 | 不支持：Typora 原生菜单 API 只接受内置动作 ID，不能注册作者的动态菜单项与回调 |
| `datatables` | 表格增强 | 纯前端 |
| `pie_menu` | 圆盘菜单（Ctrl+右键） | 默认关闭 |

### ❌ 不可用 / 受限

| 插件 | 功能 | 原因 |
|------|------|------|
| `html_editor` | HTML 编辑器 | `crypto` 不完整 |
| `remote_control` | Typora 自动化 | Electron IPC |
| `export_enhance` | 导出增强 | Electron 导出 |
| `article_uploader` | 博客上传 | Node 网络模块 |
| `cipher` | 文件加密 | `crypto` 不完整 |
| `mouse_gestures` | 鼠标手势 | WKWebView 限制 |
| `chat` | 聊天组件 | 兼容性 |
| `bookmark` | 书签管理器 | 受限 |
| `cursor_history` | 光标跳转 | 受限 |

> 以上分类基于测试环境，不同 Typora 版本可能有差异。可在 `preferences` 面板中尝试启用/禁用各插件，但不保证全部可用。

## 常见问题 / Troubleshooting

- **"Operation not permitted"**：macOS App Management 保护阻止写入 app bundle。解决方法（二选一）：
  - 运行 `sudo xattr -dr com.apple.provenance /Applications/Typora.app`（推荐）
  - 系统设置 → 隐私与安全性 → 应用管理 → 授权终端
- 安装脚本会自动检测此问题并给出提示。
- **ripgrep 搜索无结果**：确认已安装 ripgrep（`brew install ripgrep`），bridge 日志中检查 PATH 是否包含 homebrew。
- **bridge 未启动**：查看日志 `cat ~/.typora_plugin_bridge.log`，或手动重启 `launchctl unload && launchctl load`。

## 脚本 / Scripts

| 脚本 | 用途 |
|------|------|
| `install.sh` | 一键安装/更新 |
| `uninstall.sh` | 卸载（含 bridge/launchd 清理） |

## 卸载 / Uninstall

```bash
bash uninstall.sh
```

## Bridge 运维

```bash
curl http://127.0.0.1:45678/health    # 状态
cat ~/.typora_plugin_bridge.log       # 日志
```

## 许可 / License

MIT — 适配器代码原创。插件归 [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin) 所有。
