import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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
  return { app: createApp(configManager, pm, mcpManager), configManager, tmpConfig };
}

describe("Console Settings API", () => {
  let app: ReturnType<typeof createApp>;
  let tmpConfig: string;

  beforeAll(() => {
    const test = createTestApp();
    app = test.app;
    tmpConfig = test.tmpConfig;
  });

  it("GET /api/console/settings returns current config", async () => {
    const res = await request(app)
      .get("/api/console/settings")
      .set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(200);
    expect(res.body.port).toBe(19285);
    expect(res.body.allowedOrigins).toEqual(["*"]);
    expect(res.body.tokenTTL).toBe(3600);
    expect(res.body.pairingTimeout).toBe(300);
  });

  it("PUT /api/console/settings updates config", async () => {
    const res = await request(app)
      .put("/api/console/settings")
      .set("Host", "127.0.0.1:19285")
      .send({ tokenTTL: 7200, pairingTimeout: 600 });
    expect(res.status).toBe(200);
    expect(res.body.tokenTTL).toBe(7200);
    expect(res.body.pairingTimeout).toBe(600);

    // Verify persisted to disk
    const saved = JSON.parse(fs.readFileSync(tmpConfig, "utf-8"));
    expect(saved.tokenTTL).toBe(7200);
  });

  it("PUT /api/console/settings updates allowedOrigins", async () => {
    const res = await request(app)
      .put("/api/console/settings")
      .set("Host", "127.0.0.1:19285")
      .send({ allowedOrigins: ["https://example.com"] });
    expect(res.status).toBe(200);
    expect(res.body.allowedOrigins).toEqual(["https://example.com"]);
  });

  it("PUT /api/console/settings rejects invalid tokenTTL", async () => {
    const res = await request(app)
      .put("/api/console/settings")
      .set("Host", "127.0.0.1:19285")
      .send({ tokenTTL: -1 });
    expect(res.status).toBe(400);
  });

  it("PUT /api/console/settings rejects invalid pairingTimeout", async () => {
    const res = await request(app)
      .put("/api/console/settings")
      .set("Host", "127.0.0.1:19285")
      .send({ pairingTimeout: 0 });
    expect(res.status).toBe(400);
  });
});
