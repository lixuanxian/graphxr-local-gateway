import { Router } from "express";
import type { PairingManager } from "../pairing/pairing-manager.js";
import type { MCPManager } from "../mcp/mcp-manager.js";
import type { ConfigManager } from "../config/config-manager.js";
import { PROVIDER_TEMPLATES, getTemplate } from "../mcp/provider-templates.js";
import { logger } from "../utils/logger.js";

const startTime = Date.now();

export function consoleRouter(
  pairingManager: PairingManager,
  mcpManager: MCPManager,
  configManager: ConfigManager
): Router {
  const router = Router();
  const providerRegistry = mcpManager.registry;

  // ─── Stats ───────────────────────────────────────────────

  router.get("/api/console/stats", (_req, res) => {
    const uptimeMs = Date.now() - startTime;
    res.json({
      status: "ok",
      version: "0.1.0",
      uptime: uptimeMs,
      uptimeFormatted: formatUptime(uptimeMs),
      providerCount: providerRegistry.listProviders().length,
      sessionCount: pairingManager.sessionCount,
      activeTokenCount: pairingManager.activeTokenCount,
    });
  });

  // ─── Sessions ────────────────────────────────────────────

  router.get("/api/console/sessions", (_req, res) => {
    res.json({ sessions: pairingManager.listSessions() });
  });

  // ─── Tokens ──────────────────────────────────────────────

  router.get("/api/console/tokens", (_req, res) => {
    res.json({ tokens: pairingManager.listActiveTokens() });
  });

  router.delete("/api/console/tokens/:tokenPrefix", (req, res) => {
    const { tokenPrefix } = req.params;
    const ok = pairingManager.revokeToken(tokenPrefix);
    if (ok) {
      res.json({ status: "revoked" });
    } else {
      res.status(404).json({ error: "Token not found" });
    }
  });

  // ─── Settings ────────────────────────────────────────────

  router.get("/api/console/settings", (_req, res) => {
    const config = configManager.get();
    res.json({
      port: config.port,
      allowedOrigins: config.allowedOrigins,
      tokenTTL: config.tokenTTL,
      pairingTimeout: config.pairingTimeout,
      rateLimit: config.rateLimit,
    });
  });

  router.put("/api/console/settings", async (req, res) => {
    try {
      const { allowedOrigins, tokenTTL, pairingTimeout } = req.body;
      const updated = await configManager.update({
        ...(allowedOrigins !== undefined && { allowedOrigins }),
        ...(tokenTTL !== undefined && { tokenTTL }),
        ...(pairingTimeout !== undefined && { pairingTimeout }),
      });
      res.json({
        port: updated.port,
        allowedOrigins: updated.allowedOrigins,
        tokenTTL: updated.tokenTTL,
        pairingTimeout: updated.pairingTimeout,
        rateLimit: updated.rateLimit,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Providers (read) ────────────────────────────────────

  router.get("/api/console/providers", (_req, res) => {
    const providers = providerRegistry.listProviders().map((p) => ({
      ...p,
      tools: mcpManager.getProviderTools(p.name) ?? [],
    }));
    res.json({ providers });
  });

  // ─── Providers (CRUD) ────────────────────────────────────

  router.post("/api/console/providers", async (req, res) => {
    try {
      const { name, transport, databaseType, command, args, env, endpoint, datasets, toolMapping } = req.body;
      if (!name || !transport || !datasets?.length) {
        res.status(400).json({ error: "name, transport, and datasets are required" });
        return;
      }

      // Validate provider name format
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        res.status(400).json({ error: "Provider name must contain only letters, numbers, hyphens, and underscores" });
        return;
      }

      // Transport-specific validation
      if (transport === "stdio" && !command) {
        res.status(400).json({ error: "stdio transport requires a command field" });
        return;
      }
      if (transport === "http" && !endpoint) {
        res.status(400).json({ error: "http transport requires an endpoint field" });
        return;
      }
      if (transport !== "stdio" && transport !== "http") {
        res.status(400).json({ error: 'transport must be "stdio" or "http"' });
        return;
      }

      const existing = providerRegistry.listProviders().find((p) => p.name === name);
      if (existing) {
        res.status(409).json({ error: `Provider "${name}" already exists` });
        return;
      }

      const config = { name, transport, databaseType: databaseType ?? "generic", command, args, env, endpoint, datasets, toolMapping };
      await mcpManager.addProvider(config);
      await configManager.updateProviders(
        providerRegistry.listProviders().map((p) => mcpManager.getProviderConfig(p.name) ?? p as any)
      );

      const provider = providerRegistry.listProviders().find((p) => p.name === name);
      res.status(201).json({ status: "created", provider });
    } catch (err: any) {
      logger.error("Failed to add provider:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/api/console/providers/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const existing = providerRegistry.listProviders().find((p) => p.name === name);
      if (!existing) {
        res.status(404).json({ error: `Provider "${name}" not found` });
        return;
      }

      const { transport, databaseType, command, args, env, endpoint, datasets, toolMapping } = req.body;
      const config = {
        name,
        transport: transport ?? existing.transport,
        databaseType: databaseType ?? (existing as any).databaseType ?? "generic",
        command,
        args,
        env,
        endpoint,
        datasets: datasets ?? existing.datasets,
        toolMapping,
      };

      await mcpManager.removeProvider(name);
      await mcpManager.addProvider(config);
      await configManager.updateProviders(
        providerRegistry.listProviders().map((p) => mcpManager.getProviderConfig(p.name) ?? p as any)
      );

      const provider = providerRegistry.listProviders().find((p) => p.name === name);
      res.json({ status: "updated", provider });
    } catch (err: any) {
      logger.error("Failed to update provider:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/api/console/providers/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const existing = providerRegistry.listProviders().find((p) => p.name === name);
      if (!existing) {
        res.status(404).json({ error: `Provider "${name}" not found` });
        return;
      }

      await mcpManager.removeProvider(name);
      await configManager.updateProviders(
        providerRegistry.listProviders().map((p) => mcpManager.getProviderConfig(p.name) ?? p as any)
      );

      res.json({ status: "deleted" });
    } catch (err: any) {
      logger.error("Failed to delete provider:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/console/providers/:name/restart", async (req, res) => {
    try {
      const { name } = req.params;
      const existing = providerRegistry.listProviders().find((p) => p.name === name);
      if (!existing) {
        res.status(404).json({ error: `Provider "${name}" not found` });
        return;
      }

      await mcpManager.restartProvider(name);
      const provider = providerRegistry.listProviders().find((p) => p.name === name);
      res.json({ status: "restarted", provider });
    } catch (err: any) {
      logger.error("Failed to restart provider:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Provider Templates ─────────────────────────────────

  router.get("/api/console/templates", (_req, res) => {
    res.json({ templates: PROVIDER_TEMPLATES });
  });

  router.get("/api/console/templates/:id", (req, res) => {
    const template = getTemplate(req.params.id);
    if (!template) {
      res.status(404).json({ error: `Template "${req.params.id}" not found` });
      return;
    }
    res.json({ template });
  });

  // ─── Provider Schema (console-accessible) ───────────────

  router.get("/api/console/providers/:name/schema", async (req, res) => {
    const { name } = req.params;
    const adapter = providerRegistry.getAdapter(name);
    if (!adapter) {
      res.status(404).json({ error: `Provider "${name}" not found` });
      return;
    }

    const datasets = providerRegistry.listDatasets(name);
    const dataset = (req.query.dataset as string) ?? datasets?.[0] ?? "default";

    try {
      const schema = await adapter.getGraphSchema(dataset);
      res.json({ provider: name, dataset, schema });
    } catch (err: any) {
      logger.error(`Failed to get schema for "${name}":`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Provider Tools (MCP introspection) ────────────────

  router.get("/api/console/providers/:name/tools", (req, res) => {
    const { name } = req.params;
    const tools = mcpManager.getProviderTools(name);
    if (tools === undefined) {
      res.status(404).json({ error: `Provider "${name}" not found or not connected via MCP` });
      return;
    }
    const config = mcpManager.getProviderConfig(name);
    const toolDetails = mcpManager.getProviderToolDetails(name) ?? [];
    res.json({
      provider: name,
      tools,
      toolDetails,
      toolMapping: config?.toolMapping ?? {},
    });
  });

  // ─── Connection Events ──────────────────────────────────

  router.get("/api/console/events", (_req, res) => {
    const limit = parseInt(_req.query.limit as string) || 50;
    res.json({ events: mcpManager.getConnectionEvents(limit) });
  });

  router.get("/api/console/providers/:name/events", (req, res) => {
    const { name } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const events = mcpManager.getProviderEvents(name, limit);
    res.json({ provider: name, events });
  });

  // ─── SSE: Real-time events stream ──────────────────────

  router.get("/api/console/events/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send initial state
    const providers = providerRegistry.listProviders();
    res.write(`event: providers\ndata: ${JSON.stringify(providers)}\n\n`);

    // Poll for new events every 2 seconds
    let lastEventCount = mcpManager.getConnectionEvents(1000).length;
    const interval = setInterval(() => {
      const allEvents = mcpManager.getConnectionEvents(1000);
      if (allEvents.length > lastEventCount) {
        const newEvents = allEvents.slice(lastEventCount);
        for (const evt of newEvents) {
          res.write(`event: connection\ndata: ${JSON.stringify(evt)}\n\n`);
        }
        // Also send updated provider list
        const updatedProviders = providerRegistry.listProviders();
        res.write(`event: providers\ndata: ${JSON.stringify(updatedProviders)}\n\n`);
        lastEventCount = allEvents.length;
      }
    }, 2000);

    req.on("close", () => {
      clearInterval(interval);
    });
  });

  // ─── Provider Test Query (console-accessible) ───────────

  router.post("/api/console/providers/:name/test-query", async (req, res) => {
    const { name } = req.params;
    const adapter = providerRegistry.getAdapter(name);
    if (!adapter) {
      res.status(404).json({ error: `Provider "${name}" not found or not connected` });
      return;
    }

    const datasets = providerRegistry.listDatasets(name);
    const dataset = (req.body.dataset as string) ?? datasets?.[0] ?? "default";
    const query = req.body.query as string;

    if (!query) {
      res.status(400).json({ error: "query field is required" });
      return;
    }

    const parameters = req.body.parameters as Record<string, unknown> | undefined;

    const startTime = Date.now();
    try {
      const result = await adapter.query(dataset, query, {
        params: parameters,
        limit: req.body.limit ?? 25,
      });
      const elapsed = Date.now() - startTime;
      res.json({
        success: true,
        provider: name,
        dataset,
        executionTime: elapsed,
        nodeCount: result.nodes?.length ?? 0,
        edgeCount: result.edges?.length ?? 0,
        data: result,
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      res.status(500).json({
        success: false,
        provider: name,
        dataset,
        executionTime: elapsed,
        error: err.message,
      });
    }
  });

  // ─── Provider Connection Test ──────────────────────────

  router.post("/api/console/providers/:name/test", async (req, res) => {
    const { name } = req.params;
    const adapter = providerRegistry.getAdapter(name);
    if (!adapter) {
      res.status(404).json({ error: `Provider "${name}" not found or not connected` });
      return;
    }

    const datasets = providerRegistry.listDatasets(name);
    const dataset = datasets?.[0] ?? "default";
    const results: Array<{ check: string; status: "pass" | "fail"; detail: string; ms: number }> = [];

    // 1. Test schema retrieval
    const schemaStart = Date.now();
    try {
      const schema = await adapter.getGraphSchema(dataset);
      results.push({
        check: "Schema",
        status: "pass",
        detail: `${schema.categories.length} categories, ${schema.relationships.length} relationships`,
        ms: Date.now() - schemaStart,
      });
    } catch (err: any) {
      results.push({ check: "Schema", status: "fail", detail: err.message, ms: Date.now() - schemaStart });
    }

    // 2. Test a simple query
    const queryStart = Date.now();
    try {
      const providerInfo = providerRegistry.listProviders().find((p) => p.name === name);
      const dbType = providerInfo?.databaseType ?? "generic";
      const testQuery = dbType === "spanner" ? "SELECT 1" : "RETURN 1 AS test";
      const result = await adapter.query(dataset, testQuery, { limit: 1 });
      results.push({
        check: "Query",
        status: "pass",
        detail: `${result.nodes?.length ?? 0} nodes, ${result.edges?.length ?? 0} edges`,
        ms: Date.now() - queryStart,
      });
    } catch (err: any) {
      results.push({ check: "Query", status: "fail", detail: err.message, ms: Date.now() - queryStart });
    }

    // 3. Check MCP tools
    const tools = mcpManager.getProviderTools(name);
    results.push({
      check: "MCP Tools",
      status: tools && tools.length > 0 ? "pass" : "fail",
      detail: tools ? `${tools.length} tools available` : "No tools found",
      ms: 0,
    });

    const overall = results.every((r) => r.status === "pass") ? "pass" : "fail";
    res.json({ provider: name, dataset, overall, results });
  });

  // ─── Self-Test ───────────────────────────────────────────

  router.post("/api/console/self-test", async (_req, res) => {
    const results: Array<{ name: string; status: "pass" | "fail" | "skip"; detail: string }> = [];

    // 1. Health check
    try {
      const providers = providerRegistry.listProviders();
      results.push({
        name: "Health Check",
        status: "pass",
        detail: `v0.1.0, ${providers.length} provider(s)`,
      });
    } catch (err: any) {
      results.push({ name: "Health Check", status: "fail", detail: err.message });
    }

    // 2. Provider connectivity
    const providers = providerRegistry.listProviders();
    if (providers.length === 0) {
      results.push({ name: "Provider Connectivity", status: "skip", detail: "No providers configured" });
    } else {
      const connected = providers.filter((p) => p.status === "connected");
      const failed = providers.filter((p) => p.status !== "connected");
      if (failed.length === 0) {
        results.push({
          name: "Provider Connectivity",
          status: "pass",
          detail: providers.map((p) => `${p.name}: ${p.status}`).join(", "),
        });
      } else {
        results.push({
          name: "Provider Connectivity",
          status: connected.length > 0 ? "pass" : "fail",
          detail: providers.map((p) => `${p.name}: ${p.status}`).join(", "),
        });
      }
    }

    // 3. Graph query test
    const connectedProvider = providers.find((p) => p.status === "connected");
    if (!connectedProvider) {
      results.push({ name: "Graph Query", status: "skip", detail: "No connected provider" });
    } else {
      try {
        const adapter = providerRegistry.getAdapter(connectedProvider.name);
        if (!adapter) {
          results.push({ name: "Graph Query", status: "fail", detail: "Adapter not found" });
        } else {
          const dataset = connectedProvider.datasets[0] ?? "default";
          const result = await adapter.getSchema(dataset);
          const nodeCount = result.nodes?.length ?? 0;
          const edgeCount = result.edges?.length ?? 0;
          results.push({
            name: "Graph Query",
            status: "pass",
            detail: `Schema from "${connectedProvider.name}/${dataset}": ${nodeCount} node types, ${edgeCount} edge types`,
          });
        }
      } catch (err: any) {
        results.push({ name: "Graph Query", status: "fail", detail: err.message });
      }
    }

    // 4. CORS config
    const config = configManager.get();
    const originsDesc = config.allowedOrigins.includes("*")
      ? "Allow all origins (*)"
      : `${config.allowedOrigins.length} origin(s) configured`;
    results.push({ name: "CORS Config", status: "pass", detail: originsDesc });

    const overall = results.every((r) => r.status !== "fail") ? "pass" : "fail";
    res.json({ results, overall });
  });

  return router;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
