#!/usr/bin/env node
// ============================================================
// obgnail/typora_plugin — Node.js Bridge Server
// 为 WKWebView 沙箱提供真实的 Node.js API
// Provides real Node.js APIs to the WKWebView sandbox.
//
// Usage: node plugin-bridge.js [--port PORT] [--token TOKEN]
// ============================================================
"use strict";

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const cp = require("child_process");
const zlib = require("zlib");
const crypto = require("crypto");

// ── Enrich PATH for launchd context (homebrew, etc.) ────────
// launchd starts with minimal PATH, so homebrew binaries are missing
(function() {
    var extraPaths = [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/local/sbin",
        "/opt/homebrew/opt/node/bin",
    ];
    var currentPath = (process.env.PATH || "").split(":");
    var newPath = currentPath.slice();
    extraPaths.forEach(function(p) {
        if (newPath.indexOf(p) === -1) {
            try { if (fs.existsSync(p)) newPath.push(p); } catch(e) {}
        }
    });
    process.env.PATH = newPath.join(":");
})();

// ── Config ─────────────────────────────────────────────────
const PORT = parseInt(process.env.BRIDGE_PORT || process.argv[process.argv.indexOf("--port") + 1]) || 45678;
const TOKEN_FILE = path.join(os.homedir(), ".typora_plugin_bridge_token");
const TOKEN = process.env.BRIDGE_TOKEN || readToken();

function readToken() {
    try {
        const t = fs.readFileSync(TOKEN_FILE, "utf8").trim();
        if (t) return t;
    } catch (e) { /* not found */ }
    // Generate and persist
    const t = crypto.randomBytes(32).toString("hex");
    try { fs.writeFileSync(TOKEN_FILE, t, { mode: 0o600 }); } catch (e) {}
    return t;
}

// ── Logger ─────────────────────────────────────────────────
const LOG_FILE = path.join(os.homedir(), ".typora_plugin_bridge.log");
function log(level, msg) {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
    try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch (e) {}
    if (level === "ERROR") console.error(line);
}

// ── Security: check token ──────────────────────────────────
function checkToken(req) {
    const provided = (req.headers["x-bridge-token"] || "").trim();
    return provided === TOKEN;
}

// ── CORS headers (localhost only, but still) ───────────────
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Bridge-Token",
        "Content-Type": "application/json",
    };
}

// ── Response helpers ───────────────────────────────────────
function ok(res, result) {
    res.writeHead(200, corsHeaders());
    res.end(JSON.stringify({ ok: true, result }));
}

function err(res, message, code) {
    res.writeHead(code || 500, corsHeaders());
    res.end(JSON.stringify({ ok: false, error: message }));
}

function parseBody(req) {
    return new Promise(function (resolve) {
        var chunks = [];
        req.on("data", function (c) { chunks.push(c); });
        req.on("end", function () {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
            catch (e) { resolve(null); }
        });
    });
}

// ── Router ─────────────────────────────────────────────────
var ROUTES = {
    // ── fs ──
    "fs.readFile": function (params) {
        var filepath = params[0];
        var encoding = params[1] || "utf8";
        return fsp.readFile(filepath, encoding);
    },
    "fs.readFileSync": function (params) {
        var filepath = params[0];
        var encoding = params[1] || "utf8";
        return fs.readFileSync(filepath, encoding);
    },
    "fs.writeFile": function (params) {
        var filepath = params[0];
        var data = params[1];
        var encoding = params[2] || "utf8";
        return fsp.writeFile(filepath, data, encoding);
    },
    "fs.writeFileSync": function (params) {
        var filepath = params[0];
        var data = params[1];
        var encoding = params[2] || "utf8";
        return fs.writeFileSync(filepath, data, encoding);
    },
    "fs.access": function (params) {
        return fsp.access(params[0]);
    },
    "fs.existsSync": function (params) {
        return fs.existsSync(params[0]);
    },
    "fs.readdir": function (params) {
        return fsp.readdir(params[0], params[1] || {});
    },
    "fs.readdirSync": function (params) {
        return fs.readdirSync(params[0], params[1] || {});
    },
    "fs.stat": function (params) {
        return fsp.stat(params[0]).then(serializeStat);
    },
    "fs.statSync": function (params) {
        var s = fs.statSync(params[0]);
        return serializeStat(s);
    },
    "fs.lstat": function (params) {
        return fsp.lstat(params[0]).then(serializeStat);
    },
    "fs.lstatSync": function (params) {
        var s = fs.lstatSync(params[0]);
        return serializeStat(s);
    },
    "fs.mkdir": function (params) {
        return fsp.mkdir(params[0], params[1] || { recursive: true });
    },
    "fs.mkdirSync": function (params) {
        return fs.mkdirSync(params[0], params[1] || { recursive: true });
    },
    "fs.ensureDirSync": function (params) {
        return fs.mkdirSync(params[0], { recursive: true });
    },
    "fs.ensureDir": function (params) {
        return fsp.mkdir(params[0], { recursive: true });
    },
    "fs.copyFile": function (params) {
        return fsp.copyFile(params[0], params[1]);
    },
    "fs.copySync": function (params) {
        var src = params[0];
        var dest = params[1];
        var stat = fs.statSync(src);
        if (stat.isDirectory()) {
            fs.mkdirSync(dest, { recursive: true });
            fs.readdirSync(src).forEach(function (f) {
                fs.cpSync(path.join(src, f), path.join(dest, f), { recursive: true });
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    },
    "fs.copy": function (params) {
        // fs-extra style copy (async)
        var src = params[0];
        var dest = params[1];
        return fsp.stat(src).then(function (stat) {
            if (stat.isDirectory()) {
                return fsp.mkdir(dest, { recursive: true }).then(function () {
                    return fsp.readdir(src);
                }).then(function (files) {
                    return Promise.all(files.map(function (f) {
                        return fsp.cp(path.join(src, f), path.join(dest, f), { recursive: true });
                    }));
                });
            } else {
                return fsp.copyFile(src, dest);
            }
        });
    },
    "fs.rename": function (params) {
        return fsp.rename(params[0], params[1]);
    },
    "fs.removeSync": function (params) {
        return fs.rmSync(params[0], { recursive: true, force: true });
    },
    "fs.remove": function (params) {
        return fs.promises.rm(params[0], { recursive: true, force: true });
    },
    "fs.emptyDir": function (params) {
        return fsp.readdir(params[0]).then(function (files) {
            return Promise.all(files.map(function (f) {
                return fs.promises.rm(path.join(params[0], f), { recursive: true, force: true });
            }));
        });
    },
    "fs.emptyDirSync": function (params) {
        var dir = params[0];
        fs.readdirSync(dir).forEach(function (f) {
            fs.rmSync(path.join(dir, f), { recursive: true, force: true });
        });
    },
    "fs.chmod": function (params) {
        return fsp.chmod(params[0], params[1]);
    },
    "fs.chmodSync": function (params) {
        return fs.chmodSync(params[0], params[1]);
    },
    "fs.appendFileSync": function (params) {
        return fs.appendFileSync(params[0], params[1], params[2] || "utf8");
    },
    "fs.appendFile": function (params) {
        return fsp.appendFile(params[0], params[1], params[2] || "utf8");
    },
    "fs.readJson": function (params) {
        return fsp.readFile(params[0], "utf8").then(function (d) { return JSON.parse(d); });
    },
    "fs.readJsonSync": function (params) {
        return JSON.parse(fs.readFileSync(params[0], "utf8"));
    },
    "fs.writeJson": function (params) {
        return fsp.writeFile(params[0], JSON.stringify(params[1], null, params[2] || 2), "utf8");
    },
    "fs.writeJsonSync": function (params) {
        return fs.writeFileSync(params[0], JSON.stringify(params[1], null, params[2] || 2), "utf8");
    },

    // ── child_process ──
    "child_process.exec": function (params) {
        var cmd = params[0];
        var opts = params[1] || {};
        return new Promise(function (resolve) {
            cp.exec(cmd, opts, function (error, stdout, stderr) {
                resolve({ error: error ? { message: error.message, code: error.code } : null, stdout: stdout, stderr: stderr });
            });
        });
    },
    "child_process.execSync": function (params) {
        var cmd = params[0];
        var opts = params[1] || { encoding: "utf8" };
        try {
            return cp.execSync(cmd, opts).toString();
        } catch (e) {
            throw new Error(e.stderr ? e.stderr.toString() : e.message);
        }
    },
    "child_process.spawn": function (params) {
        var cmd = params[0];
        var args = params[1] || [];
        var opts = params[2] || {};
        opts.shell = opts.shell !== undefined ? opts.shell : true;
        // Merge env so PATH is preserved (plugins may pass partial env)
        opts.env = Object.assign({}, process.env, opts.env || {});
        return new Promise(function (resolve) {
            var child = cp.spawn(cmd, args, opts);
            var stdout = "";
            var stderr = "";
            child.stdout.on("data", function (d) { stdout += d.toString(); });
            child.stderr.on("data", function (d) { stderr += d.toString(); });
            child.on("close", function (code) {
                resolve({ stdout: stdout, stderr: stderr, code: code });
            });
            child.on("error", function (e) {
                resolve({ stdout: stdout, stderr: stderr + e.message, code: -1, error: e.message });
            });
        });
    },

    // ── os ──
    "os.tmpdir": function () { return os.tmpdir(); },
    "os.homedir": function () { return os.homedir(); },
    "os.platform": function () { return os.platform(); },
    "os.arch": function () { return os.arch(); },
    "os.EOL": function () { return os.EOL; },
    "os.cpus": function () { return os.cpus(); },
    "os.networkInterfaces": function () { return os.networkInterfaces(); },

    // ── process ──
    "process.env": function () { return process.env; },
    "process.cwd": function () { return process.cwd(); },
    "process.platform": function () { return process.platform; },
    "process.arch": function () { return process.arch; },
    "process.version": function () { return process.version; },
    "process.versions": function () { return process.versions; },

    // ── zlib ──
    "zlib.deflateRawSync": function (params) {
        var input = typeof params[0] === "string" ? Buffer.from(params[0]) : params[0];
        return zlib.deflateRawSync(input).toString("base64");
    },
    "zlib.inflateRawSync": function (params) {
        var input = Buffer.from(params[0], "base64");
        return zlib.inflateRawSync(input).toString("utf8");
    },
    "zlib.deflateSync": function (params) {
        var input = typeof params[0] === "string" ? Buffer.from(params[0]) : params[0];
        return zlib.deflateSync(input).toString("base64");
    },
    "zlib.inflateSync": function (params) {
        var input = Buffer.from(params[0], "base64");
        return zlib.inflateSync(input).toString("utf8");
    },

    // ── crypto ──
    "crypto.randomUUID": function () { return crypto.randomUUID(); },

    // ── util ──
    "util.promisify": function () { return null; /* not needed — bridge handles it */ },

    // ── dns (for network detection) ──
    "dns.lookup": function (params) {
        var dns = require("dns");
        return new Promise(function (resolve) {
            dns.lookup(params[0], function (err, address) {
                resolve({ address: address, error: err ? err.message : null });
            });
        });
    },

    // ── net (for proxy detection / basic socket) ──
    "net.connect_check": function (params) {
        var net = require("net");
        return new Promise(function (resolve) {
            var socket = new net.Socket();
            socket.setTimeout(3000);
            socket.on("connect", function () { socket.destroy(); resolve({ ok: true }); });
            socket.on("error", function (e) { resolve({ ok: false, error: e.message }); });
            socket.on("timeout", function () { socket.destroy(); resolve({ ok: false, error: "timeout" }); });
            socket.connect(params[0], params[1]);
        });
    },

    // ── util ──
    "util.which": function (params) {
        var cmd = params[0];
        try {
            var result = cp.execSync("which " + cmd, { encoding: "utf8" }).trim();
            if (result) return result;
        } catch (e) {}
        // Fallback: check common paths
        var paths = [
            "/usr/local/bin/" + cmd,
            "/opt/homebrew/bin/" + cmd,
            "/usr/bin/" + cmd,
            "/bin/" + cmd,
        ];
        for (var i = 0; i < paths.length; i++) {
            try { if (fs.existsSync(paths[i]) && fs.accessSync(paths[i], fs.constants.X_OK) === undefined) return paths[i]; } catch (e) {}
        }
        return null;
    },
    "util.whichSync": function (params) {
        return ROUTES["util.which"](params);
    },
};

// ── server managers (for http.createServer) ──
var dynamicServers = {};
var DYNAMIC_PORT_START = 46000;
var nextDynamicPort = DYNAMIC_PORT_START;

// Health check — no auth required
ROUTES["health"] = function () {
    return {
        status: "ok",
        token: TOKEN,
        version: "2.0.0",
        port: PORT,
        uptime: process.uptime(),
        home: os.homedir(),
        platform: os.platform(),
    };
};

// Dynamic server creation (for remote_control/http server)
ROUTES["http.createServer"] = function (params) {
    // params[0] = { name: string } — identify this server
    // Returns { port: number } — the port the bridge created
    var name = (params[0] && params[0].name) || "dynamic_" + (nextDynamicPort - DYNAMIC_PORT_START);
    if (dynamicServers[name]) {
        return { port: dynamicServers[name].port, name: name };
    }
    var port = nextDynamicPort++;
    var srv = http.createServer(function (srvReq, srvRes) {
        // Collect request data, forward to bridge client via polling
        var body = [];
        srvReq.on("data", function (c) { body.push(c); });
        srvReq.on("end", function () {
            dynamicServers[name].requests = dynamicServers[name].requests || [];
            dynamicServers[name].requests.push({
                id: crypto.randomUUID(),
                method: srvReq.method,
                url: srvReq.url,
                headers: srvReq.headers,
                body: Buffer.concat(body).toString("utf8"),
                time: Date.now(),
            });
            // Keep only last 50 requests
            if (dynamicServers[name].requests.length > 50) {
                dynamicServers[name].requests.shift();
            }
            srvRes.writeHead(200, { "Content-Type": "text/plain" });
            srvRes.end("OK");
        });
    });
    srv.listen(port, "127.0.0.1", function () {
        log("INFO", "Dynamic server '" + name + "' listening on port " + port);
    });
    dynamicServers[name] = { server: srv, port: port, requests: [], responses: {} };
    return { port: port, name: name };
};

ROUTES["http.getRequests"] = function (params) {
    var name = (params[0] && params[0].name) || "";
    var svr = dynamicServers[name];
    if (!svr) return { requests: [] };
    var reqs = svr.requests.splice(0);
    return { requests: reqs };
};

ROUTES["http.sendResponse"] = function (params) {
    var name = params[0].name;
    var reqId = params[0].reqId;
    var response = params[0].response;
    var svr = dynamicServers[name];
    if (!svr) throw new Error("Server not found: " + name);
    svr.responses[reqId] = response;
    return { ok: true };
};

// ── Shell helpers ──
ROUTES["shell.openExternal"] = function (params) {
    var url = params[0];
    cp.exec("open '" + url.replace(/'/g, "'\\''") + "'", function () {});
    return undefined;
};

ROUTES["shell.openPath"] = function (params) {
    var filepath = params[0];
    cp.exec("open -R '" + filepath.replace(/'/g, "'\\''") + "'", function () {});
    return undefined;
};

// ── Stats serializer (Stat objects don't JSON-serialize) ──
function serializeStat(st) {
    if (!st) return null;
    return {
        dev: st.dev, ino: st.ino, mode: st.mode, nlink: st.nlink,
        uid: st.uid, gid: st.gid, rdev: st.rdev, size: st.size,
        blksize: st.blksize, blocks: st.blocks,
        atimeMs: st.atimeMs, mtimeMs: st.mtimeMs, ctimeMs: st.ctimeMs,
        birthtimeMs: st.birthtimeMs,
        isFile: st.isFile(), isDirectory: st.isDirectory(),
        isBlockDevice: st.isBlockDevice(), isCharacterDevice: st.isCharacterDevice(),
        isSymbolicLink: st.isSymbolicLink(), isFIFO: st.isFIFO(),
        isSocket: st.isSocket(),
    };
}

// ── Server ─────────────────────────────────────────────────
var server = http.createServer(function (req, res) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders());
        return res.end();
    }

    // Health check — GET, no auth required
    if (req.method === "GET" && req.url === "/health") {
        return ok(res, ROUTES["health"]());
    }

    // Health check alias
    if (req.method === "GET" && req.url === "/") {
        return ok(res, { message: "Typora Plugin Bridge v2.0.0", health: "/health", api: "POST /api" });
    }

    // API endpoint
    if (req.method === "POST" && req.url === "/api") {
        if (!checkToken(req)) {
            return err(res, "Unauthorized: invalid or missing X-Bridge-Token", 401);
        }
        return parseBody(req).then(function (body) {
            if (!body || !body.method) {
                return err(res, "Missing 'method' in request body", 400);
            }
            var handler = ROUTES[body.method];
            if (!handler) {
                return err(res, "Unknown method: " + body.method, 404);
            }
            try {
                var result = handler(body.params || []);
                if (result && typeof result.then === "function") {
                    return result.then(
                        function (r) { ok(res, r); },
                        function (e) { err(res, e.message || String(e)); }
                    );
                } else {
                    return ok(res, result);
                }
            } catch (e) {
                return err(res, e.message || String(e));
            }
        }).catch(function (e) {
            return err(res, "Internal error: " + (e.message || String(e)));
        });
    }

    // Unknown
    res.writeHead(404, corsHeaders());
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(PORT, "127.0.0.1", function () {
    log("INFO", "Typora Plugin Bridge started on 127.0.0.1:" + PORT);
    log("INFO", "Token: " + TOKEN.substring(0, 8) + "...");
    console.log("Typora Plugin Bridge v2.0.0");
    console.log("Listening on 127.0.0.1:" + PORT);
    console.log("Token: " + TOKEN.substring(0, 8) + "... (full token at " + TOKEN_FILE + ")");
});

// Graceful shutdown
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
    log("INFO", "Shutting down...");
    // Close dynamic servers
    Object.keys(dynamicServers).forEach(function (name) {
        try { dynamicServers[name].server.close(); } catch (e) {}
    });
    server.close(function () {
        process.exit(0);
    });
    setTimeout(function () { process.exit(0); }, 2000);
}
