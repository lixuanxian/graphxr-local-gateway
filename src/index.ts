import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./server.js";
import { PairingManager } from "./pairing/pairing-manager.js";
import { MCPManager } from "./mcp/mcp-manager.js";
import { ConfigManager } from "./config/config-manager.js";
import type { GatewayConfig } from "./types/config.js";
import { logger } from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = path.resolve(__dirname, "..", "gateway.config.json");

function loadConfig(): GatewayConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    logger.warn(`Config not found at ${CONFIG_PATH} — using defaults`);
    return {
      port: 19285,
      authEnabled: false,
      rateLimitEnabled: false,
      allowedOrigins: ["*"],
      tokenTTL: 28800,
      pairingTimeout: 300,
      rateLimit: { windowMs: 60000, max: 60 },
      providers: [],
    };
  }
  const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  if (parsed.authEnabled === undefined) parsed.authEnabled = false;
  if (parsed.rateLimitEnabled === undefined) parsed.rateLimitEnabled = false;
  return parsed;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const configManager = new ConfigManager(CONFIG_PATH, config);

  // --- Pairing ---
  const pairingManager = new PairingManager({
    pairingTimeoutSec: config.pairingTimeout,
    tokenTTLSec: config.tokenTTL,
  });

  // --- MCP providers ---
  const mcpManager = new MCPManager();
  await mcpManager.init(config.providers);

  // --- Express app ---
  const app = createApp(configManager, pairingManager, mcpManager);

  // --- Start server (127.0.0.1 only) ---
  const server = app.listen(config.port, "127.0.0.1", () => {
    const providers = mcpManager.registry.listProviders();
    const connected = providers.filter((p) => p.status === "connected");
    const errored = providers.filter((p) => p.status === "error");

    logger.info(`Gateway listening on http://127.0.0.1:${config.port}`);
    logger.info(`Console: http://127.0.0.1:${config.port}/console/`);
    logger.info(
      `Providers: ${connected.length} connected` +
      (errored.length > 0 ? `, ${errored.length} errored` : "") +
      (providers.length === 0 ? " (mock mode)" : "")
    );

    if (connected.length > 0) {
      for (const p of connected) {
        const tools = mcpManager.getProviderTools(p.name);
        logger.info(`  ${p.name} [${p.databaseType}/${p.transport}] — ${tools?.length ?? 0} tools`);
      }
    }
  });

  // --- Graceful shutdown ---
  const shutdown = async () => {
    logger.info("Shutting down...");
    pairingManager.destroy();
    await mcpManager.shutdown();
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("Fatal:", err);
  process.exit(1);
});
