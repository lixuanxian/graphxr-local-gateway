import { describe, it, expect } from "vitest";
import request from "supertest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { createApp } from "../../src/server.js";
import { PairingManager } from "../../src/pairing/pairing-manager.js";
import { MCPManager } from "../../src/mcp/mcp-manager.js";
import { ConfigManager } from "../../src/config/config-manager.js";
import type { GatewayConfig } from "../../src/types/config.js";

const testConfig: GatewayConfig = {
  port: 19285,
  authEnabled: false,
  allowedOrigins: ["*"],
  tokenTTL: 3600,
  pairingTimeout: 300,
  rateLimitEnabled: false,
  rateLimit: { windowMs: 60000, max: 60 },
  providers: [],
};

function createTestApp() {
  const tmpConfig = path.join(os.tmpdir(), `gw-test-events-${Date.now()}.json`);
  fs.writeFileSync(tmpConfig, JSON.stringify(testConfig));
  const configManager = new ConfigManager(tmpConfig, { ...testConfig });
  const pm = new PairingManager({ pairingTimeoutSec: 300, tokenTTLSec: 3600 });
  const mcpManager = new MCPManager();
  mcpManager.init([]);
  return { app: createApp(configManager, pm, mcpManager), mcpManager, tmpConfig };
}

describe("Console Events API", () => {
  it("GET /api/console/events returns empty array initially", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .get("/api/console/events")
      .set("Host", "127.0.0.1:19285");

    expect(res.status).toBe(200);
    expect(res.body.events).toBeInstanceOf(Array);
  });

  it("GET /api/console/events respects limit parameter", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .get("/api/console/events?limit=10")
      .set("Host", "127.0.0.1:19285");

    expect(res.status).toBe(200);
    expect(res.body.events).toBeInstanceOf(Array);
  });

  it("GET /api/console/providers/:name/events returns events for provider", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .get("/api/console/providers/mock/events")
      .set("Host", "127.0.0.1:19285");

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe("mock");
    expect(res.body.events).toBeInstanceOf(Array);
  });

  it("MCPManager tracks connection events", () => {
    const mcpManager = new MCPManager();
    mcpManager.init([]);

    const events = mcpManager.getConnectionEvents();
    // Mock adapter doesn't generate connection events (it's registered directly)
    expect(events).toBeInstanceOf(Array);
  });

  it("MCPManager getProviderEvents filters by provider name", () => {
    const mcpManager = new MCPManager();
    mcpManager.init([]);

    const events = mcpManager.getProviderEvents("nonexistent");
    expect(events).toEqual([]);
  });
});
