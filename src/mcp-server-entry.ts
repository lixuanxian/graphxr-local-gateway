#!/usr/bin/env node
// ---------------------------------------------------------------------------
// MCP Server Entry Point — Runs the gateway as an MCP server (stdio).
//
// Usage:
//   npx graphxr-local-gateway          # stdio MCP server mode
//   node dist/mcp-server-entry.js      # same, from built output
//
// This allows AI tools (Claude Desktop, OpenCode, Cursor, etc.) to connect
// to the gateway and use graph database tools directly.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MCPManager } from "./mcp/mcp-manager.js";
import { createMCPServer } from "./mcp/mcp-server.js";
import type { GatewayConfig } from "./types/config.js";
import { logger } from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findConfig(): string {
  // Check common locations for the config file
  const candidates = [
    path.resolve(__dirname, "..", "gateway.config.json"),
    path.resolve(process.cwd(), "gateway.config.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]; // Default location even if not found
}

function loadConfig(): GatewayConfig {
  const configPath = findConfig();
  if (!fs.existsSync(configPath)) {
    logger.warn(`Config not found at ${configPath} — using defaults (no providers)`);
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
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  if (parsed.authEnabled === undefined) parsed.authEnabled = false;
  if (parsed.rateLimitEnabled === undefined) parsed.rateLimitEnabled = false;
  return parsed;
}

async function main(): Promise<void> {
  const config = loadConfig();

  // Initialize MCP client connections to downstream providers
  const mcpManager = new MCPManager();
  await mcpManager.init(config.providers);

  const providers = mcpManager.registry.listProviders();
  const connected = providers.filter((p) => p.status === "connected");
  logger.info(
    `MCP server starting — ${connected.length}/${providers.length} providers connected`
  );

  // Create the MCP server with gateway tools
  const mcpServer = createMCPServer(mcpManager);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  logger.info("MCP server running on stdio");

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("MCP server shutting down...");
    await mcpManager.shutdown();
    await mcpServer.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("MCP server fatal error:", err);
  process.exit(1);
});
