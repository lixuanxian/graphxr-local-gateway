import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { rateLimitMiddleware } from "../../src/middleware/rate-limit.js";

describe("Rate Limit Middleware", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(rateLimitMiddleware(() => ({ windowMs: 1000, max: 3 })));
    app.get("/api/test", (_req, res) => res.json({ ok: true }));
    app.get("/api/console/test", (_req, res) => res.json({ ok: true }));
    app.get("/health", (_req, res) => res.json({ ok: true }));
  });

  it("allows requests under the limit", async () => {
    const res = await request(app).get("/api/test");
    expect(res.status).toBe(200);
    expect(res.headers["x-ratelimit-limit"]).toBe("3");
    expect(res.headers["x-ratelimit-remaining"]).toBe("2");
  });

  it("blocks requests over the limit", async () => {
    await request(app).get("/api/test");
    await request(app).get("/api/test");
    await request(app).get("/api/test");
    const res = await request(app).get("/api/test");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("Too many requests");
  });

  it("skips rate limiting for console paths", async () => {
    // Exhaust the limit on API
    await request(app).get("/api/test");
    await request(app).get("/api/test");
    await request(app).get("/api/test");
    await request(app).get("/api/test");

    // Console path should still work
    const res = await request(app).get("/api/console/test");
    expect(res.status).toBe(200);
  });

  it("skips rate limiting for health endpoint", async () => {
    await request(app).get("/api/test");
    await request(app).get("/api/test");
    await request(app).get("/api/test");
    await request(app).get("/api/test");

    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("sets rate limit headers", async () => {
    const res = await request(app).get("/api/test");
    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    expect(res.headers["x-ratelimit-reset"]).toBeDefined();
  });
});
