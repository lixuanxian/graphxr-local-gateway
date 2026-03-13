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
      allowedOrigins: ["*"],
      tokenTTL: 28800,
      pairingTimeout: 300,
      rateLimit: { windowMs: 60000, max: 60 },
      providers: [],
    };
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
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
    logger.info(`Gateway listening on http://127.0.0.1:${config.port}`);
    logger.info(
      `Providers: ${mcpManager.registry.listProviders().map((p) => p.name).join(", ") || "none (mock mode)"}`
    );
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
