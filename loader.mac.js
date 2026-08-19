// ============================================================
// obgnail/typora_plugin macOS 适配器 / Adapter v2
// 通过 <script defer> 注入 index.html
// Requires: Node.js bridge (plugin-bridge.js) on localhost:45678
// Provides: reqnode (CommonJS), path, fs, os, process, Buffer
// ============================================================
(function() {
    "use strict";

    var BASE = "/Applications/Typora.app/Contents/Resources/TypeMark/";
    var PLUGIN = BASE + "plugin/";
    var _modCache = {};

    // ════════════════════════════════════════════════════════
    // Bridge — localhost Node.js backend
    // Token is embedded by install.sh at install time
    // ════════════════════════════════════════════════════════
    var BRIDGE = "http://127.0.0.1:45678";
    var _token = "%%BRIDGE_TOKEN%%";
    var _ready = _token && _token.indexOf("%%") < 0;

    function call(method, params) {
        if (!_ready || !_token) throw new Error("Bridge not available — start plugin-bridge.js first");
        var x = new XMLHttpRequest();
        x.open("POST", BRIDGE + "/api", false);
        x.setRequestHeader("Content-Type", "application/json");
        x.setRequestHeader("X-Bridge-Token", _token);
        try { x.send(JSON.stringify({ method: method, params: params || [] })); }
        catch(e) { throw new Error("Bridge connection failed: " + (e.message || "unknown")); }
        // WKWebView may return status 0 for cross-origin from file://
        if (x.status !== 200 && x.status !== 0) {
            var errBody = {};
            try { errBody = JSON.parse(x.responseText || "{}"); } catch(e2) {}
            throw new Error(errBody.error || ("Bridge HTTP " + x.status));
        }
        var r = JSON.parse(x.responseText || x.response || "{}");
        if (!r.ok) throw new Error(r.error || "Bridge error");
        return r.result;
    }

    function callAsync(method, params) {
        if (!_ready || !_token) return Promise.reject(new Error("Bridge not available"));
        return fetch(BRIDGE + "/api", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bridge-Token": _token },
            body: JSON.stringify({ method: method, params: params || [] })
        }).then(function(r) {
            if (!r.ok) throw new Error("Bridge HTTP " + r.status);
            return r.json();
        }).then(function(r) {
            if (!r.ok) throw new Error(r.error || "Bridge error");
            return r.result;
        }).catch(function(e) {
            // If it's a Response object (HTTP error), try to read the body
            if (e && e.text && typeof e.text === "function") {
                return e.text().then(function(t) {
                    var errBody = {};
                    try { errBody = JSON.parse(t); } catch(e2) {}
                    throw new Error(errBody.error || e.statusText || "Bridge error");
                });
            }
            throw e;
        });
    }

    // ════════════════════════════════════════════════════════
    // path polyfill (pure JS, always works)
    // ════════════════════════════════════════════════════════
    var _path = {
        join: function() {
            var p = [], a = arguments;
            for (var i = 0; i < a.length; i++) {
                var s = String(a[i]); if (!s) continue;
                if (s[0] === "/") { p = s.split("/").filter(function(x) { return x; }); }
                else {
                    var segs = s.split("/");
                    for (var si = 0; si < segs.length; si++) {
                        var seg = segs[si];
                        if (!seg || seg === ".") continue;
                        if (seg === "..") { if (p.length > 0) p.pop(); }
                        else p.push(seg);
                    }
                }
            }
            var result = p.join("/");
            var first = a[0] ? String(a[0]) : "";
            return (first[0] === "/" ? "/" : "") + result || ".";
        },
        dirname: function(x) {
            var isAbs = x[0] === "/";
            var parts = x.split("/"), out = [];
            for (var pi = 0; pi < parts.length; pi++) {
                if (parts[pi] === "." || parts[pi] === "") continue;
                if (parts[pi] === "..") { out.pop(); continue; }
                out.push(parts[pi]);
            }
            var clean = (isAbs ? "/" : "") + out.join("/");
            var idx = clean.lastIndexOf("/");
            return idx >= 0 ? (clean.substring(0, idx) || "/") : ".";
        },
        basename: function(x, e) { var b = x.split("/").pop(); return e && b.endsWith(e) ? b.slice(0,-e.length) : b; },
        extname: function(x) { var b = x.split("/").pop(), i = b.lastIndexOf("."); return i > 0 ? b.substring(i) : ""; },
        resolve: function() { return _path.join.apply(null, arguments); },
        sep: "/"
    };

    // ════════════════════════════════════════════════════════
    // XHR: read plugin bundle files from app bundle
    // This is ALWAYS needed for module loading, regardless of bridge.
    // ════════════════════════════════════════════════════════
    function _readBundle(fp) {
        var rel = fp.indexOf(BASE) === 0 ? fp.substring(BASE.length) : fp;
        var parts = rel.split("/"), out = [];
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] === "." || parts[i] === "") continue;
            if (parts[i] === "..") { out.pop(); continue; }
            out.push(parts[i]);
        }
        var cleanRel = "./" + out.join("/");
        var x = new XMLHttpRequest();
        x.open("GET", cleanRel, false);
        try { x.send(); } catch(e) { throw new Error("XHR: " + cleanRel + " - " + e.message); }
        if (x.status !== 0 && x.status !== 200) throw new Error("XHR status " + x.status + ": " + cleanRel);
        var text = x.responseText || "";
        if (/^\s*<!doctype/i.test(text) || /^\s*<html/i.test(text)) throw new Error("Got HTML for: " + cleanRel);
        return text;
    }

    
            // ════════════════════════════════════════════════════════
    // Worker polyfill: run markdownlint in main thread
    // WKWebView Blob Workers can't XHR to file://, so we run linter inline
    // ════════════════════════════════════════════════════════
    var _OrigWorker = window.Worker;
    window.Worker = function(scriptURL, options) {
        if (typeof scriptURL === "string" && scriptURL.indexOf("linter-worker") >= 0) {
            return _createMainThreadLinter();
        }
        return new _OrigWorker(scriptURL, options);
    };
    window.Worker.prototype = _OrigWorker.prototype;
    
    function _createMainThreadLinter() {
        var _onmessage = null;
        var _onerror = null;
        var LIB = null;
        var RULE_CONFIG = null;
        var CUSTOM_RULES = null;
        var PLUGIN_DIR = _path.join(BASE, "plugin");
        
        function _loadLib(path, parentDir) {
            if (path && path.indexOf("/") === 0) {
                try {
                    var src = _readBundle(path);
                    if (!src) return {};
                    var dir = parentDir || _path.dirname(path);
                    
                    var m = { exports: {} };
                    var fn = new Function("module", "exports", "require", "__dirname", "__filename", src);
                    fn(m, m.exports, function(id) {
                        // Resolve require() calls relative to the requiring file's directory
                        if (id === "path") return _path;
                        if (id === "fs" || id === "fs-extra") return _fs;
                        if (id === "os") return { EOL: "\n", homedir: function() { return call("os.homedir", []); }, platform: function() { return "darwin"; } };
                        if (id[0] === ".") return _loadLib(_path.join(dir, id), dir);
                        return _loadLib(id);
                    }, dir, path);
                    
                    // If module.exports is set, return it
                    if (m.exports && typeof m.exports === "object" && Object.keys(m.exports).length > 0) return m.exports;
                    // Markdownlint bundles return via a var (e.g. "var oa=T(At(),1)"); try to capture it
                    // The library is fully evaluated; check for any useful exports
                    if (m.exports && (m.exports.lint || m.exports.getVersion)) return m.exports;
                    // Try again with wrapped source that captures the export var
                    var wrapped = src + "\n__export__ = (typeof oa !== 'undefined' ? oa : module.exports);";
                    var __export__ = null;
                    var fn2 = new Function("module", "exports", "require", "__dirname", "__filename", "__export__", wrapped);
                    fn2(m, m.exports, function(id) {
                        if (id === "path") return _path;
                        if (id === "fs" || id === "fs-extra") return _fs;
                        if (id === "os") return { EOL: "\n", homedir: function() { return call("os.homedir", []); }, platform: function() { return "darwin"; } };
                        if (id[0] === ".") return _loadLib(_path.join(dir, id), dir);
                        return _loadLib(id);
                    }, dir, path, __export__);
                    if (__export__ && (__export__.lint || __export__.getVersion)) return __export__;
                    return m.exports;
                } catch(e) {}
                return {};
            }
            return {};
        }
        
        function configure(payload) {
            var polyfillLib = payload.polyfillLib;
            var coreLib = payload.coreLib;
            var helpersLib = payload.helpersLib;
            var customRuleFiles = payload.customRuleFiles || [];
            var ruleConfig = payload.ruleConfig;
            var content = payload.content;
            
            if (polyfillLib) _loadLib(polyfillLib);
            if (coreLib) LIB = _loadLib(coreLib);
            if (helpersLib) {
                try { _loadLib(helpersLib); } catch(e) {}
            }
            if (customRuleFiles.length) {
                try {
                    var helpers = _loadLib(helpersLib);
                    customRuleFiles.forEach(function(f) {
                        try {
                            var rule = _loadLib(f);
                            if (typeof rule === "function") rule(helpers);
                        } catch(e) {}
                    });
                } catch(e) {}
            }
            if (ruleConfig) RULE_CONFIG = ruleConfig;
            
            if (content) return check({ content: content });
        }
        
        function check(payload) {
            if (!LIB || !LIB.lint) return;
            try {
                return LIB.lint({ strings: { content: payload.content }, config: RULE_CONFIG, customRules: CUSTOM_RULES });
            } catch(e) {}
        }
        
        function fix(payload) {
            if (!LIB || !LIB.applyFixes || !payload.fixInfo || !payload.fixInfo.length) return;
            try {
                return LIB.applyFixes(payload.content, payload.fixInfo);
            } catch(e) {}
        }
        
        var _actions = { configure: configure, check: check, fix: fix, close: function() {} };
        
        // Process messages with setTimeout to not block
        function _process(data) {
            var action = data.action;
            var payload = data.payload;
            if (!payload || !_actions[action]) return;
            try {
                var result = _actions[action](payload);
                if (result) {
                    if (result.then) {
                        result.then(function(r) {
                            if (_onmessage) _onmessage({ data: { action: action, result: r } });
                        });
                    } else {
                        if (_onmessage) _onmessage({ data: { action: action, result: result } });
                    }
                }
            } catch(e) {
                if (_onerror) _onerror({ message: e.message });
            }
        }
        
        return {
            postMessage: function(data) { setTimeout(function() { _process(data); }, 0); },
            set onmessage(fn) { _onmessage = fn; },
            get onmessage() { return _onmessage; },
            set onerror(fn) { _onerror = fn; },
            get onerror() { return _onerror; },
            terminate: function() { LIB = null; },
            addEventListener: function(ev, fn) { if (ev === "message") _onmessage = fn; if (ev === "error") _onerror = fn; },
        };
    }

function _isPluginPath(fp) {
        return fp.indexOf(BASE) === 0 || fp.indexOf("/plugin/") >= 0;
    }

    // ════════════════════════════════════════════════════════
    // fs — bridge for real I/O, XHR for plugin bundle files
    // ════════════════════════════════════════════════════════
    // Wrap stat objects from bridge: convert _isFile/_isDirectory booleans to methods
    function _wrapStat(st) {
        if (!st) return st;
        if (st._isFile !== undefined) {
            st.isFile = function() { return st._isFile; };
            st.isDirectory = function() { return st._isDirectory; };
            st.isBlockDevice = function() { return st._isBlockDevice; };
            st.isCharacterDevice = function() { return st._isCharacterDevice; };
            st.isSymbolicLink = function() { return st._isSymbolicLink; };
            st.isFIFO = function() { return st._isFIFO; };
            st.isSocket = function() { return st._isSocket; };
        }
        return st;
    }

    var _fs = {
        promises: {},

        readFileSync: function(fp, opts) {
            // Always try bridge first — it reads from the real filesystem
            try {
                return call("fs.readFileSync", [fp, (opts && opts.encoding) || "utf8"]);
            } catch(e) {
                // Fallback to XHR for plugin bundle files (only if bridge read fails)
                if (_isPluginPath(fp)) {
                    try { return _readBundle(fp); } catch(e2) { throw e; }
                }
                throw e;
            }
        },
        readFile: function(fp, opts) {
            return callAsync("fs.readFile", [fp, (opts && opts.encoding) || "utf8"])
                .catch(function(e) {
                    // Fallback to XHR for plugin bundle files
                    if (_isPluginPath(fp)) {
                        try { return _readBundle(fp); } catch(e2) { throw e; }
                    }
                    throw e;
                });
        },

        writeFileSync: function(fp, data, opts) {
            call("fs.writeFileSync", [fp, data, (opts && opts.encoding) || "utf8"]);
        },
        writeFile: function(fp, data, opts) {
            return callAsync("fs.writeFile", [fp, data, (opts && opts.encoding) || "utf8"]);
        },

        readJson: function(fp) {
            return callAsync("fs.readJson", [fp]).catch(function(e) {
                if (_isPluginPath(fp)) {
                    try { return JSON.parse(_readBundle(fp)); } catch(e2) { throw e; }
                }
                throw e;
            });
        },
        readJsonSync: function(fp) {
            try { return call("fs.readJsonSync", [fp]); }
            catch(e) {
                if (_isPluginPath(fp)) return JSON.parse(_readBundle(fp));
                throw e;
            }
        },

        writeJson: function(fp, data, spaces) {
            return callAsync("fs.writeJson", [fp, data, spaces || 2]);
        },
        writeJsonSync: function(fp, data, spaces) {
            call("fs.writeJsonSync", [fp, data, spaces || 2]);
        },

        appendFileSync: function(fp, data, opts) {
            call("fs.appendFileSync", [fp, data, (opts && opts.encoding) || "utf8"]);
        },
        appendFile: function(fp, data, opts) {
            return callAsync("fs.appendFile", [fp, data, (opts && opts.encoding) || "utf8"]);
        },

        existsSync: function(fp) {
            try { return call("fs.existsSync", [fp]); }
            catch(e) {
                if (_isPluginPath(fp)) {
                    try { _readBundle(fp); return true; } catch(e2) { return false; }
                }
                return false;
            }
        },
        access: function(fp) {
            return callAsync("fs.access", [fp]).catch(function(e) {
                if (_isPluginPath(fp)) {
                    try { _readBundle(fp); return; } catch(e2) { throw e; }
                }
                throw e;
            });
        },

        statSync: function(fp) {
            return _wrapStat(call("fs.statSync", [fp]));
        },
        stat: function(fp) {
            return callAsync("fs.stat", [fp]).then(_wrapStat);
        },
        lstatSync: function(fp) {
            return _wrapStat(call("fs.lstatSync", [fp]));
        },
        lstat: function(fp) {
            return callAsync("fs.lstat", [fp]).then(_wrapStat);
        },

        mkdirSync: function(p, opts) {
            call("fs.mkdirSync", [p, opts || { recursive: true }]);
        },
        ensureDirSync: function(p) {
            call("fs.ensureDirSync", [p]);
        },
        ensureDir: function(p) {
            return callAsync("fs.ensureDir", [p]);
        },
        readdirSync: function(p, opts) {
            return call("fs.readdirSync", [p, opts || {}]);
        },
        readdir: function(p, opts) {
            return callAsync("fs.readdir", [p, opts || {}]);
        },

        copySync: function(src, dest) {
            call("fs.copySync", [src, dest]);
        },
        copy: function(src, dest) {
            return callAsync("fs.copy", [src, dest]);
        },
        renameSync: function(src, dest) {
            call("fs.rename", [src, dest]);
        },
        rename: function(src, dest) {
            return callAsync("fs.rename", [src, dest]);
        },
        removeSync: function(p) {
            call("fs.removeSync", [p]);
        },
        remove: function(p) {
            return callAsync("fs.remove", [p]);
        },
        emptyDirSync: function(p) {
            call("fs.emptyDirSync", [p]);
        },
        emptyDir: function(p) {
            return callAsync("fs.emptyDir", [p]);
        },

        chmodSync: function(p, mode) {
            call("fs.chmodSync", [p, mode]);
        },
        chmod: function(p, mode) {
            return callAsync("fs.chmod", [p, mode]);
        },

        createReadStream: function() { return { on: function(){}, pipe: function(){} }; },
        createWriteStream: function() { return { on: function(){}, end: function(){}, write: function(){} }; },
    };

    _fs.promises = {
        readFile: function(fp, opts) { return _fs.readFile(fp, opts); },
        writeFile: function(fp, data, opts) { return _fs.writeFile(fp, data, opts); },
        access: function(fp) { return _fs.access(fp); },
        stat: function(fp) { return _fs.stat(fp); },
        lstat: function(fp) { return _fs.lstat(fp); },
        readdir: function(p, opts) { return _fs.readdir(p, opts); },
        mkdir: function(p, opts) { return _fs.ensureDir(p); },
        copyFile: function(src, dest) { return _fs.copy(src, dest); },
        rename: function(src, dest) { return _fs.rename(src, dest); },
        rm: function(p, opts) { return _fs.remove(p); },
        chmod: function(p, mode) { return _fs.chmod(p, mode); },
        appendFile: function(fp, data, opts) { return _fs.appendFile(fp, data, opts); },
    };

    // ════════════════════════════════════════════════════════
    // Node.js globals on window
    // ════════════════════════════════════════════════════════
    window.process = {
        env: {},  // populated from bridge at init
        cwd: function() { return _ready ? call("process.cwd", []) : "/"; },
        argv: ["typora"], platform: "darwin",
        version: "v18.0.0", versions: { node: "18.0.0" },
        stderr: { write: function(){} }, stdout: { write: function(){} },
        stdin: { on: function(){}, read: function(){} },
        exit: function() {}, nextTick: function(f) { setTimeout(f, 0); },
        on: function() {}
    };
    window.Buffer = {
        from: function(s, enc) { return typeof s === "string" ? s : String(s); },
        alloc: function(n) { return new Array(n); },
        concat: function(arrs) { return arrs.join(""); },
        isBuffer: function() { return false; },
        byteLength: function(s) { return String(s).length; }
    };
    window.setImmediate = function(f) { setTimeout(f, 0); };
    window.clearImmediate = function() {};
    window.global = window;

    // ════════════════════════════════════════════════════════
    // reqnode — module loader (bridge-backed)
    // ════════════════════════════════════════════════════════
    window.reqnode = function(id) {
        if (id === "path") return _path;
        if (id === "fs" || id === "fs-extra") return _fs;

        // ── os ──
        if (id === "os") {
            return {
                homedir: function() { return call("os.homedir", []); },
                platform: function() { return call("os.platform", []); },
                arch: function() { return call("os.arch", []); },
                tmpdir: function() { return call("os.tmpdir", []); },
                cpus: function() { try { return call("os.cpus", []); } catch(e) { return []; } },
                networkInterfaces: function() { try { return call("os.networkInterfaces", []); } catch(e) { return {}; } },
                EOL: "\n"
            };
        }

        // ── child_process ──
        if (id === "child_process") {
            return {
                execSync: function(cmd, opts) {
                    return call("child_process.execSync", [cmd, opts || {}]);
                },
                exec: function(cmd, opts, cb) {
                    if (typeof opts === "function") { cb = opts; opts = {}; }
                    callAsync("child_process.exec", [cmd, opts || {}])
                        .then(function(r) { if (cb) cb(r.error, r.stdout, r.stderr); })
                        .catch(function(e) { if (cb) cb(e, "", e.message); });
                },
                spawn: function(cmd, args, opts) {
                    var child = {
                        _listeners: {},
                        on: function(ev, fn) {
                            this._listeners[ev] = this._listeners[ev] || [];
                            this._listeners[ev].push(fn);
                            return this;
                        },
                        kill: function() {},
                        stdin: { write: function() {}, end: function() {} },
                        stdout: { on: function(ev, fn) { child.on("stdout_" + ev, fn); return this; } },
                        stderr: { on: function(ev, fn) { child.on("stderr_" + ev, fn); return this; } },
                    };
                    callAsync("child_process.spawn", [cmd, args || [], opts || {}])
                        .then(function(r) {
                            if (r.stdout) child._listeners["stdout_data"] && child._listeners["stdout_data"].forEach(function(fn) { fn(r.stdout); });
                            if (r.stderr) child._listeners["stderr_data"] && child._listeners["stderr_data"].forEach(function(fn) { fn(r.stderr); });
                            child._listeners["close"] && child._listeners["close"].forEach(function(fn) { fn(r.code); });
                        })
                        .catch(function(e) {
                            child._listeners["error"] && child._listeners["error"].forEach(function(fn) { fn(e); });
                        });
                    return child;
                },
            };
        }

        // ── crypto ──
        if (id === "crypto") {
            return {
                randomUUID: function() { return call("crypto.randomUUID", []); }
            };
        }

        // ── util ──
        if (id === "util") {
            return {
                promisify: function(fn) {
                    return function() {
                        var a = arguments, s = this;
                        return new Promise(function(res, rej) {
                            fn.apply(s, Array.prototype.slice.call(a).concat(function(err, r) {
                                if (err) rej(err); else res(r);
                            }));
                        });
                    };
                }
            };
        }

        // ── zlib ──
        if (id === "zlib") {
            return {
                deflateRawSync: function(input) {
                    var b64 = call("zlib.deflateRawSync", [String(input)]);
                    return { toString: function() { return b64; } };
                },
                inflateRawSync: function(input) {
                    var str = call("zlib.inflateRawSync", [String(input)]);
                    return { toString: function() { return str; } };
                },
                deflateSync: function(input) {
                    var b64 = call("zlib.deflateSync", [String(input)]);
                    return { toString: function() { return b64; } };
                },
                inflateSync: function(input) {
                    var str = call("zlib.inflateSync", [String(input)]);
                    return { toString: function() { return str; } };
                },
            };
        }

        // ── electron (shell stubs via bridge) ──
        if (id === "electron") {
            return {
                shell: {
                    openExternal: function(url) {
                        callAsync("shell.openExternal", [url]).catch(function() {});
                    },
                    openPath: function(p) {
                        callAsync("shell.openPath", [p]).catch(function() {});
                    },
                    showItemInFolder: function(p) {
                        callAsync("shell.openPath", [p]).catch(function() {});
                    },
                },
                ipcRenderer: {
                    on: function(channel, listener) { /* stub */ },
                    send: function(channel, ...args) { /* stub */ },
                    invoke: function(channel, ...args) { return Promise.resolve({ canceled: true, filePaths: [] }); },
                    once: function(channel, listener) { /* stub */ },
                    removeListener: function(channel, listener) { /* stub */ },
                },
                remote: {
                    dialog: {
                        showOpenDialog: function() { return Promise.resolve({ canceled: true, filePaths: [] }); },
                        showSaveDialog: function() { return Promise.resolve({ canceled: true, filePath: "" }); },
                    },
                    BrowserWindow: {
                        getAllWindows: function() { return []; },
                        getFocusedWindow: function() { return null; },
                    },
                },
                app: {
                    getPath: function(name) { return call("os.homedir", []) + "/Library/Application Support/Typora"; },
                    getVersion: function() { return "1.0.0"; },
                },
            };
        }

        // ── http (RPC server via bridge) ──
        if (id === "http") {
            return {
                createServer: function(handler) {
                    var serverName = "rc_" + Date.now();
                    var port;
                    try { port = call("http.createServer", [{ name: serverName }]).port; }
                    catch(e) { return { listen: function() {}, close: function() {} }; }

                    var polling = false, pollInterval = null;
                    return {
                        _handler: handler, _port: port, _serverName: serverName,
                        listen: function(p, host, cb) {
                            polling = true;
                            pollInterval = setInterval(function() {
                                if (!polling) return;
                                var reqs = call("http.getRequests", [{ name: serverName }]).requests;
                                reqs.forEach(function(r) {
                                    var handled = false;
                                    var res = {
                                        _reqId: r.id, _serverName: serverName,
                                        _statusCode: 200, _headers: {},
                                        writeHead: function(code, headers) { this._statusCode = code; this._headers = headers || {}; },
                                        end: function(body) {
                                            handled = true;
                                            callAsync("http.sendResponse", [{ name: serverName, reqId: r.id, response: {
                                                statusCode: this._statusCode, headers: this._headers, body: body
                                            }}]).catch(function() {});
                                        }
                                    };
                                    try { handler({ method: r.method, url: r.url, headers: r.headers, body: r.body }, res); }
                                    catch(e) { if (!handled) res.end("Error: " + e.message); }
                                });
                            }, 500);
                            if (cb) cb();
                        },
                        close: function(cb) { polling = false; if (pollInterval) clearInterval(pollInterval); if (cb) cb(); }
                    };
                },
                request: function() { return { on: function(){}, end: function(){} }; },
                get: function() { return { on: function(){}, end: function(){} }; },
            };
        }
        if (id === "https") {
            return {
                request: function() { return { on: function(){}, end: function(){} }; },
                get: function() { return { on: function(){}, end: function(){} }; },
            };
        }

        // ── Stub modules ──
        if (id === "net") return { createServer: function() { return { listen: function(){} }; }, connect: function() { return { on: function(){}, end: function(){} }; } };
        if (id === "tls") return { connect: function() { return { on: function(){}, end: function(){} }; } };
        if (id === "url") return {
            parse: function(u) {
                try { var a = document.createElement("a"); a.href = u; return { protocol: a.protocol, host: a.host, hostname: a.hostname, port: a.port, pathname: a.pathname, search: a.search, hash: a.hash, href: a.href }; }
                catch(e) { return {}; }
            }
        };
        if (id === "querystring") return {
            parse: function(s) { var o = {}; if (!s) return o; s.split("&").forEach(function(p) { var kv = p.split("="); o[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ""); }); return o; },
            stringify: function(o) { return Object.keys(o).map(function(k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); }).join("&"); }
        };
        if (id === "stream") return { Transform: function() { return { on: function(){}, pipe: function(){}, write: function(){}, end: function(){} }; } };
        if (["events","buffer","assert","string_decoder","tty","worker_threads","supports-color"].indexOf(id) >= 0) return {};

        // ── vscode-ripgrep stub: return system rg path ──
        // ripgrep plugin does: reqnode("vscode-ripgrep").rgPath
        // We ask bridge to locate the system-installed rg binary
        if (id === "vscode-ripgrep") {
            var rgPath = null;
            try { rgPath = call("util.which", ["rg"]); } catch(e) {}
            if (!rgPath) {
                // Fallback: check common macOS paths synchronously
                var candidates = ["/opt/homebrew/bin/rg", "/usr/local/bin/rg", "/usr/bin/rg"];
                for (var ci = 0; ci < candidates.length; ci++) {
                    try { if (call("fs.existsSync", [candidates[ci]])) { rgPath = candidates[ci]; break; } } catch(e) {}
                }
            }
            return { rgPath: rgPath || "/usr/bin/rg" };
        }

        // ── Resolve and load plugin module ──
        var fp = id;
        if (fp[0] === ".") fp = _path.join(PLUGIN, fp);
        else if (fp.indexOf("/") < 0) return {};

        var tryList = !/\.(js|json|node|toml|css)$/.test(fp) ? [fp + "/index.js"] : [];
        tryList.push(fp + ".js", fp);
        var src = null, resolved = null;
        for (var ti = 0; ti < tryList.length; ti++) {
            try { var _ts = _readBundle(tryList[ti]); if (_ts && _ts.trim().length > 0) { src = _ts; resolved = tryList[ti]; break; } } catch(e2) {}
        }
        if (resolved === null) throw new Error("Cannot find: " + id);
        if (_modCache[resolved]) return _modCache[resolved];

        // JSON files: parse as JSON instead of eval
        if (/\.json$/i.test(resolved)) {
            try {
                var parsed = JSON.parse(src);
                _modCache[resolved] = parsed;
                return parsed;
            } catch(e) {
                throw new Error("Module '" + resolved.replace(BASE, "") + "' (JSON) failed: " + e.message);
            }
        }

        var mod = { exports: {} };
        var __d = _path.dirname(resolved);
        var __req = function(p) {
            var full = p[0] === "." ? _path.join(__d, p) : p;
            return window.reqnode(full);
        };

        var shortName = resolved.substring(BASE.length);
        var fn = new Function("module","exports","require","reqnode","__dirname","__filename","global","console","process","Buffer","setTimeout","setInterval","setImmediate","clearImmediate", src);
        try {
            fn(mod, mod.exports, __req, window.reqnode, __d, resolved, window, console, window.process, window.Buffer, setTimeout, setInterval, window.setImmediate, window.clearImmediate);
        } catch(ex) {
            var fn2 = new Function("module","exports","require","reqnode","__dirname","__filename","global","console","process","Buffer","setTimeout","setInterval", src);
            try {
                fn2(mod, mod.exports, __req, window.reqnode, __d, resolved, window, console, window.process, window.Buffer, setTimeout, setInterval);
            } catch(ex2) {
                throw new Error("Module '" + shortName + "' failed: " + ex2.message);
            }
        }
        _modCache[resolved] = mod.exports;
        return mod.exports;
    };

    // ════════════════════════════════════════════════════════
    // Global dirname
    // ════════════════════════════════════════════════════════
    window.dirname = BASE;
    window.__dirname = BASE;

    // ════════════════════════════════════════════════════════
    // Init on window.load
    // ════════════════════════════════════════════════════════

window.addEventListener("load", function() {
        // White strip to block content behind tab bar
        var _topStrip = document.createElement("div");
        _topStrip.id = "plugin-top-strip";
        _topStrip.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:26px;background:#fff;z-index:897;pointer-events:none;";
        document.body.appendChild(_topStrip);

        // Move word count and adjacent button to bottom-left
        var _footerFix = document.createElement("style");
        _footerFix.textContent = "footer.ty-footer { justify-content: flex-start !important; padding-left: 30px !important; } footer.ty-footer > * { margin-left: 0 !important; margin-right: 12px !important; }";
        document.head.appendChild(_footerFix);

        // Fix tab bar position & width
        var _tabFixStyle = document.createElement("style");
        _tabFixStyle.textContent = "#plugin-window-tab { top: 26px !important; height: 34px !important; width: 100vw !important; left: 0 !important; background-color: #fff !important; } #plugin-window-tab .tab-bar { background-color: #fff !important; }";
        document.head.appendChild(_tabFixStyle);

        // Bridge connectivity check
        if (_ready) {
            try {
                window.process.env = call("process.env", []);
                window.process.cwd = function() { try { return call("process.cwd", []); } catch(e) { return "/"; } };
            } catch(e) {
                _ready = false;
            }
        }

        // Load plugin, then force code block re-scan after init
        try {
            _modCache = {};
            var core = window.reqnode(PLUGIN + "global/core");
            if (typeof core === "function") {
                var p = core();
                if (p && p.then) p.then(function() {
                    // Re-fire code block events that may have been missed during loading
                    setTimeout(function() {
                        try {
                            if (typeof File !== "undefined" && File.editor && File.editor.fences) {
                                var q = File.editor.fences.queue || {};
                                Object.keys(q).forEach(function(cid) {
                                    try { File.editor.fences.addCodeBlock(cid); } catch(e) {}
                                });
                            }
                        } catch(e) {}
                    }, 300);
                });
            }
        } catch(e) {}
    });

})();
