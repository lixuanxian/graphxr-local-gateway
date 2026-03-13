import { Router } from "express";
import type { ProviderRegistry } from "../mcp/provider-registry.js";
import type { GraphDelta } from "../types/graph-delta.js";
import type {
  GraphNeighborsRequest,
  GraphExpandRequest,
  GraphQueryRequest,
  GraphSchemaRequest,
} from "../types/api.js";

export function graphRouter(providerRegistry: ProviderRegistry): Router {
  const router = Router();

  // POST /graph/schema
  router.post("/graph/schema", async (req, res) => {
    const body = req.body as GraphSchemaRequest;
    if (!body.provider || !body.dataset) {
      res.status(400).json({ error: "provider and dataset are required" });
      return;
    }

    const adapter = providerRegistry.getAdapter(body.provider);
    if (!adapter) {
      res.status(404).json({ error: `Provider "${body.provider}" not found` });
      return;
    }

    try {
      const result = await adapter.getSchema(body.dataset);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /graph/neighbors
  router.post("/graph/neighbors", async (req, res) => {
    const body = req.body as GraphNeighborsRequest;
    if (!body.provider || !body.dataset || !body.nodeId) {
      res.status(400).json({ error: "provider, dataset, and nodeId are required" });
      return;
    }

    const adapter = providerRegistry.getAdapter(body.provider);
    if (!adapter) {
      res.status(404).json({ error: `Provider "${body.provider}" not found` });
      return;
    }

    try {
      const result = await adapter.getNeighbors(body.dataset, body.nodeId, {
        edgeTypes: body.edgeTypes,
        limit: body.limit,
        cursor: body.cursor,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /graph/expand
  router.post("/graph/expand", async (req, res) => {
    const body = req.body as GraphExpandRequest;
    if (!body.provider || !body.dataset || !body.nodeIds?.length) {
      res.status(400).json({ error: "provider, dataset, and nodeIds are required" });
      return;
    }

    const adapter = providerRegistry.getAdapter(body.provider);
    if (!adapter) {
      res.status(404).json({ error: `Provider "${body.provider}" not found` });
      return;
    }

    try {
      const result = await adapter.expand(body.dataset, body.nodeIds, {
        depth: body.depth,
        limit: body.limit,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /graph/query
  router.post("/graph/query", async (req, res) => {
    const body = req.body as GraphQueryRequest;
    if (!body.provider || !body.dataset || !body.query) {
      res.status(400).json({ error: "provider, dataset, and query are required" });
      return;
    }

    const adapter = providerRegistry.getAdapter(body.provider);
    if (!adapter) {
      res.status(404).json({ error: `Provider "${body.provider}" not found` });
      return;
    }

    try {
      const result = await adapter.query(body.dataset, body.query, {
        params: body.params,
        limit: body.limit,
        cursor: body.cursor,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
