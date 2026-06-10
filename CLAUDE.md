# typora-plugin-macos

This repo provides a one-shot installer for obgnail/typora_plugin on macOS Typora.

## Key facts for AI agents

- macOS Typora uses WKWebView, NOT Electron. Node.js APIs (`fs`, `path`, `require`, `process`) do NOT exist.
- `loader.mac.js` is a self-contained polyfill that provides these APIs via XHR and JS shims.
- `install.sh` handles the full install: clone → copy → inject → verify.
- The ONLY modification to Typora is ONE `<script>` tag before `</body>` in `index.html`.

## Project structure

```
loader.mac.js    ← The polyfill adapter (11KB, self-contained)
install.sh       ← Automated install script
CLAUDE.md        ← This file (for AI agents)
.claude/skills/install.md  ← Claude Code skill
```

## When a user asks to install

Just run `bash install.sh`. If you need to verify, check:
1. `/Applications/Typora.app/Contents/Resources/TypeMark/plugin/loader.mac.js` exists
2. `index.html` has `<script src="./plugin/loader.mac.js" defer></script>` before `</body>`
3. User restarts Typora and sees green "OK" flash
