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
  allowedOrigins: ["*"],
  tokenTTL: 3600,
  pairingTimeout: 300,
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
  return { app: createApp(configManager, pm, mcpManager), tmpConfig };
}

describe("Console Providers API", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const test = createTestApp();
    app = test.app;
  });

  it("GET /api/console/providers lists providers", async () => {
    const res = await request(app)
      .get("/api/console/providers")
      .set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(200);
    expect(res.body.providers).toBeInstanceOf(Array);
    expect(res.body.providers.length).toBeGreaterThanOrEqual(1);
    expect(res.body.providers[0].name).toBe("mock");
  });

  it("POST /api/console/providers rejects missing fields", async () => {
    const res = await request(app)
      .post("/api/console/providers")
      .set("Host", "127.0.0.1:19285")
      .send({ name: "test" });
    expect(res.status).toBe(400);
  });

  it("POST /api/console/providers rejects duplicate name", async () => {
    const res = await request(app)
      .post("/api/console/providers")
      .set("Host", "127.0.0.1:19285")
      .send({ name: "mock", transport: "stdio", command: "echo", datasets: ["test"] });
    expect(res.status).toBe(409);
  });

  it("DELETE /api/console/providers/:name returns 404 for unknown", async () => {
    const res = await request(app)
      .delete("/api/console/providers/nonexistent")
      .set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(404);
  });

  it("POST /api/console/providers/:name/restart returns 404 for unknown", async () => {
    const res = await request(app)
      .post("/api/console/providers/nonexistent/restart")
      .set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(404);
  });
});
