import { Router } from "express";
import type { ProviderRegistry } from "../mcp/provider-registry.js";

export function healthRouter(providerRegistry: ProviderRegistry): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "0.1.0",
      providers: providerRegistry.listProviders(),
    });
  });

  return router;
}
