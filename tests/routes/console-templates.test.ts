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
  authEnabled: false,
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
  mcpManager.init([]);
  return { app: createApp(configManager, pm, mcpManager), pm, mcpManager };
}

describe("Provider Templates API", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const test = createTestApp();
    app = test.app;
  });

  it("GET /api/console/templates lists all templates", async () => {
    const res = await request(app)
      .get("/api/console/templates")
      .set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(200);
    expect(res.body.templates).toBeInstanceOf(Array);
    expect(res.body.templates.length).toBeGreaterThan(0);

    // Check that known templates exist
    const ids = res.body.templates.map((t: any) => t.id);
    expect(ids).toContain("neo4j-official");
    expect(ids).toContain("neo4j-labs");
    expect(ids).toContain("spanner-toolbox");
    expect(ids).toContain("generic");
  });

  it("GET /api/console/templates/:id returns a specific template", async () => {
    const res = await request(app)
      .get("/api/console/templates/neo4j-official")
      .set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(200);
    expect(res.body.template.id).toBe("neo4j-official");
    expect(res.body.template.databaseType).toBe("neo4j");
    expect(res.body.template.toolMapping).toBeDefined();
    expect(res.body.template.envHints).toBeDefined();
  });

  it("GET /api/console/templates/:id returns 404 for unknown template", async () => {
    const res = await request(app)
      .get("/api/console/templates/nonexistent")
      .set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(404);
  });

  it("Neo4j template has correct tool mapping", async () => {
    const res = await request(app)
      .get("/api/console/templates/neo4j-official")
      .set("Host", "127.0.0.1:19285");
    const template = res.body.template;
    expect(template.toolMapping.schema).toBe("get-schema");
    expect(template.toolMapping.query).toBe("read-cypher");
  });

  it("Spanner template has correct tool mapping", async () => {
    const res = await request(app)
      .get("/api/console/templates/spanner-toolbox")
      .set("Host", "127.0.0.1:19285");
    const template = res.body.template;
    expect(template.toolMapping.schema).toBe("spanner-list-graphs");
    expect(template.toolMapping.query).toBe("spanner-sql");
    expect(template.transport).toBe("http");
  });
});

describe("Provider Tools API", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const test = createTestApp();
    app = test.app;
  });

  it("returns 404 for non-MCP provider tools", async () => {
    // Mock adapter doesn't have MCP tools tracked
    const res = await request(app)
      .get("/api/console/providers/mock/tools")
      .set("Host", "127.0.0.1:19285");
    // mock is not managed via MCP so no tools are tracked
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown provider", async () => {
    const res = await request(app)
      .get("/api/console/providers/nonexistent/tools")
      .set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(404);
  });
});
