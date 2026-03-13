import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConfigManager } from "./config/config-manager.js";
import { corsMiddleware } from "./middleware/cors.js";
import { hostGuardMiddleware } from "./middleware/host-guard.js";
import { authMiddleware } from "./middleware/auth.js";
import { healthRouter } from "./routes/health.js";
import { pairRouter } from "./routes/pair.js";
import { graphRouter } from "./routes/graph.js";
import { catalogRouter } from "./routes/catalog.js";
import { consoleRouter } from "./routes/console.js";
import { proxyRouter } from "./routes/proxy.js";
import type { PairingManager } from "./pairing/pairing-manager.js";
import type { MCPManager } from "./mcp/mcp-manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(
  configManager: ConfigManager,
  pairingManager: PairingManager,
  mcpManager: MCPManager
): express.Express {
  const app = express();
  const config = configManager.get();

  // --- Body parser ---
  app.use(express.json());

  // --- Security middleware ---
  app.use(hostGuardMiddleware(config.port));
  app.use(corsMiddleware(() => configManager.get().allowedOrigins));
  app.use(authMiddleware(pairingManager));

  // --- Static: pair confirm page ---
  const publicDir = path.resolve(__dirname, "..", "public");
  app.get("/pair/confirm", (_req, res) => {
    res.sendFile(path.join(publicDir, "pair-confirm.html"));
  });

  // --- Console static files ---
  const consoleDir = path.resolve(publicDir, "console");
  app.use("/console", express.static(consoleDir));
  // SPA fallback: serve index.html for all /console sub-routes (Express 5 syntax)
  app.get("/console/{*path}", (_req, res) => {
    res.sendFile(path.join(consoleDir, "index.html"));
  });

  // --- Routes ---
  app.use(healthRouter(mcpManager.registry));
  app.use(pairRouter(pairingManager, config.port));
  app.use(graphRouter(mcpManager.registry));
  app.use(catalogRouter(mcpManager.registry));
  app.use(proxyRouter(mcpManager.registry));
  app.use(consoleRouter(pairingManager, mcpManager, configManager));

  return app;
}
