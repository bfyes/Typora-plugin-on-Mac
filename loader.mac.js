// obgnail/typora_plugin macOS loader
// Loaded via <script defer> in index.html
(function() {
    "use strict";

    var BASE = "/Applications/Typora.app/Contents/Resources/TypeMark/";
    var PLUGIN = BASE + "plugin/";
    var _modCache = {};

    // ======== path polyfill ========
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

    // ======== FS polyfill ========
    function _readBundle(fp) {
        // Normalize path segments
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

    var _fs = {
        promises: { readFile: function(fp, opts) { return _fs.readFile(fp); }, writeFile: function(fp, data) { return _fs.writeFile(fp, data); }, access: function(fp) { return _fs.access(fp); }, },
        readFileSync: function(fp) { var key = "tp:" + fp; var cached = localStorage.getItem(key); if (cached !== null) return cached; var content = _readBundle(fp); return content; },
        readFile: function(fp) { var s = this; return new Promise(function(res, rej) { try { res(s.readFileSync(fp)); } catch(e) { rej(e); } }); },
        access: function(fp) { var s = this; return new Promise(function(res, rej) { try { s.readFileSync(fp); res(); } catch(e) { rej(e); } }); },
        writeFileSync: function(fp, data) { localStorage.setItem("tp:" + fp, data); },
        writeFile: function(fp, data) { localStorage.setItem("tp:" + fp, data); return Promise.resolve(); },
        appendFileSync: function() {},
        existsSync: function(fp) { try { _readBundle(fp); return true; } catch(e) { return false; } },
        statSync: function(fp) { return { isFile: function() { return !!fp.match(/\.[a-z]+$/); }, isDirectory: function() { return !fp.match(/\.[a-z]+$/); } }; },
        mkdirSync: function() {}, ensureDirSync: function() {},
        ensureDir: function() { return Promise.resolve(); },
        copySync: function() {}, removeSync: function() {},
        createReadStream: function() { return { on: function(){} }; },
        createWriteStream: function() { return { on: function(){}, end: function(){} }; }
    };

    // ======== Node.js globals on window ========
    window.process = {
        env: { HOME: "/Users/BillFeng", USER: "BillFeng", PATH: "/usr/bin:/bin", LANG: "en_US.UTF-8" },
        cwd: function() { return "/Users/BillFeng"; },
        argv: ["typora"], platform: "darwin",
        version: "v18.0.0", versions: { node: "18.0.0" },
        stderr: { write: function(){} }, stdout: { write: function(){} },
        stdin: { on: function(){}, read: function(){} },
        exit: function() {}, nextTick: function(f) { setTimeout(f, 0); },
        on: function() {}
    };
    window.Buffer = {
        from: function(s) { return typeof s === "string" ? s : String(s); },
        alloc: function(n) { return new Array(n); },
        isBuffer: function() { return false; }
    };
    window.setImmediate = function(f) { setTimeout(f, 0); };
    window.clearImmediate = function() {};
    window.global = window;

    // ======== reqnode ========
    window.reqnode = function(id) {
        if (id === "path") return _path;
        if (id === "fs" || id === "fs-extra") return _fs;
        if (id === "os") return {
            homedir: function() { return "/Users/BillFeng"; },
            platform: function() { return "darwin"; }, arch: function() { return "arm64"; },
            tmpdir: function() { return "/tmp"; }, EOL: "\n"
        };
        if (id === "child_process") return {
            execSync: function() { return ""; },
            exec: function(cmd, opts, cb) { if (typeof opts === "function") { cb = opts; } if (cb) setTimeout(function() { cb(null, "", ""); }, 0); },
            spawn: function() { return { on: function(){}, stdout: { on: function(){} }, stderr: { on: function(){} }, kill: function(){} }; }
        };
        if (id === "crypto") return {
            randomUUID: function() {
                var r = function() { return Math.random().toString(16).substring(2, 6); };
                return r()+r()+"-"+r()+"-4"+r().substring(1)+"-"+r()+"-"+r()+r()+r();
            }
        };
        if (id === "util") return {
            promisify: function(fn) { return function() { var a = arguments, s = this; return new Promise(function(res, rej) { fn.apply(s, Array.prototype.slice.call(a).concat(function(err, r) { if (err) rej(err); else res(r); })); }); }; }
        };
        if (["events","buffer","stream","http","https","url","querystring","assert","net","tls","zlib","string_decoder"].indexOf(id) >= 0) return {};

        // Resolve file path
        var fp = id;
        if (fp[0] === ".") fp = _path.join(PLUGIN, fp);
        else if (fp.indexOf("/") < 0) return {}; // bare module, not found

        // Try: /index.js, .js, exact
        var tryList = (!/\.(js|json|node|toml|css)$/.test(fp)) ? [fp + "/index.js"] : [];
        tryList.push(fp + ".js", fp);
        var src = null, resolved = null;
        for (var ti = 0; ti < tryList.length; ti++) {
            try { var _ts = _readBundle(tryList[ti]); if (_ts && _ts.trim().length > 0) { src = _ts; resolved = tryList[ti]; break; } } catch(e2) {}
        }
        if (resolved === null) throw new Error("Cannot find: " + id);

        if (_modCache[resolved]) return _modCache[resolved];

        var mod = { exports: {} };
        var __d = _path.dirname(resolved);
        var __req = function(p) {
            var full = p[0] === "." ? _path.join(__d, p) : p;
            var r = window.reqnode(full);
            
            return r;
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

    // ======== Global dirname ========
    window.dirname = BASE;
    window.__dirname = BASE;

    // ======== Load plugin on window.load ========
    window.addEventListener("load", function() {
        // Debug panel
        var _d = document.createElement("div");
        _d.style.cssText = "position:fixed;top:0;left:0;z-index:99999;background:#0a0a1a;color:#0f0;padding:10px;font:11px monospace;max-height:400px;overflow:auto;white-space:pre-wrap;pointer-events:none;opacity:0.92;";
        document.body.appendChild(_d);
        function _log(m) { _d.textContent += m + "\n"; _d.scrollTop = _d.scrollHeight; }

        try {
            _log("reqnode ready");

            _log("Loading plugin...");
            _modCache = {};  // Reset cache to load clean

            var core = window.reqnode(PLUGIN + "global/core");
            _log("Core type: " + typeof core);

            if (typeof core === "function") {
                _log("Calling entry()...");
                var r = core();
                if (r && typeof r.then === "function") {
                    r.then(
                        function(v) {
                            _log("entry() OK");
                            _d.style.background = "#040";
                            
                        },
                        function(e) {
                            _log("entry() FAIL: " + e.message + "\n" + (e.stack||"").substring(0, 500));
                            _d.style.background = "#600";
                        }
                    );
                }
                _log("entry() called");
            } else {
                _log("NOT a function, keys:" + Object.keys(core||{}).join(","));
                _d.style.background = "#640";
            }

            _log("=== DONE ===");
            setTimeout(function() {
                _d.style.transition = "opacity 1s";
                _d.style.opacity = "0";
                setTimeout(function() { if (_d.parentNode) _d.remove(); }, 1100);
            }, 8000);

        } catch(e) {
            _log("FATAL: " + e.message + "\n" + (e.stack||"").substring(0, 500));
            _d.style.background = "#800";
        }
    });

    console.debug("Typora Plugin macOS Loader initialized");
})();
