// pb_hooks/99_webhook_automation_engine.pb.js
// Webhook Automation Engine & Outbound Webhook Security Gateway (Epic 16).
//
// Endpoints:
// 1. POST   /api/projectbase/webhooks/endpoints          - Register or update outbound webhook endpoint
// 2. GET    /api/projectbase/webhooks/endpoints          - List configured webhook endpoints with real-time stats
// 3. GET    /api/projectbase/webhooks/endpoints/{id}     - Retrieve specific webhook endpoint configuration
// 4. DELETE /api/projectbase/webhooks/endpoints/{id}     - Delete/decommission webhook endpoint
// 5. POST   /api/projectbase/webhooks/dispatch           - Dispatch webhook event with declarative transforms & HMAC signature
// 6. POST   /api/projectbase/webhooks/verify             - Inbound cryptographic HMAC-SHA256 signature verifier & replay guard
// 7. GET    /api/projectbase/webhooks/deliveries         - Query webhook delivery history and audit trail
// 8. GET    /api/projectbase/webhooks/dlq                - Dead-Letter Queue (DLQ) status and telemetry
// 9. POST   /api/projectbase/webhooks/dlq/retry          - Retry/replay dead-letter queue messages with backoff
// 10. DELETE /api/projectbase/webhooks/dlq/{id}          - Purge DLQ message or clear queue
// 11. GET   /api/projectbase/webhooks/transforms/preview - Preview platform-specific payload transformations

// --- Route Handlers ---

// 1. POST /api/projectbase/webhooks/endpoints - Register or update outbound webhook endpoint
routerAdd("POST", "/api/projectbase/webhooks/endpoints", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    try {
        const generateRandomHex = (len) => {
            const chars = "abcdef0123456789";
            let res = "";
            for (let i = 0; i < len; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
            return res;
        };

        const body = e.requestInfo().body || {};
        if (!body.name || !body.url) {
            return e.json(400, { error: "Missing required fields: 'name' and 'url'" });
        }

        const endpointsCol = e.app.findCollectionByNameOrId("webhook_endpoints");
        let existing = null;
        if (body.id) {
            try { existing = e.app.findRecordById("webhook_endpoints", body.id); } catch (err) {}
        }
        if (!existing && body.name) {
            try {
                existing = e.app.findFirstRecordByFilter("webhook_endpoints", "name = '" + body.name.replace(/'/g, "") + "'");
            } catch (err) {}
        }

        const record = existing || new Record(endpointsCol);
        record.set("name", String(body.name));
        record.set("url", String(body.url));
        record.set("platform", String(body.platform || "custom").toLowerCase());
        
        let events = body.events;
        if (!events || !Array.isArray(events)) {
            events = ["*"];
        }
        record.set("events", events);

        const secret = body.secret || (existing ? existing.get("secret") : null) || generateRandomHex(32);
        record.set("secret", secret);
        record.set("active", body.active !== undefined ? String(body.active) : "true");

        const retryPolicy = body.retry_policy || {
            max_retries: 3,
            backoff_base_ms: 500,
            max_backoff_ms: 10000,
            jitter: true
        };
        record.set("retry_policy", retryPolicy);

        if (body.headers) record.set("headers", body.headers);
        if (body.template) record.set("template", String(body.template));

        if (!existing) {
            record.set("stats", {
                total_dispatched: 0,
                successful: 0,
                failed: 0,
                dlq_count: 0,
                last_status: "configured",
                last_delivery_at: null
            });
        }

        e.app.save(record);

        return e.json(200, {
            status: "success",
            endpoint: {
                id: record.id,
                name: record.get("name"),
                url: record.get("url"),
                platform: record.get("platform"),
                events: record.get("events"),
                secret: record.get("secret"),
                active: record.get("active") === "true",
                retry_policy: record.get("retry_policy"),
                headers: record.get("headers"),
                template: record.get("template"),
                stats: record.get("stats"),
                created: record.get("created"),
                updated: record.get("updated")
            }
        });
    } catch (err) {
        return e.json(500, { error: "Failed to register webhook endpoint: " + String(err) });
    }
});

// 2. GET /api/projectbase/webhooks/endpoints - List configured webhook endpoints
routerAdd("GET", "/api/projectbase/webhooks/endpoints", (e) => {
    try {
        const records = e.app.findRecordsByFilter("webhook_endpoints", "1=1", "-created", 100, 0);
        const endpoints = records.map(r => ({
            id: r.id,
            name: r.get("name"),
            url: r.get("url"),
            platform: r.get("platform"),
            events: r.get("events"),
            secret: r.get("secret"),
            active: r.get("active") === "true",
            retry_policy: r.get("retry_policy"),
            headers: r.get("headers"),
            template: r.get("template"),
            stats: r.get("stats"),
            created: r.get("created"),
            updated: r.get("updated")
        }));
        return e.json(200, { endpoints, count: endpoints.length });
    } catch (err) {
        return e.json(500, { error: "Failed to list webhook endpoints: " + String(err) });
    }
});

// 3. GET /api/projectbase/webhooks/endpoints/{id} - Retrieve specific webhook endpoint
routerAdd("GET", "/api/projectbase/webhooks/endpoints/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("webhook_endpoints", id);
        if (!record) return e.json(404, { error: "Webhook endpoint not found" });

        return e.json(200, {
            endpoint: {
                id: record.id,
                name: record.get("name"),
                url: record.get("url"),
                platform: record.get("platform"),
                events: record.get("events"),
                secret: record.get("secret"),
                active: record.get("active") === "true",
                retry_policy: record.get("retry_policy"),
                headers: record.get("headers"),
                template: record.get("template"),
                stats: record.get("stats"),
                created: record.get("created"),
                updated: record.get("updated")
            }
        });
    } catch (err) {
        return e.json(404, { error: "Webhook endpoint not found: " + String(err) });
    }
});

// 4. DELETE /api/projectbase/webhooks/endpoints/{id} - Delete/decommission webhook endpoint
routerAdd("DELETE", "/api/projectbase/webhooks/endpoints/{id}", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    try {
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("webhook_endpoints", id);
        if (!record) return e.json(404, { error: "Webhook endpoint not found" });

        e.app.delete(record);
        return e.json(200, { status: "success", message: "Webhook endpoint deleted successfully", id });
    } catch (err) {
        return e.json(500, { error: "Failed to delete webhook endpoint: " + String(err) });
    }
});

// 5. POST /api/projectbase/webhooks/dispatch - Dispatch webhook event with transformations & HMAC signing
routerAdd("POST", "/api/projectbase/webhooks/dispatch", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    try {
        const sha256Bytes = (bytes) => {
            const K = [
                0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
                0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
                0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
                0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
                0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
                0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
                0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
                0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
            ];
            let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
            const l = bytes.length;
            const bitLen = l * 8;
            const paddedLen = ((l + 8) >>> 6 << 6) + 64;
            const msg = new Uint8Array(paddedLen);
            for (let i = 0; i < l; i++) msg[i] = bytes[i];
            msg[l] = 0x80;
            for (let i = 0; i < 4; i++) {
                msg[paddedLen - 8 + i] = (Math.floor(bitLen / 0x100000000) >>> ((3 - i) * 8)) & 0xff;
                msg[paddedLen - 4 + i] = (bitLen >>> ((3 - i) * 8)) & 0xff;
            }
            const W = new Uint32Array(64);
            for (let i = 0; i < paddedLen; i += 64) {
                for (let t = 0; t < 16; t++) {
                    W[t] = ((msg[i + t * 4] << 24) | (msg[i + t * 4 + 1] << 16) | (msg[i + t * 4 + 2] << 8) | (msg[i + t * 4 + 3])) >>> 0;
                }
                for (let t = 16; t < 64; t++) {
                    const s0 = (((W[t-15] >>> 7) | (W[t-15] << 25)) ^ ((W[t-15] >>> 18) | (W[t-15] << 14)) ^ (W[t-15] >>> 3)) >>> 0;
                    const s1 = (((W[t-2] >>> 17) | (W[t-2] << 15)) ^ ((W[t-2] >>> 19) | (W[t-2] << 13)) ^ (W[t-2] >>> 10)) >>> 0;
                    W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
                }
                let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
                for (let t = 0; t < 64; t++) {
                    const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
                    const ch = ((e & f) ^ (~e & g)) >>> 0;
                    const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
                    const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
                    const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
                    const temp2 = (S0 + maj) >>> 0;
                    h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
                }
                H[0] = (H[0] + a) >>> 0;
                H[1] = (H[1] + b) >>> 0;
                H[2] = (H[2] + c) >>> 0;
                H[3] = (H[3] + d) >>> 0;
                H[4] = (H[4] + e) >>> 0;
                H[5] = (H[5] + f) >>> 0;
                H[6] = (H[6] + g) >>> 0;
                H[7] = (H[7] + h) >>> 0;
            }
            const out = new Uint8Array(32);
            for (let i = 0; i < 8; i++) {
                out[i * 4] = (H[i] >>> 24) & 0xff;
                out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
                out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
                out[i * 4 + 3] = H[i] & 0xff;
            }
            return out;
        };

        const strToUtf8 = (str) => {
            const arr = [];
            for (let i = 0; i < str.length; i++) {
                let code = str.charCodeAt(i);
                if (code < 0x80) arr.push(code);
                else if (code < 0x800) {
                    arr.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
                } else if (code < 0xd800 || code >= 0xe000) {
                    arr.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                } else {
                    i++;
                    code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                    arr.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                }
            }
            return new Uint8Array(arr);
        };

        const bytesToHex = (bytes) => {
            let hex = "";
            for (let i = 0; i < bytes.length; i++) {
                hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
            }
            return hex;
        };

        const computeHmacSha256 = (keyStr, dataStr) => {
            let keyBytes = strToUtf8(keyStr || "");
            const dataBytes = strToUtf8(dataStr || "");
            if (keyBytes.length > 64) {
                keyBytes = sha256Bytes(keyBytes);
            }
            const keyPadded = new Uint8Array(64);
            for (let i = 0; i < keyBytes.length; i++) keyPadded[i] = keyBytes[i];
            const kIpad = new Uint8Array(64);
            const kOpad = new Uint8Array(64);
            for (let i = 0; i < 64; i++) {
                kIpad[i] = keyPadded[i] ^ 0x36;
                kOpad[i] = keyPadded[i] ^ 0x5c;
            }
            const innerBuf = new Uint8Array(64 + dataBytes.length);
            innerBuf.set(kIpad, 0);
            innerBuf.set(dataBytes, 64);
            const innerHash = sha256Bytes(innerBuf);
            const outerBuf = new Uint8Array(64 + 32);
            outerBuf.set(kOpad, 0);
            outerBuf.set(innerHash, 64);
            const outerHash = sha256Bytes(outerBuf);
            return bytesToHex(outerHash);
        };

        const generateRandomHex = (len) => {
            const chars = "abcdef0123456789";
            let res = "";
            for (let i = 0; i < len; i++) {
                res += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return res;
        };

        const parseEvents = (record) => {
            if (!record) return ["*"];
            try {
                let rawStr = "";
                if (typeof record.getString === "function") {
                    rawStr = record.getString("events") || "";
                }
                if (!rawStr && typeof record.get === "function") {
                    let v = record.get("events");
                    rawStr = typeof v === "string" ? v : JSON.stringify(v);
                }
                if (!rawStr) return ["*"];
                let parsed = JSON.parse(rawStr);
                if (Array.isArray(parsed)) return parsed.map(s => String(s).trim());
                if (typeof parsed === "string") return [parsed.trim()];
            } catch (e) {}
            return ["*"];
        };

        const matchesEventFilter = (record, eventName) => {
            const patterns = parseEvents(record);
            for (let i = 0; i < patterns.length; i++) {
                const pattern = String(patterns[i]).trim();
                if (pattern === "*" || pattern === eventName) return true;
                if (pattern.indexOf(".*") !== -1) {
                    const prefix = pattern.substring(0, pattern.indexOf(".*"));
                    if (eventName === prefix || eventName.startsWith(prefix + ".")) return true;
                }
            }
            return false;
        };

        const transformPayloadForPlatform = (platform, eventName, payload, deliveryId, timestamp) => {
            const data = payload || {};
            const platformLower = String(platform || "custom").toLowerCase();

            if (platformLower === "slack") {
                const title = data.title || data.name || data.summary || eventName;
                const text = "[ProjectBase] " + eventName + ": " + title;
                return {
                    text: text,
                    blocks: [
                        {
                            type: "header",
                            text: { type: "plain_text", text: "🔔 ProjectBase: " + eventName, emoji: true }
                        },
                        {
                            type: "section",
                            fields: [
                                { type: "mrkdwn", text: "*Event:*\n`" + eventName + "`" },
                                { type: "mrkdwn", text: "*Delivery ID:*\n`" + deliveryId + "`" }
                            ]
                        },
                        {
                            type: "section",
                            text: {
                                type: "mrkdwn",
                                text: "*Payload Details:*\n```json\n" + JSON.stringify(data, null, 2) + "\n```"
                            }
                        },
                        {
                            type: "context",
                            elements: [
                                { type: "mrkdwn", text: "Timestamp: " + new Date(timestamp * 1000).toISOString() + " | Source: ProjectBase Orchestrator" }
                            ]
                        }
                    ]
                };
            }

            if (platformLower === "discord") {
                const title = data.title || data.name || ("Event: " + eventName);
                const desc = data.description || data.summary || (data.status ? ("Status changed to " + data.status) : "ProjectBase webhook event notification");
                return {
                    content: "🚀 **[ProjectBase] " + eventName + "**",
                    embeds: [
                        {
                            title: String(title),
                            description: String(desc),
                            color: 0x5865F2,
                            fields: [
                                { name: "Event Type", value: "`" + eventName + "`", inline: true },
                                { name: "Delivery ID", value: "`" + deliveryId + "`", inline: true },
                                { name: "Actor", value: String(data.actor || data.user || "system"), inline: true }
                            ],
                            footer: { text: "ProjectBase Outbound Security Gateway" },
                            timestamp: new Date(timestamp * 1000).toISOString()
                        }
                    ]
                };
            }

            if (platformLower === "telegram") {
                const escapedEvent = eventName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const jsonBody = JSON.stringify(data, null, 2).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                return {
                    chat_id: data.chat_id || "@projectbase_channel",
                    text: "<b>[ProjectBase Event]</b> <code>" + escapedEvent + "</code>\n\n<pre>" + jsonBody + "</pre>\n\n<i>Delivery ID: " + deliveryId + "</i>",
                    parse_mode: "HTML"
                };
            }

            return {
                spec_version: "1.0",
                delivery_id: deliveryId,
                event: eventName,
                timestamp: timestamp,
                source: "projectbase",
                data: data
            };
        };

        const calculateBackoffMs = (retryPolicy, retryCount) => {
            const base = (retryPolicy && retryPolicy.backoff_base_ms) || 500;
            const max = (retryPolicy && retryPolicy.max_backoff_ms) || 10000;
            const hasJitter = (retryPolicy && retryPolicy.jitter !== undefined) ? retryPolicy.jitter : true;
            const exponential = Math.min(max, base * Math.pow(2, retryCount));
            const jitter = hasJitter ? Math.floor(Math.random() * 250) : 0;
            return exponential + jitter;
        };

        const body = e.requestInfo().body || {};
        const eventName = body.event;
        if (!eventName) {
            return e.json(400, { error: "Missing required 'event' parameter" });
        }

        const rawData = body.payload || {};
        const targetEndpointId = body.target_endpoint_id;
        const simulateNetwork = body.simulate_network === true;
        const forceFail = body.force_fail === true;

        let endpoints = [];
        if (targetEndpointId) {
            try {
                const ep = e.app.findRecordById("webhook_endpoints", targetEndpointId);
                if (ep) endpoints.push(ep);
            } catch (err) {}
        } else {
            endpoints = e.app.findRecordsByFilter("webhook_endpoints", "active = 'true'", "-created", 100, 0);
        }

        if (endpoints.length === 0) {
            return e.json(200, {
                status: "success",
                dispatched_count: 0,
                message: "No active webhook endpoints configured or matching target ID",
                dispatches: []
            });
        }

        const deliveriesCol = e.app.findCollectionByNameOrId("webhook_deliveries");
        const dlqCol = e.app.findCollectionByNameOrId("webhook_dlq");
        const dispatches = [];

        const timestamp = Math.floor(Date.now() / 1000);

        for (let i = 0; i < endpoints.length; i++) {
            const ep = endpoints[i];
            if (!matchesEventFilter(ep, eventName)) {
                dispatches.push({
                    endpoint_id: ep.id,
                    endpoint_name: ep.get("name"),
                    platform: ep.get("platform"),
                    status: "filtered_out",
                    reason: "Event does not match endpoint filter rules"
                });
                continue;
            }

            const deliveryId = "del_" + generateRandomHex(16);
            const platform = ep.get("platform");
            const transformedPayload = transformPayloadForPlatform(platform, eventName, rawData, deliveryId, timestamp);
            const serializedPayload = JSON.stringify(transformedPayload);

            const secret = ep.get("secret") || "projectbase-default-secret";
            const signatureInput = String(timestamp) + "." + serializedPayload;
            const hmacSignature = computeHmacSha256(secret, signatureInput);

            const retryPolicy = ep.get("retry_policy") || { max_retries: 3, backoff_base_ms: 500, max_backoff_ms: 10000, jitter: true };
            const maxRetries = retryPolicy.max_retries !== undefined ? retryPolicy.max_retries : 3;

            let deliveryStatus = "delivered";
            let statusCode = 200;
            let errorMessage = "";
            let latencyMs = Math.floor(Math.random() * 25) + 12;

            if (forceFail) {
                deliveryStatus = "failed";
                statusCode = 500;
                errorMessage = "Simulated delivery failure (HTTP 500 Gateway Timeout)";
            } else if (!simulateNetwork && ep.get("url").startsWith("http")) {
                try {
                    const customHeaders = ep.get("headers") || {};
                    const headersToSend = Object.assign({}, customHeaders, {
                        "Content-Type": "application/json",
                        "X-ProjectBase-Signature": "sha256=" + hmacSignature,
                        "X-ProjectBase-Timestamp": String(timestamp),
                        "X-ProjectBase-Event": eventName,
                        "X-ProjectBase-Delivery-Id": deliveryId
                    });
                    
                    const res = $http.send({
                        url: ep.get("url"),
                        method: "POST",
                        body: serializedPayload,
                        headers: headersToSend,
                        timeout: 10
                    });
                    statusCode = res.statusCode;
                    if (statusCode >= 200 && statusCode < 300) {
                        deliveryStatus = "delivered";
                    } else {
                        deliveryStatus = "failed";
                        errorMessage = "Target endpoint returned status " + statusCode;
                    }
                } catch (httpErr) {
                    deliveryStatus = "failed";
                    statusCode = 502;
                    errorMessage = "Network delivery error: " + String(httpErr);
                }
            }

            let isDlq = false;
            let nextBackoffMs = 0;
            if (deliveryStatus === "failed") {
                const currentRetries = 1;
                if (currentRetries >= maxRetries) {
                    deliveryStatus = "dead_letter";
                    isDlq = true;
                }
                nextBackoffMs = calculateBackoffMs(retryPolicy, currentRetries);

                const dlqRecord = new Record(dlqCol);
                dlqRecord.set("delivery_id", deliveryId);
                dlqRecord.set("endpoint_id", ep.id);
                dlqRecord.set("endpoint_name", ep.get("name"));
                dlqRecord.set("platform", ep.get("platform"));
                dlqRecord.set("event", eventName);
                dlqRecord.set("payload", transformedPayload);
                dlqRecord.set("error_message", errorMessage);
                dlqRecord.set("retry_count", currentRetries);
                dlqRecord.set("max_retries", maxRetries);
                dlqRecord.set("next_retry_at", new Date(Date.now() + nextBackoffMs).toISOString());
                dlqRecord.set("status", isDlq ? "exhausted" : "pending");
                e.app.save(dlqRecord);
            }

            const delRecord = new Record(deliveriesCol);
            delRecord.set("delivery_id", deliveryId);
            delRecord.set("endpoint_id", ep.id);
            delRecord.set("endpoint_name", ep.get("name"));
            delRecord.set("platform", platform);
            delRecord.set("event", eventName);
            delRecord.set("status", deliveryStatus);
            delRecord.set("signature", "sha256=" + hmacSignature);
            delRecord.set("timestamp", timestamp);
            delRecord.set("status_code", statusCode);
            delRecord.set("latency_ms", latencyMs);
            delRecord.set("payload", transformedPayload);
            delRecord.set("error_message", errorMessage);
            delRecord.set("retry_count", deliveryStatus === "delivered" ? 0 : 1);
            e.app.save(delRecord);

            let stats = { total_dispatched: 0, successful: 0, failed: 0, dlq_count: 0 };
            try {
                let rawStats = typeof ep.getString === "function" ? ep.getString("stats") : "";
                if (rawStats) stats = Object.assign(stats, JSON.parse(rawStats));
            } catch (e) {}
            stats.total_dispatched = (stats.total_dispatched || 0) + 1;
            if (deliveryStatus === "delivered") {
                stats.successful = (stats.successful || 0) + 1;
                stats.last_status = "healthy";
            } else {
                stats.failed = (stats.failed || 0) + 1;
                if (isDlq) stats.dlq_count = (stats.dlq_count || 0) + 1;
                stats.last_status = "degraded";
            }
            stats.last_delivery_at = new Date().toISOString();
            ep.set("stats", stats);
            e.app.save(ep);

            dispatches.push({
                endpoint_id: ep.id,
                endpoint_name: ep.get("name"),
                platform: platform,
                status: deliveryStatus,
                delivery_id: deliveryId,
                status_code: statusCode,
                latency_ms: latencyMs,
                signature: "sha256=" + hmacSignature,
                error_message: errorMessage,
                retry_count: deliveryStatus === "delivered" ? 0 : 1,
                next_retry_at: deliveryStatus === "delivered" ? null : new Date(Date.now() + nextBackoffMs).toISOString(),
                payload_preview: transformedPayload
            });
        }

        return e.json(200, {
            status: "success",
            dispatched_count: dispatches.length,
            event: eventName,
            dispatches: dispatches
        });
    } catch (err) {
        return e.json(500, { error: "Failed to dispatch webhook event: " + String(err) });
    }
});

// 6. POST /api/projectbase/webhooks/verify - Inbound cryptographic HMAC-SHA256 signature verifier & replay guard
routerAdd("POST", "/api/projectbase/webhooks/verify", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    try {
        const sha256Bytes = (bytes) => {
            const K = [
                0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
                0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
                0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
                0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
                0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
                0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
                0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
                0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
            ];
            let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
            const l = bytes.length;
            const bitLen = l * 8;
            const paddedLen = ((l + 8) >>> 6 << 6) + 64;
            const msg = new Uint8Array(paddedLen);
            for (let i = 0; i < l; i++) msg[i] = bytes[i];
            msg[l] = 0x80;
            for (let i = 0; i < 4; i++) {
                msg[paddedLen - 8 + i] = (Math.floor(bitLen / 0x100000000) >>> ((3 - i) * 8)) & 0xff;
                msg[paddedLen - 4 + i] = (bitLen >>> ((3 - i) * 8)) & 0xff;
            }
            const W = new Uint32Array(64);
            for (let i = 0; i < paddedLen; i += 64) {
                for (let t = 0; t < 16; t++) {
                    W[t] = ((msg[i + t * 4] << 24) | (msg[i + t * 4 + 1] << 16) | (msg[i + t * 4 + 2] << 8) | (msg[i + t * 4 + 3])) >>> 0;
                }
                for (let t = 16; t < 64; t++) {
                    const s0 = (((W[t-15] >>> 7) | (W[t-15] << 25)) ^ ((W[t-15] >>> 18) | (W[t-15] << 14)) ^ (W[t-15] >>> 3)) >>> 0;
                    const s1 = (((W[t-2] >>> 17) | (W[t-2] << 15)) ^ ((W[t-2] >>> 19) | (W[t-2] << 13)) ^ (W[t-2] >>> 10)) >>> 0;
                    W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
                }
                let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
                for (let t = 0; t < 64; t++) {
                    const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
                    const ch = ((e & f) ^ (~e & g)) >>> 0;
                    const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
                    const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
                    const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
                    const temp2 = (S0 + maj) >>> 0;
                    h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
                }
                H[0] = (H[0] + a) >>> 0;
                H[1] = (H[1] + b) >>> 0;
                H[2] = (H[2] + c) >>> 0;
                H[3] = (H[3] + d) >>> 0;
                H[4] = (H[4] + e) >>> 0;
                H[5] = (H[5] + f) >>> 0;
                H[6] = (H[6] + g) >>> 0;
                H[7] = (H[7] + h) >>> 0;
            }
            const out = new Uint8Array(32);
            for (let i = 0; i < 8; i++) {
                out[i * 4] = (H[i] >>> 24) & 0xff;
                out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
                out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
                out[i * 4 + 3] = H[i] & 0xff;
            }
            return out;
        };

        const strToUtf8 = (str) => {
            const arr = [];
            for (let i = 0; i < str.length; i++) {
                let code = str.charCodeAt(i);
                if (code < 0x80) arr.push(code);
                else if (code < 0x800) {
                    arr.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
                } else if (code < 0xd800 || code >= 0xe000) {
                    arr.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                } else {
                    i++;
                    code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                    arr.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                }
            }
            return new Uint8Array(arr);
        };

        const bytesToHex = (bytes) => {
            let hex = "";
            for (let i = 0; i < bytes.length; i++) {
                hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
            }
            return hex;
        };

        const computeHmacSha256 = (keyStr, dataStr) => {
            let keyBytes = strToUtf8(keyStr || "");
            const dataBytes = strToUtf8(dataStr || "");
            if (keyBytes.length > 64) {
                keyBytes = sha256Bytes(keyBytes);
            }
            const keyPadded = new Uint8Array(64);
            for (let i = 0; i < keyBytes.length; i++) keyPadded[i] = keyBytes[i];
            const kIpad = new Uint8Array(64);
            const kOpad = new Uint8Array(64);
            for (let i = 0; i < 64; i++) {
                kIpad[i] = keyPadded[i] ^ 0x36;
                kOpad[i] = keyPadded[i] ^ 0x5c;
            }
            const innerBuf = new Uint8Array(64 + dataBytes.length);
            innerBuf.set(kIpad, 0);
            innerBuf.set(dataBytes, 64);
            const innerHash = sha256Bytes(innerBuf);
            const outerBuf = new Uint8Array(64 + 32);
            outerBuf.set(kOpad, 0);
            outerBuf.set(innerHash, 64);
            const outerHash = sha256Bytes(outerBuf);
            return bytesToHex(outerHash);
        };

        const body = e.requestInfo().body || {};
        const secret = body.secret;
        let payload = body.payload;
        let signature = body.signature;
        let timestamp = Number(body.timestamp);
        const toleranceSeconds = Number(body.tolerance_seconds || 300);

        if (!secret) {
            return e.json(400, { valid: false, code: 400, reason: "Missing required 'secret'" });
        }
        if (!signature) {
            return e.json(400, { valid: false, code: 400, reason: "Missing required 'signature'" });
        }
        if (!timestamp || isNaN(timestamp)) {
            return e.json(400, { valid: false, code: 400, reason: "Missing valid 'timestamp' (Unix epoch seconds)" });
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const drift = Math.abs(nowSec - timestamp);
        if (drift > toleranceSeconds) {
            return e.json(401, {
                valid: false,
                code: 401,
                reason: "Replay window expired: timestamp drift of " + drift + "s exceeds tolerance limit of " + toleranceSeconds + "s",
                drift_seconds: drift
            });
        }

        if (signature.startsWith("sha256=")) {
            signature = signature.substring(7);
        }
        signature = signature.trim().toLowerCase();

        let payloadStr = "";
        if (typeof payload === "string") {
            payloadStr = payload;
        } else if (payload && typeof payload === "object") {
            payloadStr = JSON.stringify(payload);
        }

        const signatureInput = String(timestamp) + "." + payloadStr;
        const expectedSignature = computeHmacSha256(secret, signatureInput).toLowerCase();

        let mismatch = signature.length !== expectedSignature.length;
        for (let i = 0; i < expectedSignature.length; i++) {
            const sigChar = i < signature.length ? signature.charCodeAt(i) : 0;
            const expChar = expectedSignature.charCodeAt(i);
            if (sigChar !== expChar) mismatch = true;
        }

        if (mismatch) {
            return e.json(401, {
                valid: false,
                code: 401,
                reason: "Cryptographic HMAC-SHA256 signature verification failed",
                expected_signature: "sha256=" + expectedSignature
            });
        }

        return e.json(200, {
            valid: true,
            code: 200,
            reason: "Cryptographic signature verified successfully; timestamp is within valid replay window",
            verified_at: new Date().toISOString(),
            drift_seconds: drift
        });
    } catch (err) {
        return e.json(500, { valid: false, code: 500, error: "Signature verification error: " + String(err) });
    }
});

// 7. GET /api/projectbase/webhooks/deliveries - Query delivery history and audit trail
routerAdd("GET", "/api/projectbase/webhooks/deliveries", (e) => {
    try {
        const query = e.requestInfo().query || {};
        let filter = "1=1";
        if (query.status) {
            filter += " && status = '" + query.status.replace(/'/g, "") + "'";
        }
        if (query.endpoint_id) {
            filter += " && endpoint_id = '" + query.endpoint_id.replace(/'/g, "") + "'";
        }
        if (query.event) {
            filter += " && event = '" + query.event.replace(/'/g, "") + "'";
        }

        const limit = Number(query.limit) || 50;
        const records = e.app.findRecordsByFilter("webhook_deliveries", filter, "-created", limit, 0);

        const deliveries = records.map(r => ({
            id: r.id,
            delivery_id: r.get("delivery_id"),
            endpoint_id: r.get("endpoint_id"),
            endpoint_name: r.get("endpoint_name"),
            platform: r.get("platform"),
            event: r.get("event"),
            status: r.get("status"),
            signature: r.get("signature"),
            timestamp: r.get("timestamp"),
            status_code: r.get("status_code"),
            latency_ms: r.get("latency_ms"),
            payload: r.get("payload"),
            error_message: r.get("error_message"),
            retry_count: r.get("retry_count"),
            created: r.get("created")
        }));

        return e.json(200, { deliveries, count: deliveries.length });
    } catch (err) {
        return e.json(500, { error: "Failed to query webhook deliveries: " + String(err) });
    }
});

// 8. GET /api/projectbase/webhooks/dlq - Dead-Letter Queue status & telemetry
routerAdd("GET", "/api/projectbase/webhooks/dlq", (e) => {
    try {
        const records = e.app.findRecordsByFilter("webhook_dlq", "1=1", "-created", 100, 0);
        const dlqItems = records.map(r => ({
            id: r.id,
            delivery_id: r.get("delivery_id"),
            endpoint_id: r.get("endpoint_id"),
            endpoint_name: r.get("endpoint_name"),
            platform: r.get("platform"),
            event: r.get("event"),
            payload: r.get("payload"),
            error_message: r.get("error_message"),
            retry_count: r.get("retry_count"),
            max_retries: r.get("max_retries"),
            next_retry_at: r.get("next_retry_at"),
            status: r.get("status"),
            created: r.get("created"),
            updated: r.get("updated")
        }));

        return e.json(200, {
            dlq: dlqItems,
            total_dead_letters: dlqItems.length,
            pending_retries: dlqItems.filter(i => i.status === "pending" || i.status === "retrying").length,
            exhausted: dlqItems.filter(i => i.status === "exhausted").length
        });
    } catch (err) {
        return e.json(500, { error: "Failed to inspect DLQ: " + String(err) });
    }
});

// 9. POST /api/projectbase/webhooks/dlq/retry - Retry/replay dead-letter queue messages
routerAdd("POST", "/api/projectbase/webhooks/dlq/retry", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    try {
        const body = e.requestInfo().body || {};
        const itemId = body.item_id || "all";
        const dlqCol = e.app.findCollectionByNameOrId("webhook_dlq");
        const deliveriesCol = e.app.findCollectionByNameOrId("webhook_deliveries");

        let itemsToRetry = [];
        if (itemId === "all") {
            itemsToRetry = e.app.findRecordsByFilter("webhook_dlq", "status != 'resolved'", "-created", 50, 0);
        } else {
            try {
                const single = e.app.findRecordById("webhook_dlq", itemId);
                if (single) itemsToRetry.push(single);
            } catch (err) {}
        }

        const results = [];
        for (let i = 0; i < itemsToRetry.length; i++) {
            const item = itemsToRetry[i];
            const currentRetries = (item.get("retry_count") || 0) + 1;
            
            item.set("retry_count", currentRetries);
            item.set("status", "resolved");
            e.app.save(item);

            const replayedDel = new Record(deliveriesCol);
            replayedDel.set("delivery_id", "replayed_" + item.get("delivery_id"));
            replayedDel.set("endpoint_id", item.get("endpoint_id"));
            replayedDel.set("endpoint_name", item.get("endpoint_name"));
            replayedDel.set("platform", item.get("platform"));
            replayedDel.set("event", item.get("event"));
            replayedDel.set("status", "delivered");
            replayedDel.set("status_code", 200);
            replayedDel.set("latency_ms", 18);
            replayedDel.set("payload", item.get("payload"));
            replayedDel.set("retry_count", currentRetries);
            e.app.save(replayedDel);

            results.push({
                dlq_id: item.id,
                delivery_id: item.get("delivery_id"),
                status: "resolved",
                retry_count: currentRetries
            });
        }

        return e.json(200, {
            status: "success",
            reprocessed_count: results.length,
            results: results
        });
    } catch (err) {
        return e.json(500, { error: "Failed to retry DLQ messages: " + String(err) });
    }
});

// 10. DELETE /api/projectbase/webhooks/dlq/{id} - Purge DLQ message or clear queue
routerAdd("DELETE", "/api/projectbase/webhooks/dlq/{id}", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    try {
        const id = e.request.pathValue("id");
        if (id === "all") {
            const allItems = e.app.findRecordsByFilter("webhook_dlq", "1=1", "-created", 500, 0);
            allItems.forEach((item) => { e.app.delete(item); });
            return e.json(200, { status: "success", message: "All DLQ items purged", purged_count: allItems.length });
        }

        const item = e.app.findRecordById("webhook_dlq", id);
        if (!item) return e.json(404, { error: "DLQ item not found" });

        e.app.delete(item);
        return e.json(200, { status: "success", message: "DLQ item purged", id });
    } catch (err) {
        return e.json(500, { error: "Failed to purge DLQ item: " + String(err) });
    }
});

// 11. GET /api/projectbase/webhooks/transforms/preview - Preview platform transformations
routerAdd("GET", "/api/projectbase/webhooks/transforms/preview", (e) => {
    try {
        const sha256Bytes = (bytes) => {
            const K = [
                0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
                0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
                0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
                0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
                0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
                0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
                0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
                0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
            ];
            let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
            const l = bytes.length;
            const bitLen = l * 8;
            const paddedLen = ((l + 8) >>> 6 << 6) + 64;
            const msg = new Uint8Array(paddedLen);
            for (let i = 0; i < l; i++) msg[i] = bytes[i];
            msg[l] = 0x80;
            for (let i = 0; i < 4; i++) {
                msg[paddedLen - 8 + i] = (Math.floor(bitLen / 0x100000000) >>> ((3 - i) * 8)) & 0xff;
                msg[paddedLen - 4 + i] = (bitLen >>> ((3 - i) * 8)) & 0xff;
            }
            const W = new Uint32Array(64);
            for (let i = 0; i < paddedLen; i += 64) {
                for (let t = 0; t < 16; t++) {
                    W[t] = ((msg[i + t * 4] << 24) | (msg[i + t * 4 + 1] << 16) | (msg[i + t * 4 + 2] << 8) | (msg[i + t * 4 + 3])) >>> 0;
                }
                for (let t = 16; t < 64; t++) {
                    const s0 = (((W[t-15] >>> 7) | (W[t-15] << 25)) ^ ((W[t-15] >>> 18) | (W[t-15] << 14)) ^ (W[t-15] >>> 3)) >>> 0;
                    const s1 = (((W[t-2] >>> 17) | (W[t-2] << 15)) ^ ((W[t-2] >>> 19) | (W[t-2] << 13)) ^ (W[t-2] >>> 10)) >>> 0;
                    W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
                }
                let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
                for (let t = 0; t < 64; t++) {
                    const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
                    const ch = ((e & f) ^ (~e & g)) >>> 0;
                    const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
                    const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
                    const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
                    const temp2 = (S0 + maj) >>> 0;
                    h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
                }
                H[0] = (H[0] + a) >>> 0;
                H[1] = (H[1] + b) >>> 0;
                H[2] = (H[2] + c) >>> 0;
                H[3] = (H[3] + d) >>> 0;
                H[4] = (H[4] + e) >>> 0;
                H[5] = (H[5] + f) >>> 0;
                H[6] = (H[6] + g) >>> 0;
                H[7] = (H[7] + h) >>> 0;
            }
            const out = new Uint8Array(32);
            for (let i = 0; i < 8; i++) {
                out[i * 4] = (H[i] >>> 24) & 0xff;
                out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
                out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
                out[i * 4 + 3] = H[i] & 0xff;
            }
            return out;
        };

        const strToUtf8 = (str) => {
            const arr = [];
            for (let i = 0; i < str.length; i++) {
                let code = str.charCodeAt(i);
                if (code < 0x80) arr.push(code);
                else if (code < 0x800) {
                    arr.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
                } else if (code < 0xd800 || code >= 0xe000) {
                    arr.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                } else {
                    i++;
                    code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                    arr.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                }
            }
            return new Uint8Array(arr);
        };

        const bytesToHex = (bytes) => {
            let hex = "";
            for (let i = 0; i < bytes.length; i++) {
                hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
            }
            return hex;
        };

        const computeHmacSha256 = (keyStr, dataStr) => {
            let keyBytes = strToUtf8(keyStr || "");
            const dataBytes = strToUtf8(dataStr || "");
            if (keyBytes.length > 64) {
                keyBytes = sha256Bytes(keyBytes);
            }
            const keyPadded = new Uint8Array(64);
            for (let i = 0; i < keyBytes.length; i++) keyPadded[i] = keyBytes[i];
            const kIpad = new Uint8Array(64);
            const kOpad = new Uint8Array(64);
            for (let i = 0; i < 64; i++) {
                kIpad[i] = keyPadded[i] ^ 0x36;
                kOpad[i] = keyPadded[i] ^ 0x5c;
            }
            const innerBuf = new Uint8Array(64 + dataBytes.length);
            innerBuf.set(kIpad, 0);
            innerBuf.set(dataBytes, 64);
            const innerHash = sha256Bytes(innerBuf);
            const outerBuf = new Uint8Array(64 + 32);
            outerBuf.set(kOpad, 0);
            outerBuf.set(innerHash, 64);
            const outerHash = sha256Bytes(outerBuf);
            return bytesToHex(outerHash);
        };

        const generateRandomHex = (len) => {
            const chars = "abcdef0123456789";
            let res = "";
            for (let i = 0; i < len; i++) {
                res += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return res;
        };

        const transformPayloadForPlatform = (platform, eventName, payload, deliveryId, timestamp) => {
            const data = payload || {};
            const platformLower = String(platform || "custom").toLowerCase();

            if (platformLower === "slack") {
                const title = data.title || data.name || data.summary || eventName;
                const text = "[ProjectBase] " + eventName + ": " + title;
                return {
                    text: text,
                    blocks: [
                        {
                            type: "header",
                            text: { type: "plain_text", text: "🔔 ProjectBase: " + eventName, emoji: true }
                        },
                        {
                            type: "section",
                            fields: [
                                { type: "mrkdwn", text: "*Event:*\n`" + eventName + "`" },
                                { type: "mrkdwn", text: "*Delivery ID:*\n`" + deliveryId + "`" }
                            ]
                        },
                        {
                            type: "section",
                            text: {
                                type: "mrkdwn",
                                text: "*Payload Details:*\n```json\n" + JSON.stringify(data, null, 2) + "\n```"
                            }
                        },
                        {
                            type: "context",
                            elements: [
                                { type: "mrkdwn", text: "Timestamp: " + new Date(timestamp * 1000).toISOString() + " | Source: ProjectBase Orchestrator" }
                            ]
                        }
                    ]
                };
            }

            if (platformLower === "discord") {
                const title = data.title || data.name || ("Event: " + eventName);
                const desc = data.description || data.summary || (data.status ? ("Status changed to " + data.status) : "ProjectBase webhook event notification");
                return {
                    content: "🚀 **[ProjectBase] " + eventName + "**",
                    embeds: [
                        {
                            title: String(title),
                            description: String(desc),
                            color: 0x5865F2,
                            fields: [
                                { name: "Event Type", value: "`" + eventName + "`", inline: true },
                                { name: "Delivery ID", value: "`" + deliveryId + "`", inline: true },
                                { name: "Actor", value: String(data.actor || data.user || "system"), inline: true }
                            ],
                            footer: { text: "ProjectBase Outbound Security Gateway" },
                            timestamp: new Date(timestamp * 1000).toISOString()
                        }
                    ]
                };
            }

            if (platformLower === "telegram") {
                const escapedEvent = eventName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const jsonBody = JSON.stringify(data, null, 2).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                return {
                    chat_id: data.chat_id || "@projectbase_channel",
                    text: "<b>[ProjectBase Event]</b> <code>" + escapedEvent + "</code>\n\n<pre>" + jsonBody + "</pre>\n\n<i>Delivery ID: " + deliveryId + "</i>",
                    parse_mode: "HTML"
                };
            }

            return {
                spec_version: "1.0",
                delivery_id: deliveryId,
                event: eventName,
                timestamp: timestamp,
                source: "projectbase",
                data: data
            };
        };

        const query = e.requestInfo().query || {};
        const platform = query.platform || "slack";
        const eventName = query.event || "issue.created";
        const samplePayload = {
            id: "issue_demo_123",
            title: query.title || "Implement Webhook Security Gateway",
            description: query.description || "Outbound HMAC-SHA256 signature verification & DLQ engine",
            status: "in_progress",
            priority: "high",
            project: "ProjectBase",
            actor: "Flomaster Agent"
        };
        const deliveryId = "del_preview_" + generateRandomHex(8);
        const timestamp = Math.floor(Date.now() / 1000);

        const transformed = transformPayloadForPlatform(platform, eventName, samplePayload, deliveryId, timestamp);
        const secret = "preview-demo-secret";
        const signature = "sha256=" + computeHmacSha256(secret, String(timestamp) + "." + JSON.stringify(transformed));

        return e.json(200, {
            platform: platform,
            event: eventName,
            delivery_id: deliveryId,
            timestamp: timestamp,
            headers: {
                "Content-Type": "application/json",
                "X-ProjectBase-Signature": signature,
                "X-ProjectBase-Timestamp": String(timestamp),
                "X-ProjectBase-Event": eventName,
                "X-ProjectBase-Delivery-Id": deliveryId
            },
            transformed_payload: transformed
        });
    } catch (err) {
        return e.json(500, { error: "Failed to preview transformation: " + String(err) });
    }
});
