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
  allowedOrigins: ["https://graphxr.kineviz.com", "http://localhost:9000"],
  tokenTTL: 3600,
  pairingTimeout: 300,
  rateLimit: { windowMs: 60000, max: 60 },
  providers: [],
};

function createTestApp(configOverrides?: Partial<GatewayConfig>) {
  const config = { ...testConfig, ...configOverrides };
  const configPath = path.resolve(__dirname, "../../gateway.config.json");
  const configManager = new ConfigManager(configPath, config);
  const pm = new PairingManager({ pairingTimeoutSec: 300, tokenTTLSec: 3600 });
  const mcpManager = new MCPManager();
  mcpManager.init([]);
  return { app: createApp(configManager, pm, mcpManager), pm, mcpManager };
}

describe("Health endpoint", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const test = createTestApp();
    app = test.app;
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health").set("Host", "127.0.0.1:19285");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe("0.1.0");
    expect(res.body.providers).toHaveLength(1);
    expect(res.body.providers[0].name).toBe("mock");
  });

  it("rejects invalid Host header", async () => {
    const res = await request(app).get("/health").set("Host", "evil.com");
    expect(res.status).toBe(403);
  });
});

describe("CORS", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const test = createTestApp();
    app = test.app;
  });

  it("allows valid origin", async () => {
    const res = await request(app)
      .get("/health")
      .set("Host", "127.0.0.1:19285")
      .set("Origin", "https://graphxr.kineviz.com");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://graphxr.kineviz.com");
  });

  it("rejects disallowed origin", async () => {
    const res = await request(app)
      .get("/health")
      .set("Host", "127.0.0.1:19285")
      .set("Origin", "https://evil.com");
    expect(res.status).toBe(403);
  });

  it("handles preflight OPTIONS", async () => {
    const res = await request(app)
      .options("/graph/neighbors")
      .set("Host", "127.0.0.1:19285")
      .set("Origin", "https://graphxr.kineviz.com");
    expect(res.status).toBe(204);
  });

  it("allows all origins when wildcard is configured", () => {
    const test = createTestApp({ allowedOrigins: ["*"] });
    return request(test.app)
      .get("/health")
      .set("Host", "127.0.0.1:19285")
      .set("Origin", "https://any-origin.example.com")
      .expect(200)
      .then((res) => {
        expect(res.headers["access-control-allow-origin"]).toBe("https://any-origin.example.com");
      });
  });
});
