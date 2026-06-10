---
name: typora-plugin-macos-install
description: Install obgnail/typora_plugin on macOS Typora in one shot.
---

# Install obgnail/typora_plugin on macOS Typora

This skill installs the full [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin) suite on macOS Typora, which is NOT officially supported. It works by injecting a polyfill adapter (`loader.mac.js`) that bridges WKWebView APIs to the Node.js APIs the plugin expects.

## Usage

Just say: "Install typora_plugin on my Mac" or invoke this skill.

## Steps

1. **Check prerequisites**: Typora must be installed at `/Applications/Typora.app`.
2. **Clone the plugin repo** if not already present:
   ```bash
   git clone --depth 1 https://github.com/obgnail/typora_plugin.git /tmp/typora_plugin
   ```
3. **Copy plugin files** into the app bundle:
   ```bash
   rm -rf "/Applications/Typora.app/Contents/Resources/TypeMark/plugin"
   cp -r /tmp/typora_plugin/plugin "/Applications/Typora.app/Contents/Resources/TypeMark/plugin"
   ```
4. **Copy the macOS adapter** into place:
   ```bash
   cp loader.mac.js "/Applications/Typora.app/Contents/Resources/TypeMark/plugin/loader.mac.js"
   ```
5. **Backup** the original `index.html`:
   ```bash
   cp "/Applications/Typora.app/Contents/Resources/TypeMark/index.html" "/Applications/Typora.app/Contents/Resources/TypeMark/index.html.orig"
   ```
6. **Inject the loader** by adding ONE line before `</body>`:
   ```bash
   sed -i '' 's|</body>|<script src="./plugin/loader.mac.js" defer></script></body>|' "/Applications/Typora.app/Contents/Resources/TypeMark/index.html"
   ```
7. **Ask the user to restart Typora**.

## How it works

macOS Typora uses WKWebView (NOT Electron). The plugin expects Node.js APIs (`fs`, `path`, `require`, `process`) that don't exist. The adapter provides:

- **`reqnode()`** — XHR-based CommonJS module loader
- **`path` polyfill** — `join()`, `dirname()`, `basename()`, etc.
- **`fs` / `fs-extra` polyfill** — synchronous + async file reading via XHR
- **`process`, `Buffer`, `setImmediate`** — global shims
- **Path normalization** — handles `../` and `./` for WKWebView XHR

## Limitations

- File **writes** are no-ops (WKWebView sandbox)
- **updater**, **commander**, **ripgrep** plugins won't work (need shell access)
- User settings must be edited manually

## Uninstall

```bash
cp "/Applications/Typora.app/Contents/Resources/TypeMark/index.html.orig" "/Applications/Typora.app/Contents/Resources/TypeMark/index.html"
rm -rf "/Applications/Typora.app/Contents/Resources/TypeMark/plugin"
```
