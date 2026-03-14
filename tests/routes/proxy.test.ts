import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../src/server.js";
import { PairingManager } from "../../src/pairing/pairing-manager.js";
import { MCPManager } from "../../src/mcp/mcp-manager.js";
import { ConfigManager } from "../../src/config/config-manager.js";
import type { GatewayConfig } from "../../src/types/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testConfig: GatewayConfig = {
  port: 19285,
  authEnabled: true,
  allowedOrigins: ["*"],
  tokenTTL: 3600,
  pairingTimeout: 300,
  rateLimit: { windowMs: 60000, max: 60 },
  providers: [],
};

function createTestApp() {
  const config = { ...testConfig };
  const configPath = path.resolve(__dirname, "../../gateway.config.json");
  const configManager = new ConfigManager(configPath, config);
  const pm = new PairingManager({ pairingTimeoutSec: 300, tokenTTLSec: 3600 });
  const mcpManager = new MCPManager();
  mcpManager.init([]); // registers mock adapter
  return { app: createApp(configManager, pm, mcpManager), pm, mcpManager };
}

async function getAuthToken(pm: PairingManager): Promise<string> {
  const { pairingId } = pm.startPairing("", []);
  pm.approve(pairingId);
  const status = pm.getStatus(pairingId);
  return status!.token!;
}

describe("Proxy-compatible API", () => {
  let app: ReturnType<typeof createApp>;
  let token: string;

  beforeAll(async () => {
    const test = createTestApp();
    app = test.app;
    token = await getAuthToken(test.pm);
  });

  describe("GET /api/providers", () => {
    it("lists all providers", async () => {
      const res = await request(app)
        .get("/api/providers")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("mock");
      expect(res.body.data[0].urls.query).toBe("/api/providers/mock/query");
    });
  });

  describe("GET /api/providers/:provider", () => {
    it("returns API info for a provider", async () => {
      const res = await request(app)
        .get("/api/providers/mock")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.databaseType).toBeDefined();
      expect(res.body.data.urls.query).toBe("/api/providers/mock/query");
      expect(res.body.data.urls.graphSchema).toBe("/api/providers/mock/graphSchema");
    });

    it("returns 404 for unknown provider", async () => {
      const res = await request(app)
        .get("/api/providers/nonexistent")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/providers/:provider/query", () => {
    it("executes a query and returns graphxr-compatible result", async () => {
      const res = await request(app)
        .post("/api/providers/mock/query?dataset=demo")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ query: "MATCH (n) RETURN n LIMIT 10" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.execution_time).toBeGreaterThanOrEqual(0);

      const data = res.body.data;
      expect(data.nodes).toBeInstanceOf(Array);
      expect(data.edges).toBeInstanceOf(Array);

      // Verify graphxr-database-proxy compatible format
      const node = data.nodes[0];
      expect(node.id).toBeDefined();
      expect(node.labels).toBeInstanceOf(Array);
      expect(node.properties).toBeDefined();

      if (data.edges.length > 0) {
        const edge = data.edges[0];
        expect(edge.id).toBeDefined();
        expect(edge.type).toBeDefined();
        expect(edge.startNodeId).toBeDefined();
        expect(edge.endNodeId).toBeDefined();
        expect(edge.properties).toBeDefined();
      }
    });

    it("uses single dataset as default when no dataset param", async () => {
      const res = await request(app)
        .post("/api/providers/mock/query")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({ query: "MATCH (n) RETURN n" });
      // mock has one dataset "demo", so it should auto-resolve
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("requires query field", async () => {
      const res = await request(app)
        .post("/api/providers/mock/query?dataset=demo")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("requires auth", async () => {
      const res = await request(app)
        .post("/api/providers/mock/query?dataset=demo")
        .set("Host", "127.0.0.1:19285")
        .send({ query: "MATCH (n) RETURN n" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/providers/:provider/graphSchema", () => {
    it("returns graph schema with categories and relationships", async () => {
      const res = await request(app)
        .get("/api/providers/mock/graphSchema?dataset=demo")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.execution_time).toBeGreaterThanOrEqual(0);

      const schema = res.body.data;
      expect(schema.categories).toBeInstanceOf(Array);
      expect(schema.relationships).toBeInstanceOf(Array);

      // Check category shape
      const cat = schema.categories[0];
      expect(cat.name).toBeDefined();
      expect(cat.props).toBeInstanceOf(Array);
      expect(cat.propsTypes).toBeDefined();

      // Check relationship shape
      const rel = schema.relationships[0];
      expect(rel.name).toBeDefined();
      expect(rel.startCategory).toBeDefined();
      expect(rel.endCategory).toBeDefined();
    });
  });

  describe("GET /api/providers/:provider/schema", () => {
    it("returns raw schema as GraphDelta", async () => {
      const res = await request(app)
        .get("/api/providers/mock/schema?dataset=demo")
        .set("Host", "127.0.0.1:19285")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.nodes).toBeInstanceOf(Array);
      expect(res.body.data.provenance).toBeDefined();
    });
  });
});
