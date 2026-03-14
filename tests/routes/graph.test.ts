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
  authEnabled: true,
  allowedOrigins: ["*"],
  tokenTTL: 3600,
  pairingTimeout: 300,
  rateLimitEnabled: false,
  rateLimit: { windowMs: 60000, max: 60 },
  providers: [],
};

function createTestApp() {
  const tmpConfig = path.join(os.tmpdir(), `gw-test-graph-${Date.now()}.json`);
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

describe("Graph Routes", () => {
  describe("POST /graph/schema", () => {
    it("returns 401 without auth", async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .post("/graph/schema")
        .set("Host", "127.0.0.1:19285")
        .send({ provider: "mock", dataset: "demo" });

      expect(res.status).toBe(401);
    });

    it("returns 400 if provider is missing", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/schema")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ dataset: "demo" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("provider");
    });

    it("returns schema for mock provider", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/schema")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("nodes");
      expect(res.body).toHaveProperty("edges");
      expect(res.body).toHaveProperty("provenance");
    });

    it("returns 404 for unknown provider", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/schema")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "nonexistent", dataset: "demo" });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /graph/neighbors", () => {
    it("returns 400 if nodeId is missing", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/neighbors")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo" });

      expect(res.status).toBe(400);
    });

    it("returns neighbors for mock provider", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/neighbors")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo", nodeId: "node-1" });

      expect(res.status).toBe(200);
      expect(res.body.nodes).toBeInstanceOf(Array);
      expect(res.body.edges).toBeInstanceOf(Array);
    });
  });

  describe("POST /graph/expand", () => {
    it("returns 400 if nodeIds is missing", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/expand")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo" });

      expect(res.status).toBe(400);
    });

    it("returns expanded graph for mock provider", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/expand")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo", nodeIds: ["node-1"] });

      expect(res.status).toBe(200);
      expect(res.body.nodes).toBeInstanceOf(Array);
      expect(res.body.edges).toBeInstanceOf(Array);
    });
  });

  describe("POST /graph/query", () => {
    it("returns 400 if query is missing", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/query")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo" });

      expect(res.status).toBe(400);
    });

    it("returns query results for mock provider", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/query")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo", query: "MATCH (n) RETURN n" });

      expect(res.status).toBe(200);
      expect(res.body.nodes).toBeInstanceOf(Array);
      expect(res.body.edges).toBeInstanceOf(Array);
      expect(res.body.provenance).toBeDefined();
    });
  });

  describe("GraphDelta response format", () => {
    it("returns nodes with labels[] and properties", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/neighbors")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo", nodeId: "node-1" });

      expect(res.status).toBe(200);
      if (res.body.nodes.length > 0) {
        const node = res.body.nodes[0];
        expect(node).toHaveProperty("id");
        expect(node).toHaveProperty("labels");
        expect(node).toHaveProperty("properties");
        expect(Array.isArray(node.labels)).toBe(true);
      }
    });

    it("returns edges with startNodeId/endNodeId", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/neighbors")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo", nodeId: "node-1" });

      expect(res.status).toBe(200);
      if (res.body.edges.length > 0) {
        const edge = res.body.edges[0];
        expect(edge).toHaveProperty("id");
        expect(edge).toHaveProperty("type");
        expect(edge).toHaveProperty("startNodeId");
        expect(edge).toHaveProperty("endNodeId");
        expect(edge).toHaveProperty("properties");
      }
    });

    it("includes provenance in all responses", async () => {
      const { app, pm } = createTestApp();
      const token = getAuthToken(pm);

      const res = await request(app)
        .post("/graph/schema")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "mock", dataset: "demo" });

      expect(res.status).toBe(200);
      expect(res.body.provenance).toBeDefined();
      expect(res.body.provenance.provider).toBe("mock");
      expect(res.body.provenance.dataset).toBe("demo");
    });
  });
});
