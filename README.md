# typora-plugin-macos

> Run [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin) on macOS Typora — with one script.

## The Problem

obgnail/typora_plugin only supports Linux/Windows (Electron-based Typora). macOS Typora uses **WKWebView** — no Node.js, no `require()`, no `fs`.

This repo bridges the gap with a self-contained 11KB polyfill adapter.

## Quick Install

### For humans:

```bash
git clone https://github.com/YOUR_USER/typora-plugin-macos.git
cd typora-plugin-macos
bash install.sh
```

Restart Typora. Done.

### For AI agents (Claude Code, etc.):

```
"Install typora_plugin on my Mac"
```

The agent reads `.claude/skills/install.md` and handles everything automatically.

## What's Included

| File | Purpose |
|------|---------|
| `loader.mac.js` | 11KB WKWebView → Node.js polyfill adapter |
| `install.sh` | Automated install script |
| `.claude/skills/install.md` | Claude Code skill for one-shot install |

## What the Adapter Provides

```
Linux/Windows (Electron)          macOS (WKWebView + adapter)
═══════════════════════════        ═══════════════════════════════
global / global.reqnode     →      window.reqnode (XHR-based)
require / module / exports  →      new Function() CommonJS loader
fs / fs-extra               →      XHR-based readFile, access, promises
path                        →      JS polyfill (join, dirname, ...)
os                          →      JS polyfill (homedir, platform, ...)
process                     →      window.process shim
Buffer                      →      window.Buffer shim
```

## What Works

- ✅ ~40 of 46 plugins (all core features)
- ✅ Window tabs, sidebar enhance, image viewer
- ✅ Search, auto-number, right-click menu
- ✅ Command palette, dark mode, blur mode
- ✅ Markmap, ECharts, DrawIO, Mermaid

## What Doesn't

- ❌ **updater** — no shell access
- ❌ **commander** — no shell access
- ❌ **ripgrep** — no shell access
- ⚠️ **templater** — can't write files (WKWebView sandbox)
- ⚠️ **resource_manager** — can't write files

## Uninstall

```bash
cp "/Applications/Typora.app/Contents/Resources/TypeMark/index.html.orig" \
   "/Applications/Typora.app/Contents/Resources/TypeMark/index.html"
rm -rf "/Applications/Typora.app/Contents/Resources/TypeMark/plugin"
```

## Related

- [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin) — the plugin suite
- [Typora](https://typora.io) — the Markdown editor
- [Issue: macOS installation method](https://github.com/obgnail/typora_plugin/issues) — detailed technical write-up

## License

MIT — adapter code is original. The plugin suite is under obgnail/typora_plugin's license.
