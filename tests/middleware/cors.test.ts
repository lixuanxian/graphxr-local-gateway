import { describe, it, expect } from "vitest";
import { matchOrigin } from "../../src/middleware/cors.js";

describe("matchOrigin", () => {
  it("matches exact origins", () => {
    expect(matchOrigin("https://graphxr.kineviz.com", "https://graphxr.kineviz.com")).toBe(true);
    expect(matchOrigin("https://other.com", "https://graphxr.kineviz.com")).toBe(false);
  });

  it("matches wildcard subdomain patterns", () => {
    expect(matchOrigin("https://app.graphxr.com", "https://*.graphxr.com")).toBe(true);
    expect(matchOrigin("https://staging.graphxr.com", "https://*.graphxr.com")).toBe(true);
    expect(matchOrigin("https://graphxr.com", "https://*.graphxr.com")).toBe(false);
    expect(matchOrigin("https://evil.com", "https://*.graphxr.com")).toBe(false);
  });

  it("does not match across protocols", () => {
    expect(matchOrigin("http://graphxr.kineviz.com", "https://graphxr.kineviz.com")).toBe(false);
  });

  it("rejects null origin", () => {
    expect(matchOrigin("null", "https://graphxr.kineviz.com")).toBe(false);
  });

  it("matches localhost dev origins", () => {
    expect(matchOrigin("https://localhost:9000", "https://localhost:9000")).toBe(true);
    expect(matchOrigin("http://localhost:9000", "http://localhost:9000")).toBe(true);
    expect(matchOrigin("http://localhost:3000", "http://localhost:9000")).toBe(false);
  });
});
