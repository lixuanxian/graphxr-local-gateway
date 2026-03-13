import { Router } from "express";
import type { ProviderRegistry } from "../mcp/provider-registry.js";

export function catalogRouter(providerRegistry: ProviderRegistry): Router {
  const router = Router();

  // GET /catalog/providers
  router.get("/catalog/providers", (_req, res) => {
    res.json({ providers: providerRegistry.listProviders() });
  });

  // GET /catalog/datasets?provider=xxx
  router.get("/catalog/datasets", (req, res) => {
    const providerName = req.query.provider as string;
    if (!providerName) {
      res.status(400).json({ error: "provider query param is required" });
      return;
    }

    const datasets = providerRegistry.listDatasets(providerName);
    if (!datasets) {
      res.status(404).json({ error: `Provider "${providerName}" not found` });
      return;
    }

    res.json({ provider: providerName, datasets });
  });

  return router;
}
