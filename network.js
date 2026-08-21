"use strict";

// Network capability for the local Node bridge. Keeping this separate from
// the router makes it reusable by PlantUML and future network-backed plugins.
function createFetchHandler(nativeFetch, log) {
    return async function (params) {
        if (typeof nativeFetch !== "function") throw new Error("Node.js 18+ fetch is required");
        var req = params[0] || {};
        var controller = new AbortController();
        var timeout = Number(req.timeout || 0);
        var timer = timeout > 0 ? setTimeout(function () { controller.abort(); }, timeout) : null;
        try {
            var options = Object.assign({}, req.options || {}, { signal: controller.signal });
            if (options.body && typeof options.body !== "string") options.body = String(options.body);
            log("INFO", "fetch " + (options.method || "GET") + " " + req.url + " body=" + String(options.body || "").slice(0, 200));
            var response = await nativeFetch(req.url, options);
            var rawBytes = Buffer.from(await response.arrayBuffer());
            var headers = {};
            response.headers.forEach(function (value, key) { headers[key] = value; });
            log("INFO", "fetch response " + response.status + " " + (headers["content-type"] || ""));
            if (!response.ok) log("ERROR", "fetch response body: " + rawBytes.toString("utf8").slice(0, 500));
            return {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: headers,
                body: rawBytes.toString("base64"),
            };
        } catch (e) {
            log("ERROR", "fetch failed: " + (e && e.stack || e));
            throw e;
        } finally {
            if (timer) clearTimeout(timer);
        }
    };
}

module.exports = { createFetchHandler };
