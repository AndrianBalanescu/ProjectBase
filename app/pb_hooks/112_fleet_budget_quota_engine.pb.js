// ProjectBase Hook 112 — Agent Fleet Budget & Cost Attribution, Token Quota Enforcement & Financial Governance Hub (Milestone 7 / Epic 28).
//
// Exposes high-performance REST APIs for multi-agent cost allocation, budget policy enforcement,
// pre-flight token quota reservations, and real-time transaction ledger tracking across models, providers, and personas:
// 1.  POST   /api/projectbase/billing/policies                    - Create or update budget policy
// 2.  GET    /api/projectbase/billing/policies                    - List all budget policies with spend metrics
// 3.  GET    /api/projectbase/billing/policies/{id}               - Get single policy details and active overrides
// 4.  DELETE /api/projectbase/billing/policies/{id}               - Delete a budget policy
// 5.  POST   /api/projectbase/billing/quotas/check                - Pre-flight budget & token availability check
// 6.  POST   /api/projectbase/billing/quotas/reserve              - Reserve in-flight token capacity
// 7.  POST   /api/projectbase/billing/quotas/release              - Release reserved token capacity
// 8.  POST   /api/projectbase/billing/usage/record                - Ingest actual token usage, calculate cost, update ledgers
// 9.  POST   /api/projectbase/billing/overrides/grant             - Grant emergency budget / token override
// 10. GET    /api/projectbase/billing/analytics                   - Fleet-wide spending & token analytics breakdown
// 11. GET    /api/projectbase/billing/ledger                      - Query cost ledger entries with filtering
// 12. GET    /api/projectbase/billing/pricing                     - Get model pricing matrix
// 13. POST   /api/projectbase/billing/circuit-breaker/reset       - Reset tripped circuit breaker

// 1. POST /api/projectbase/billing/policies
routerAdd("POST", "/api/projectbase/billing/policies", (e) => {
    try {
        let body = {};
        try { body = e.requestInfo().body || {}; } catch (err) {}

        const name = body.name ? String(body.name).trim() : "";
        if (!name) {
            return e.json(400, { error: "Missing required field: name" });
        }

        const scopeType = body.scope_type || "global";
        const scopeId = body.scope_id ? String(body.scope_id).trim() : "";
        const maxBudget = Number(body.max_budget_usd) >= 0 ? Number(body.max_budget_usd) : 50.0;
        const maxTokens = Number(body.max_tokens) >= 0 ? Number(body.max_tokens) : 10000000;
        const period = body.period || "daily";
        const softLimitPct = Number(body.soft_limit_pct) > 0 ? Number(body.soft_limit_pct) : 80;
        const hardLimitAction = body.hard_limit_action || "block";

        let policyRec = null;
        if (body.id) {
            try {
                policyRec = e.app.findRecordById("budget_policies", String(body.id));
            } catch (x) {}
        }

        if (!policyRec) {
            const col = e.app.findCollectionByNameOrId("budget_policies");
            policyRec = new Record(col);
            policyRec.set("current_spend_usd", 0);
            policyRec.set("current_tokens", 0);
            policyRec.set("status", "active");
            policyRec.set("last_reset_at", new Date().toISOString());
        }

        policyRec.set("name", name);
        policyRec.set("scope_type", scopeType);
        policyRec.set("scope_id", scopeId);
        policyRec.set("max_budget_usd", maxBudget);
        policyRec.set("max_tokens", maxTokens);
        policyRec.set("period", period);
        policyRec.set("soft_limit_pct", softLimitPct);
        policyRec.set("hard_limit_action", hardLimitAction);

        e.app.save(policyRec);

        return e.json(200, {
            success: true,
            policy: {
                id: policyRec.id,
                name: policyRec.get("name"),
                scope_type: policyRec.get("scope_type"),
                scope_id: policyRec.get("scope_id"),
                max_budget_usd: policyRec.get("max_budget_usd"),
                max_tokens: policyRec.get("max_tokens"),
                period: policyRec.get("period"),
                soft_limit_pct: policyRec.get("soft_limit_pct"),
                hard_limit_action: policyRec.get("hard_limit_action"),
                current_spend_usd: policyRec.get("current_spend_usd"),
                current_tokens: policyRec.get("current_tokens"),
                status: policyRec.get("status"),
                created: policyRec.get("created")
            }
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 2. GET /api/projectbase/billing/policies
routerAdd("GET", "/api/projectbase/billing/policies", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const scopeType = query.scope_type || "";
        const scopeId = query.scope_id || "";
        const status = query.status || "";

        let filter = "1 = 1";
        const params = {};

        if (scopeType) {
            filter += " && scope_type = {:st}";
            params.st = scopeType;
        }
        if (scopeId) {
            filter += " && scope_id = {:sid}";
            params.sid = scopeId;
        }
        if (status) {
            filter += " && status = {:stt}";
            params.stt = status;
        }

        let policies = [];
        try {
            policies = e.app.findRecordsByFilter("budget_policies", filter, "-created", 100, 0, params);
        } catch (err) {}

        const result = policies.map(p => {
            const maxBudget = Number(p.get("max_budget_usd")) || 0;
            const currentSpend = Number(p.get("current_spend_usd")) || 0;
            const maxTokens = Number(p.get("max_tokens")) || 0;
            const currentTokens = Number(p.get("current_tokens")) || 0;
            const spendPct = maxBudget > 0 ? (currentSpend / maxBudget) * 100 : 0;
            const tokenPct = maxTokens > 0 ? (currentTokens / maxTokens) * 100 : 0;

            return {
                id: p.id,
                name: p.get("name"),
                scope_type: p.get("scope_type"),
                scope_id: p.get("scope_id"),
                max_budget_usd: maxBudget,
                max_tokens: maxTokens,
                period: p.get("period"),
                soft_limit_pct: p.get("soft_limit_pct") || 80,
                hard_limit_action: p.get("hard_limit_action") || "block",
                current_spend_usd: currentSpend,
                current_tokens: currentTokens,
                spend_pct: Number(spendPct.toFixed(2)),
                token_pct: Number(tokenPct.toFixed(2)),
                status: p.get("status"),
                created: p.get("created"),
                updated: p.get("updated")
            };
        });

        return e.json(200, { policies: result, count: result.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 3. GET /api/projectbase/billing/policies/{id}
routerAdd("GET", "/api/projectbase/billing/policies/{id}", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let p = null;
        try {
            p = e.app.findRecordById("budget_policies", id);
        } catch (err) {
            return e.json(404, { error: "Budget policy not found" });
        }

        let overrides = [];
        try {
            overrides = e.app.findRecordsByFilter("budget_overrides", "policy_id = {:pid} && status = 'active'", "-created", 10, 0, { pid: id });
        } catch (x) {}

        const maxBudget = Number(p.get("max_budget_usd")) || 0;
        const currentSpend = Number(p.get("current_spend_usd")) || 0;
        const maxTokens = Number(p.get("max_tokens")) || 0;
        const currentTokens = Number(p.get("current_tokens")) || 0;

        let totalOverrideBudget = 0;
        let totalOverrideTokens = 0;
        overrides.forEach(o => {
            totalOverrideBudget += Number(o.get("additional_budget")) || 0;
            totalOverrideTokens += Number(o.get("additional_tokens")) || 0;
        });

        const effectiveBudget = maxBudget + totalOverrideBudget;
        const effectiveTokens = maxTokens + totalOverrideTokens;

        return e.json(200, {
            id: p.id,
            name: p.get("name"),
            scope_type: p.get("scope_type"),
            scope_id: p.get("scope_id"),
            max_budget_usd: maxBudget,
            max_tokens: maxTokens,
            effective_budget_usd: effectiveBudget,
            effective_tokens: effectiveTokens,
            period: p.get("period"),
            soft_limit_pct: p.get("soft_limit_pct"),
            hard_limit_action: p.get("hard_limit_action"),
            current_spend_usd: currentSpend,
            current_tokens: currentTokens,
            remaining_budget_usd: Number(Math.max(0, effectiveBudget - currentSpend).toFixed(4)),
            remaining_tokens: Math.max(0, effectiveTokens - currentTokens),
            status: p.get("status"),
            overrides: overrides.map(o => ({
                id: o.id,
                granted_by: o.get("granted_by"),
                additional_budget: o.get("additional_budget"),
                additional_tokens: o.get("additional_tokens"),
                expires_at: o.get("expires_at"),
                reason: o.get("reason"),
                status: o.get("status")
            })),
            created: p.get("created"),
            updated: p.get("updated")
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 4. DELETE /api/projectbase/billing/policies/{id}
routerAdd("DELETE", "/api/projectbase/billing/policies/{id}", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        try {
            const p = e.app.findRecordById("budget_policies", id);
            e.app.delete(p);
            return e.json(200, { success: true, deleted: id });
        } catch (err) {
            return e.json(404, { error: "Budget policy not found" });
        }
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 5. POST /api/projectbase/billing/quotas/check
routerAdd("POST", "/api/projectbase/billing/quotas/check", (e) => {
    try {
        const pricingTable = {
            "claude-3-5-sonnet": { prompt: 3.00, completion: 15.00, cached: 0.30, reasoning: 15.00, provider: "anthropic" },
            "claude-3-opus": { prompt: 15.00, completion: 75.00, cached: 1.50, reasoning: 75.00, provider: "anthropic" },
            "claude-3-5-haiku": { prompt: 0.80, completion: 4.00, cached: 0.08, reasoning: 4.00, provider: "anthropic" },
            "gpt-4o": { prompt: 2.50, completion: 10.00, cached: 1.25, reasoning: 10.00, provider: "openai" },
            "gpt-4o-mini": { prompt: 0.15, completion: 0.60, cached: 0.075, reasoning: 0.60, provider: "openai" },
            "o1": { prompt: 15.00, completion: 60.00, cached: 7.50, reasoning: 60.00, provider: "openai" },
            "o3-mini": { prompt: 1.10, completion: 4.40, cached: 0.55, reasoning: 4.40, provider: "openai" },
            "deepseek-v3": { prompt: 0.14, completion: 0.28, cached: 0.014, reasoning: 0.28, provider: "deepseek" },
            "deepseek-chat": { prompt: 0.14, completion: 0.28, cached: 0.014, reasoning: 0.28, provider: "deepseek" },
            "deepseek-r1": { prompt: 0.55, completion: 2.19, cached: 0.14, reasoning: 2.19, provider: "deepseek" },
            "deepseek-reasoner": { prompt: 0.55, completion: 2.19, cached: 0.14, reasoning: 2.19, provider: "deepseek" },
            "gemini-2.0-flash": { prompt: 0.10, completion: 0.40, cached: 0.025, reasoning: 0.40, provider: "google" },
            "gemini-1.5-pro": { prompt: 1.25, completion: 5.00, cached: 0.3125, reasoning: 5.00, provider: "google" },
            "omniroute/premium": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "omniroute/vision": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "premium": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "vision": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "local": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "local" }
        };

        let body = {};
        try { body = e.requestInfo().body || {}; } catch (err) {}

        const sessionId = body.session_id ? String(body.session_id).trim() : "";
        const projectId = body.project_id ? String(body.project_id).trim() : "";
        const persona = body.persona ? String(body.persona).trim() : "";
        const model = body.model ? String(body.model).trim() : "claude-3-5-sonnet";
        const estimatedPrompt = Number(body.estimated_prompt_tokens) || 2000;
        const estimatedCompletion = Number(body.estimated_completion_tokens) || 1000;
        const estimatedTotal = estimatedPrompt + estimatedCompletion;

        // Calc cost
        let rates = { prompt: 1.00, completion: 3.00, cached: 0.20, reasoning: 3.00, provider: "custom" };
        const normModel = model.toLowerCase();
        for (let k in pricingTable) {
            if (normModel === k || normModel.indexOf(k) !== -1 || k.indexOf(normModel) !== -1) {
                rates = pricingTable[k];
                break;
            }
        }
        const estimatedCost = Number(((estimatedPrompt / 1000000) * rates.prompt + (estimatedCompletion / 1000000) * rates.completion).toFixed(6));

        // Find applicable policies
        let policies = [];
        try {
            policies = e.app.findRecordsByFilter("budget_policies", "status != 'paused'", "-created", 50, 0);
        } catch (x) {}

        let allowed = true;
        let action = "allow";
        const warnings = [];
        let minRemainingBudget = Infinity;
        let minRemainingTokens = Infinity;

        for (const p of policies) {
            const scopeType = p.get("scope_type");
            const scopeId = p.get("scope_id");

            let matches = false;
            if (scopeType === "global") matches = true;
            else if (scopeType === "project" && projectId && (scopeId === projectId || !scopeId)) matches = true;
            else if (scopeType === "persona" && persona && (scopeId.toLowerCase() === persona.toLowerCase())) matches = true;
            else if (scopeType === "session" && sessionId && (scopeId === sessionId)) matches = true;

            if (matches) {
                const maxBudget = Number(p.get("max_budget_usd")) || 0;
                const currentSpend = Number(p.get("current_spend_usd")) || 0;
                const maxTokens = Number(p.get("max_tokens")) || 0;
                const currentTokens = Number(p.get("current_tokens")) || 0;
                const softLimitPct = Number(p.get("soft_limit_pct")) || 80;
                const hardLimitAction = p.get("hard_limit_action") || "block";

                // Check overrides
                let overrideBudget = 0;
                let overrideTokens = 0;
                try {
                    const ovs = e.app.findRecordsByFilter("budget_overrides", "policy_id = {:pid} && status = 'active'", "-created", 10, 0, { pid: p.id });
                    ovs.forEach(o => {
                        overrideBudget += Number(o.get("additional_budget")) || 0;
                        overrideTokens += Number(o.get("additional_tokens")) || 0;
                    });
                } catch (ox) {}

                const effectiveBudget = maxBudget + overrideBudget;
                const effectiveTokens = maxTokens + overrideTokens;

                const remBudget = Math.max(0, effectiveBudget - currentSpend);
                const remTokens = Math.max(0, effectiveTokens - currentTokens);

                if (remBudget < minRemainingBudget) minRemainingBudget = remBudget;
                if (remTokens < minRemainingTokens) minRemainingTokens = remTokens;

                // Check soft limit
                if (effectiveBudget > 0 && ((currentSpend + estimatedCost) / effectiveBudget) * 100 >= softLimitPct) {
                    warnings.push("Policy '" + p.get("name") + "' is at " + (((currentSpend + estimatedCost) / effectiveBudget) * 100).toFixed(1) + "% of budget threshold (" + softLimitPct + "%)");
                }

                // Check hard limit
                if ((effectiveBudget > 0 && (currentSpend + estimatedCost) > effectiveBudget) ||
                    (effectiveTokens > 0 && (currentTokens + estimatedTotal) > effectiveTokens)) {
                    allowed = false;
                    action = hardLimitAction;
                    warnings.push("Policy '" + p.get("name") + "' exceeded hard limit. Action: " + hardLimitAction);
                    break;
                }
            }
        }

        return e.json(200, {
            allowed: allowed,
            action: action,
            model: model,
            estimated_cost_usd: estimatedCost,
            estimated_tokens: estimatedTotal,
            remaining_budget_usd: minRemainingBudget === Infinity ? 999999 : Number(minRemainingBudget.toFixed(4)),
            remaining_tokens: minRemainingTokens === Infinity ? 999999999 : minRemainingTokens,
            warnings: warnings
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 6. POST /api/projectbase/billing/quotas/reserve
routerAdd("POST", "/api/projectbase/billing/quotas/reserve", (e) => {
    try {
        let body = {};
        try { body = e.requestInfo().body || {}; } catch (err) {}

        const scopeType = body.scope_type || "session";
        const scopeId = body.scope_id || body.session_id || "default";
        const tokensToReserve = Number(body.tokens) || Number(body.tokens_to_reserve) || 10000;

        let quotaRec = null;
        try {
            quotaRec = e.app.findFirstRecordByFilter("token_quotas", "scope_type = {:st} && scope_id = {:sid}", { st: scopeType, sid: String(scopeId) });
        } catch (x) {}

        if (!quotaRec) {
            const col = e.app.findCollectionByNameOrId("token_quotas");
            quotaRec = new Record(col);
            quotaRec.set("scope_type", scopeType);
            quotaRec.set("scope_id", String(scopeId));
            quotaRec.set("allocated_tokens", 1000000);
            quotaRec.set("consumed_prompt", 0);
            quotaRec.set("consumed_completion", 0);
            quotaRec.set("consumed_cached", 0);
            quotaRec.set("consumed_reasoning", 0);
            quotaRec.set("reserved_tokens", 0);
            quotaRec.set("total_cost_usd", 0);
            quotaRec.set("circuit_breaker", false);
        }

        const currentReserved = Number(quotaRec.get("reserved_tokens")) || 0;
        const newReserved = currentReserved + tokensToReserve;
        quotaRec.set("reserved_tokens", newReserved);
        e.app.save(quotaRec);

        const reservationId = "res_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();

        return e.json(200, {
            success: true,
            reservation_id: reservationId,
            scope_type: scopeType,
            scope_id: scopeId,
            reserved_tokens: tokensToReserve,
            total_reserved: newReserved
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 7. POST /api/projectbase/billing/quotas/release
routerAdd("POST", "/api/projectbase/billing/quotas/release", (e) => {
    try {
        let body = {};
        try { body = e.requestInfo().body || {}; } catch (err) {}

        const scopeType = body.scope_type || "session";
        const scopeId = body.scope_id || body.session_id || "default";
        const tokensToRelease = Number(body.tokens) || Number(body.tokens_to_release) || 0;

        let quotaRec = null;
        try {
            quotaRec = e.app.findFirstRecordByFilter("token_quotas", "scope_type = {:st} && scope_id = {:sid}", { st: scopeType, sid: String(scopeId) });
        } catch (x) {}

        let remainingReserved = 0;
        if (quotaRec) {
            const currentReserved = Number(quotaRec.get("reserved_tokens")) || 0;
            remainingReserved = Math.max(0, currentReserved - tokensToRelease);
            quotaRec.set("reserved_tokens", remainingReserved);
            e.app.save(quotaRec);
        }

        return e.json(200, {
            success: true,
            scope_type: scopeType,
            scope_id: scopeId,
            released_tokens: tokensToRelease,
            remaining_reserved: remainingReserved
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 8. POST /api/projectbase/billing/usage/record
routerAdd("POST", "/api/projectbase/billing/usage/record", (e) => {
    try {
        const pricingTable = {
            "claude-3-5-sonnet": { prompt: 3.00, completion: 15.00, cached: 0.30, reasoning: 15.00, provider: "anthropic" },
            "claude-3-opus": { prompt: 15.00, completion: 75.00, cached: 1.50, reasoning: 75.00, provider: "anthropic" },
            "claude-3-5-haiku": { prompt: 0.80, completion: 4.00, cached: 0.08, reasoning: 4.00, provider: "anthropic" },
            "gpt-4o": { prompt: 2.50, completion: 10.00, cached: 1.25, reasoning: 10.00, provider: "openai" },
            "gpt-4o-mini": { prompt: 0.15, completion: 0.60, cached: 0.075, reasoning: 0.60, provider: "openai" },
            "o1": { prompt: 15.00, completion: 60.00, cached: 7.50, reasoning: 60.00, provider: "openai" },
            "o3-mini": { prompt: 1.10, completion: 4.40, cached: 0.55, reasoning: 4.40, provider: "openai" },
            "deepseek-v3": { prompt: 0.14, completion: 0.28, cached: 0.014, reasoning: 0.28, provider: "deepseek" },
            "deepseek-chat": { prompt: 0.14, completion: 0.28, cached: 0.014, reasoning: 0.28, provider: "deepseek" },
            "deepseek-r1": { prompt: 0.55, completion: 2.19, cached: 0.14, reasoning: 2.19, provider: "deepseek" },
            "deepseek-reasoner": { prompt: 0.55, completion: 2.19, cached: 0.14, reasoning: 2.19, provider: "deepseek" },
            "gemini-2.0-flash": { prompt: 0.10, completion: 0.40, cached: 0.025, reasoning: 0.40, provider: "google" },
            "gemini-1.5-pro": { prompt: 1.25, completion: 5.00, cached: 0.3125, reasoning: 5.00, provider: "google" },
            "omniroute/premium": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "omniroute/vision": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "premium": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "vision": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "local": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "local" }
        };

        let body = {};
        try { body = e.requestInfo().body || {}; } catch (err) {}

        const sessionId = body.session_id ? String(body.session_id).trim() : "";
        const issueId = body.issue_id ? String(body.issue_id).trim() : "";
        const projectId = body.project_id ? String(body.project_id).trim() : "";
        const persona = body.persona ? String(body.persona).trim() : "coder";
        const model = body.model ? String(body.model).trim() : "claude-3-5-sonnet";
        const provider = body.provider ? String(body.provider).trim() : "anthropic";
        const promptTokens = Number(body.prompt_tokens) || 0;
        const completionTokens = Number(body.completion_tokens) || 0;
        const cachedTokens = Number(body.cached_tokens) || 0;
        const reasoningTokens = Number(body.reasoning_tokens) || 0;
        const totalTokens = promptTokens + completionTokens + cachedTokens + reasoningTokens;
        const latencyMs = Number(body.latency_ms) || 0;
        const requestKind = body.request_kind || "inference";
        const metadata = body.metadata || {};

        // Calculate Cost
        let rates = { prompt: 1.00, completion: 3.00, cached: 0.20, reasoning: 3.00, provider: "custom" };
        const normModel = model.toLowerCase();
        for (let k in pricingTable) {
            if (normModel === k || normModel.indexOf(k) !== -1 || k.indexOf(normModel) !== -1) {
                rates = pricingTable[k];
                break;
            }
        }
        const pCost = (promptTokens / 1000000) * rates.prompt;
        const cCost = (completionTokens / 1000000) * rates.completion;
        const kCost = (cachedTokens / 1000000) * rates.cached;
        const rCost = (reasoningTokens / 1000000) * rates.reasoning;
        const costUsd = Number((pCost + cCost + kCost + rCost).toFixed(6));

        // 1. Record Ledger Entry
        const ledgerCol = e.app.findCollectionByNameOrId("cost_ledger_entries");
        const ledgerRec = new Record(ledgerCol);
        ledgerRec.set("session_id", sessionId);
        ledgerRec.set("issue_id", issueId);
        ledgerRec.set("project_id", projectId);
        ledgerRec.set("persona", persona);
        ledgerRec.set("model", model);
        ledgerRec.set("provider", provider || rates.provider);
        ledgerRec.set("prompt_tokens", promptTokens);
        ledgerRec.set("completion_tokens", completionTokens);
        ledgerRec.set("cached_tokens", cachedTokens);
        ledgerRec.set("reasoning_tokens", reasoningTokens);
        ledgerRec.set("total_tokens", totalTokens);
        ledgerRec.set("cost_usd", costUsd);
        ledgerRec.set("latency_ms", latencyMs);
        ledgerRec.set("request_kind", requestKind);
        ledgerRec.set("metadata", JSON.stringify(metadata));
        e.app.save(ledgerRec);

        // 2. Update Token Quotas
        let quotaRec = null;
        if (sessionId) {
            try {
                quotaRec = e.app.findFirstRecordByFilter("token_quotas", "scope_type = 'session' && scope_id = {:sid}", { sid: sessionId });
            } catch (x) {}
        }
        if (!quotaRec && projectId) {
            try {
                quotaRec = e.app.findFirstRecordByFilter("token_quotas", "scope_type = 'project' && scope_id = {:pid}", { pid: projectId });
            } catch (x) {}
        }
        if (quotaRec) {
            quotaRec.set("consumed_prompt", (Number(quotaRec.get("consumed_prompt")) || 0) + promptTokens);
            quotaRec.set("consumed_completion", (Number(quotaRec.get("consumed_completion")) || 0) + completionTokens);
            quotaRec.set("consumed_cached", (Number(quotaRec.get("consumed_cached")) || 0) + cachedTokens);
            quotaRec.set("consumed_reasoning", (Number(quotaRec.get("consumed_reasoning")) || 0) + reasoningTokens);
            quotaRec.set("total_cost_usd", (Number(quotaRec.get("total_cost_usd")) || 0) + costUsd);
            e.app.save(quotaRec);
        }

        // 3. Update Policies and Check Circuit Breakers
        let policies = [];
        try {
            policies = e.app.findRecordsByFilter("budget_policies", "status != 'paused'", "-created", 50, 0);
        } catch (x) {}

        let circuitBreakerTripped = false;
        const updatedPolicyStatuses = [];

        for (const p of policies) {
            const scopeType = p.get("scope_type");
            const scopeId = p.get("scope_id");

            let matches = false;
            if (scopeType === "global") matches = true;
            else if (scopeType === "project" && projectId && (scopeId === projectId || !scopeId)) matches = true;
            else if (scopeType === "persona" && persona && (scopeId.toLowerCase() === persona.toLowerCase())) matches = true;
            else if (scopeType === "session" && sessionId && (scopeId === sessionId)) matches = true;

            if (matches) {
                const currentSpend = (Number(p.get("current_spend_usd")) || 0) + costUsd;
                const currentTokens = (Number(p.get("current_tokens")) || 0) + totalTokens;
                p.set("current_spend_usd", Number(currentSpend.toFixed(4)));
                p.set("current_tokens", currentTokens);

                const maxBudget = Number(p.get("max_budget_usd")) || 0;
                const maxTokensCap = Number(p.get("max_tokens")) || 0;

                if ((maxBudget > 0 && currentSpend >= maxBudget) || (maxTokensCap > 0 && currentTokens >= maxTokensCap)) {
                    p.set("status", "exceeded");
                    circuitBreakerTripped = true;
                }
                e.app.save(p);

                updatedPolicyStatuses.push({
                    id: p.id,
                    name: p.get("name"),
                    current_spend_usd: currentSpend,
                    status: p.get("status")
                });
            }
        }

        return e.json(200, {
            success: true,
            ledger_id: ledgerRec.id,
            total_tokens: totalTokens,
            cost_usd: costUsd,
            breakdown: {
                prompt_cost: Number(pCost.toFixed(6)),
                completion_cost: Number(cCost.toFixed(6)),
                cached_cost: Number(kCost.toFixed(6)),
                reasoning_cost: Number(rCost.toFixed(6))
            },
            circuit_breaker_tripped: circuitBreakerTripped,
            policy_statuses: updatedPolicyStatuses
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 9. POST /api/projectbase/billing/overrides/grant
routerAdd("POST", "/api/projectbase/billing/overrides/grant", (e) => {
    try {
        let body = {};
        try { body = e.requestInfo().body || {}; } catch (err) {}

        const policyId = body.policy_id ? String(body.policy_id).trim() : "";
        if (!policyId) {
            return e.json(400, { error: "Missing required field: policy_id" });
        }

        let policyRec = null;
        try {
            policyRec = e.app.findRecordById("budget_policies", policyId);
        } catch (err) {
            return e.json(404, { error: "Target budget policy not found" });
        }

        const additionalBudget = Number(body.additional_budget) || 25.0;
        const additionalTokens = Number(body.additional_tokens) || 5000000;
        const durationMins = Number(body.expires_in_minutes) || 120;
        const reason = body.reason || "Emergency execution unblock";
        const grantedBy = body.granted_by || "admin";

        const expiresAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString();

        const col = e.app.findCollectionByNameOrId("budget_overrides");
        const overrideRec = new Record(col);
        overrideRec.set("policy_id", policyId);
        overrideRec.set("granted_by", grantedBy);
        overrideRec.set("additional_budget", additionalBudget);
        overrideRec.set("additional_tokens", additionalTokens);
        overrideRec.set("expires_at", expiresAt);
        overrideRec.set("reason", reason);
        overrideRec.set("status", "active");
        e.app.save(overrideRec);

        // Update policy status to overridden if it was exceeded
        if (policyRec.get("status") === "exceeded") {
            policyRec.set("status", "overridden");
            e.app.save(policyRec);
        }

        return e.json(200, {
            success: true,
            override_id: overrideRec.id,
            policy_id: policyId,
            additional_budget: additionalBudget,
            additional_tokens: additionalTokens,
            expires_at: expiresAt,
            reason: reason,
            new_policy_status: policyRec.get("status")
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 10. GET /api/projectbase/billing/analytics
routerAdd("GET", "/api/projectbase/billing/analytics", (e) => {
    try {
        let entries = [];
        try {
            entries = e.app.findRecordsByFilter("cost_ledger_entries", "1 = 1", "-created", 1000, 0);
        } catch (x) {}

        let totalSpend = 0;
        let totalTokens = 0;
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let totalCachedTokens = 0;
        let totalReasoningTokens = 0;

        const spendByProvider = {};
        const spendByModel = {};
        const spendByPersona = {};
        const spendByProject = {};

        entries.forEach(r => {
            const cost = Number(r.get("cost_usd")) || 0;
            const pTok = Number(r.get("prompt_tokens")) || 0;
            const cTok = Number(r.get("completion_tokens")) || 0;
            const kTok = Number(r.get("cached_tokens")) || 0;
            const rTok = Number(r.get("reasoning_tokens")) || 0;
            const totTok = Number(r.get("total_tokens")) || 0;

            const provider = r.get("provider") || "unknown";
            const model = r.get("model") || "unknown";
            const persona = r.get("persona") || "general";
            const proj = r.get("project_id") || "default";

            totalSpend += cost;
            totalTokens += totTok;
            totalPromptTokens += pTok;
            totalCompletionTokens += cTok;
            totalCachedTokens += kTok;
            totalReasoningTokens += rTok;

            spendByProvider[provider] = Number(((spendByProvider[provider] || 0) + cost).toFixed(4));
            spendByModel[model] = Number(((spendByModel[model] || 0) + cost).toFixed(4));
            spendByPersona[persona] = Number(((spendByPersona[persona] || 0) + cost).toFixed(4));
            spendByProject[proj] = Number(((spendByProject[proj] || 0) + cost).toFixed(4));
        });

        let activePolicies = [];
        let exceededPolicies = 0;
        try {
            activePolicies = e.app.findRecordsByFilter("budget_policies", "1 = 1", "-created", 50, 0);
            exceededPolicies = activePolicies.filter(p => p.get("status") === "exceeded").length;
        } catch (x) {}

        return e.json(200, {
            total_spend_usd: Number(totalSpend.toFixed(4)),
            total_tokens: totalTokens,
            token_breakdown: {
                prompt_tokens: totalPromptTokens,
                completion_tokens: totalCompletionTokens,
                cached_tokens: totalCachedTokens,
                reasoning_tokens: totalReasoningTokens
            },
            spend_by_provider: spendByProvider,
            spend_by_model: spendByModel,
            spend_by_persona: spendByPersona,
            spend_by_project: spendByProject,
            active_policies_count: activePolicies.length,
            circuit_breakers_active_count: exceededPolicies,
            ledger_transactions_count: entries.length
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 11. GET /api/projectbase/billing/ledger
routerAdd("GET", "/api/projectbase/billing/ledger", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const sessionId = query.session_id || "";
        const projectId = query.project_id || "";
        const persona = query.persona || "";
        const model = query.model || "";
        const limit = parseInt(query.limit || "50", 10);

        let filter = "1 = 1";
        const params = {};

        if (sessionId) {
            filter += " && session_id = {:sid}";
            params.sid = sessionId;
        }
        if (projectId) {
            filter += " && project_id = {:pid}";
            params.pid = projectId;
        }
        if (persona) {
            filter += " && persona = {:per}";
            params.per = persona;
        }
        if (model) {
            filter += " && model = {:mod}";
            params.mod = model;
        }

        let entries = [];
        try {
            entries = e.app.findRecordsByFilter("cost_ledger_entries", filter, "-created", limit, 0, params);
        } catch (err) {}

        const result = entries.map(r => ({
            id: r.id,
            session_id: r.get("session_id"),
            issue_id: r.get("issue_id"),
            project_id: r.get("project_id"),
            persona: r.get("persona"),
            model: r.get("model"),
            provider: r.get("provider"),
            prompt_tokens: r.get("prompt_tokens"),
            completion_tokens: r.get("completion_tokens"),
            cached_tokens: r.get("cached_tokens"),
            reasoning_tokens: r.get("reasoning_tokens"),
            total_tokens: r.get("total_tokens"),
            cost_usd: r.get("cost_usd"),
            latency_ms: r.get("latency_ms"),
            request_kind: r.get("request_kind"),
            created: r.get("created")
        }));

        return e.json(200, { entries: result, count: result.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 12. GET /api/projectbase/billing/pricing
routerAdd("GET", "/api/projectbase/billing/pricing", (e) => {
    try {
        const pricingTable = {
            "claude-3-5-sonnet": { prompt: 3.00, completion: 15.00, cached: 0.30, reasoning: 15.00, provider: "anthropic" },
            "claude-3-opus": { prompt: 15.00, completion: 75.00, cached: 1.50, reasoning: 75.00, provider: "anthropic" },
            "claude-3-5-haiku": { prompt: 0.80, completion: 4.00, cached: 0.08, reasoning: 4.00, provider: "anthropic" },
            "gpt-4o": { prompt: 2.50, completion: 10.00, cached: 1.25, reasoning: 10.00, provider: "openai" },
            "gpt-4o-mini": { prompt: 0.15, completion: 0.60, cached: 0.075, reasoning: 0.60, provider: "openai" },
            "o1": { prompt: 15.00, completion: 60.00, cached: 7.50, reasoning: 60.00, provider: "openai" },
            "o3-mini": { prompt: 1.10, completion: 4.40, cached: 0.55, reasoning: 4.40, provider: "openai" },
            "deepseek-v3": { prompt: 0.14, completion: 0.28, cached: 0.014, reasoning: 0.28, provider: "deepseek" },
            "deepseek-chat": { prompt: 0.14, completion: 0.28, cached: 0.014, reasoning: 0.28, provider: "deepseek" },
            "deepseek-r1": { prompt: 0.55, completion: 2.19, cached: 0.14, reasoning: 2.19, provider: "deepseek" },
            "deepseek-reasoner": { prompt: 0.55, completion: 2.19, cached: 0.14, reasoning: 2.19, provider: "deepseek" },
            "gemini-2.0-flash": { prompt: 0.10, completion: 0.40, cached: 0.025, reasoning: 0.40, provider: "google" },
            "gemini-1.5-pro": { prompt: 1.25, completion: 5.00, cached: 0.3125, reasoning: 5.00, provider: "google" },
            "omniroute/premium": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "omniroute/vision": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "premium": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "vision": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "omniroute" },
            "local": { prompt: 0.00, completion: 0.00, cached: 0.00, reasoning: 0.00, provider: "local" }
        };
        return e.json(200, { pricing: pricingTable, default_pricing: { prompt: 1.00, completion: 3.00, cached: 0.20, reasoning: 3.00, provider: "custom" } });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 13. POST /api/projectbase/billing/circuit-breaker/reset
routerAdd("POST", "/api/projectbase/billing/circuit-breaker/reset", (e) => {
    try {
        let body = {};
        try { body = e.requestInfo().body || {}; } catch (err) {}

        const policyId = body.policy_id ? String(body.policy_id).trim() : "";
        let resetCount = 0;

        if (policyId) {
            try {
                const p = e.app.findRecordById("budget_policies", policyId);
                p.set("status", "active");
                p.set("current_spend_usd", 0);
                p.set("current_tokens", 0);
                p.set("last_reset_at", new Date().toISOString());
                e.app.save(p);
                resetCount++;
            } catch (x) {}
        } else {
            // Reset all exceeded policies
            let policies = [];
            try {
                policies = e.app.findRecordsByFilter("budget_policies", "status = 'exceeded'", "-created", 50, 0);
                policies.forEach(p => {
                    p.set("status", "active");
                    p.set("current_spend_usd", 0);
                    p.set("current_tokens", 0);
                    p.set("last_reset_at", new Date().toISOString());
                    e.app.save(p);
                    resetCount++;
                });
            } catch (x) {}
        }

        return e.json(200, { success: true, reset_count: resetCount });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});
