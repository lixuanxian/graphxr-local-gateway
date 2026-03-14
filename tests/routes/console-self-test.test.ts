import { describe, it, expect, beforeAll } from "vitest";
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
  const tmpConfig = path.join(os.tmpdir(), `gw-test-${Date.now()}.json`);
  fs.writeFileSync(tmpConfig, JSON.stringify(testConfig));
  const configManager = new ConfigManager(tmpConfig, { ...testConfig });
  const pm = new PairingManager({ pairingTimeoutSec: 300, tokenTTLSec: 3600 });
  const mcpManager = new MCPManager();
  mcpManager.init([]);
  return { app: createApp(configManager, pm, mcpManager) };
}

describe("Console Self-Test API", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const test = createTestApp();
    app = test.app;
  });

  it("POST /api/console/self-test returns structured results", async () => {
    const res = await request(app)
      .post("/api/console/self-test")
      .set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(200);
    expect(res.body.overall).toBe("pass");
    expect(res.body.results).toBeInstanceOf(Array);
    expect(res.body.results.length).toBeGreaterThanOrEqual(4);

    const names = res.body.results.map((r: any) => r.name);
    expect(names).toContain("Health Check");
    expect(names).toContain("Provider Connectivity");
    expect(names).toContain("Graph Query");
    expect(names).toContain("CORS Config");
  });

  it("self-test Health Check passes with mock provider", async () => {
    const res = await request(app)
      .post("/api/console/self-test")
      .set("Host", "127.0.0.1:19285");
    const healthCheck = res.body.results.find((r: any) => r.name === "Health Check");
    expect(healthCheck.status).toBe("pass");
    expect(healthCheck.detail).toContain("1 provider");
  });

  it("self-test Graph Query passes with mock adapter", async () => {
    const res = await request(app)
      .post("/api/console/self-test")
      .set("Host", "127.0.0.1:19285");
    const graphQuery = res.body.results.find((r: any) => r.name === "Graph Query");
    expect(graphQuery.status).toBe("pass");
    expect(graphQuery.detail).toContain("mock");
  });

  it("self-test CORS Config reports wildcard", async () => {
    const res = await request(app)
      .post("/api/console/self-test")
      .set("Host", "127.0.0.1:19285");
    const corsConfig = res.body.results.find((r: any) => r.name === "CORS Config");
    expect(corsConfig.status).toBe("pass");
    expect(corsConfig.detail).toContain("*");
  });
});
