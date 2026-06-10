# typora-plugin-macos

One-shot installer for [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin) on macOS Typora.

## Key facts

- macOS Typora uses **WKWebView**, NOT Electron. Node.js APIs (`fs`, `path`, `require`, `process`) do NOT exist.
- `loader.mac.js` is a self-contained 11KB polyfill that provides CommonJS module loading and Node.js shims.
- Settings are persisted via **localStorage** (WKWebView sandbox prevents file writes).
- The ONLY modification to Typora is ONE `<script>` tag before `</body>` in `index.html`.

## Project structure

```
loader.mac.js    ← Polyfill adapter (11KB, self-contained)
install.sh       ← Full install: clone → copy → inject
update.sh        ← Pull latest plugin, keep settings
uninstall.sh     ← Remove everything
CLAUDE.md        ← This file (for AI agents)
.claude/skills/install.md  ← Claude Code skill
```

## When a user asks to install

Just run `bash install.sh`.

## Verification checklist

1. `/Applications/Typora.app/Contents/Resources/TypeMark/plugin/loader.mac.js` exists
2. `index.html` has `<script src="./plugin/loader.mac.js" defer></script>` before `</body>`
3. User restarts Typora and sees green "OK" flash in top-left corner
4. Plugin panel appears in bottom-right corner
5. Right-click shows plugin menu items

## Known limitations

- `updater`, `commander`, `ripgrep` plugins won't work (need shell/process access)
- `templater`, `resource_manager` can't write files (sandbox)
- Settings stored in localStorage (survives restarts, cleared if WebView data is wiped)

## How the adapter works

```
Plugin expects (Node.js/Electron)     Adapter provides (WKWebView)
══════════════════════════════════     ═══════════════════════════
global / global.reqnode          →    window.reqnode (XHR + eval)
require / module.exports         →    new Function() CommonJS
fs.readFile / fs.access          →    XHR (bundle) + localStorage
fs.writeFile                     →    localStorage
path.join / path.dirname         →    JS polyfill
process / Buffer                 →    window shim
```
