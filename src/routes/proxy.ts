import { Router } from "express";
import type { ProviderRegistry } from "../mcp/provider-registry.js";
import type { QueryResponse, GraphSchema } from "../types/graph-delta.js";
import type { ProxyQueryRequest, ProxyApiInfoResponse } from "../types/api.js";

/**
 * Proxy-compatible routes — mirrors graphxr-database-proxy API format.
 *
 * Routes:
 *   GET  /api/providers/:provider                  — API info
 *   POST /api/providers/:provider/query             — Execute query
 *   GET  /api/providers/:provider/graphSchema        — Graph schema
 *   GET  /api/providers/:provider/schema             — Raw/table schema
 *
 * Each dataset is accessed via query parameter: ?dataset=xxx
 * If the provider has only one dataset, it's used as default.
 */
export function proxyRouter(providerRegistry: ProviderRegistry): Router {
  const router = Router();

  // GET /api/providers/:provider — API info + available endpoints
  router.get("/api/providers/:provider", (req, res) => {
    const { provider } = req.params;
    const info = providerRegistry.listProviders().find((p) => p.name === provider);
    if (!info) {
      res.status(404).json({ success: false, error: `Provider "${provider}" not found` });
      return;
    }

    const base = `/api/providers/${provider}`;
    const response: ProxyApiInfoResponse = {
      databaseType: info.databaseType,
      urls: {
        info: base,
        query: `${base}/query`,
        graphSchema: `${base}/graphSchema`,
        schema: `${base}/schema`,
      },
    };
    res.json({ success: true, data: response });
  });

  // POST /api/providers/:provider/query — Execute query
  router.post("/api/providers/:provider/query", async (req, res) => {
    const { provider } = req.params;
    const dataset = resolveDataset(req, providerRegistry, provider);
    if (!dataset) {
      res.status(400).json({ success: false, error: "dataset query parameter required (or provider must have exactly one dataset)" });
      return;
    }

    const adapter = providerRegistry.getAdapter(provider);
    if (!adapter) {
      res.status(404).json({ success: false, error: `Provider "${provider}" not found` });
      return;
    }

    const body = req.body as ProxyQueryRequest;
    if (!body.query) {
      res.status(400).json({ success: false, error: "query field is required" });
      return;
    }

    const startTime = Date.now();
    try {
      const result = await adapter.query(dataset, body.query, {
        params: body.parameters,
      });
      const elapsed = Date.now() - startTime;
      const response: QueryResponse = {
        success: true,
        data: result,
        execution_time: elapsed,
      };
      res.json(response);
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      res.status(500).json({
        success: false,
        error: err.message,
        execution_time: elapsed,
      });
    }
  });

  // GET /api/providers/:provider/graphSchema — Graph schema (categories + relationships)
  router.get("/api/providers/:provider/graphSchema", async (req, res) => {
    const { provider } = req.params;
    const dataset = resolveDataset(req, providerRegistry, provider);
    if (!dataset) {
      res.status(400).json({ success: false, error: "dataset query parameter required" });
      return;
    }

    const adapter = providerRegistry.getAdapter(provider);
    if (!adapter) {
      res.status(404).json({ success: false, error: `Provider "${provider}" not found` });
      return;
    }

    const startTime = Date.now();
    try {
      const schema: GraphSchema = await adapter.getGraphSchema(dataset);
      const elapsed = Date.now() - startTime;
      res.json({
        success: true,
        data: schema,
        execution_time: elapsed,
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      res.status(500).json({
        success: false,
        error: err.message,
        execution_time: elapsed,
      });
    }
  });

  // GET /api/providers/:provider/schema — Raw schema (table/column info)
  router.get("/api/providers/:provider/schema", async (req, res) => {
    const { provider } = req.params;
    const dataset = resolveDataset(req, providerRegistry, provider);
    if (!dataset) {
      res.status(400).json({ success: false, error: "dataset query parameter required" });
      return;
    }

    const adapter = providerRegistry.getAdapter(provider);
    if (!adapter) {
      res.status(404).json({ success: false, error: `Provider "${provider}" not found` });
      return;
    }

    const startTime = Date.now();
    try {
      const result = await adapter.getSchema(dataset);
      const elapsed = Date.now() - startTime;
      res.json({
        success: true,
        data: result,
        execution_time: elapsed,
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      res.status(500).json({
        success: false,
        error: err.message,
        execution_time: elapsed,
      });
    }
  });

  // GET /api/providers — List all providers
  router.get("/api/providers", (_req, res) => {
    const providers = providerRegistry.listProviders();
    res.json({
      success: true,
      data: providers.map((p) => ({
        name: p.name,
        databaseType: p.databaseType,
        datasets: p.datasets,
        status: p.status,
        urls: {
          info: `/api/providers/${p.name}`,
          query: `/api/providers/${p.name}/query`,
          graphSchema: `/api/providers/${p.name}/graphSchema`,
          schema: `/api/providers/${p.name}/schema`,
        },
      })),
    });
  });

  return router;
}

/**
 * Resolve the dataset from query param or default to the only dataset.
 */
function resolveDataset(
  req: any,
  registry: ProviderRegistry,
  providerName: string
): string | null {
  const explicit = req.query.dataset as string;
  if (explicit) return explicit;

  const datasets = registry.listDatasets(providerName);
  if (datasets && datasets.length === 1) return datasets[0];

  return null;
}
