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
  allowedOrigins: ["*"],
  tokenTTL: 3600,
  pairingTimeout: 300,
  rateLimit: { windowMs: 60000, max: 60 },
  providers: [],
};

function createTestApp() {
  const tmpConfig = path.join(os.tmpdir(), `gw-test-catalog-${Date.now()}.json`);
  fs.writeFileSync(tmpConfig, JSON.stringify(testConfig));
  const configManager = new ConfigManager(tmpConfig, { ...testConfig });
  const pm = new PairingManager({ pairingTimeoutSec: 300, tokenTTLSec: 3600 });
  const mcpManager = new MCPManager();
  mcpManager.init([]);
  return { app: createApp(configManager, pm, mcpManager), pm };
}

function getAuthToken(pm: PairingManager): string {
  const { pairingId } = pm.startPairing("", []);
  pm.approve(pairingId);
  const status = pm.getStatus(pairingId);
  return status!.token!;
}

describe("Catalog Routes", () => {
  describe("GET /catalog/providers", () => {
    it("returns 401 without auth", async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .get("/catalog/providers")
        .set("Host", "127.0.0.1:19285");

      expect(res.status).toBe(401);
    });

    it("returns provider list with auth", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .get("/catalog/providers")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.providers).toBeInstanceOf(Array);
      expect(res.body.providers.length).toBeGreaterThan(0);
    });

    it("includes databaseType in provider info", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .get("/catalog/providers")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const provider = res.body.providers[0];
      expect(provider).toHaveProperty("name");
      expect(provider).toHaveProperty("databaseType");
      expect(provider).toHaveProperty("transport");
      expect(provider).toHaveProperty("datasets");
      expect(provider).toHaveProperty("status");
    });
  });

  describe("GET /catalog/datasets", () => {
    it("returns 400 without provider param", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .get("/catalog/datasets")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("returns datasets for existing provider", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .get("/catalog/datasets?provider=mock")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.provider).toBe("mock");
      expect(res.body.datasets).toBeInstanceOf(Array);
      expect(res.body.datasets).toContain("demo");
    });

    it("returns 404 for unknown provider", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .get("/catalog/datasets?provider=nonexistent")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
