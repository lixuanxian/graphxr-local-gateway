import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PairingManager } from "../../src/pairing/pairing-manager.js";

describe("PairingManager", () => {
  let pm: PairingManager;

  beforeEach(() => {
    pm = new PairingManager({ pairingTimeoutSec: 5, tokenTTLSec: 60 });
  });

  afterEach(() => {
    pm.destroy();
  });

  it("starts a pairing session", () => {
    const { pairingId } = pm.startPairing("https://graphxr.kineviz.com", ["graph:read"]);
    expect(pairingId).toBeTruthy();

    const status = pm.getStatus(pairingId);
    expect(status).toEqual({ status: "pending" });
  });

  it("approves pairing and returns token", () => {
    const { pairingId } = pm.startPairing("https://graphxr.kineviz.com", ["graph:read"]);
    const ok = pm.approve(pairingId);
    expect(ok).toBe(true);

    const status = pm.getStatus(pairingId);
    expect(status?.status).toBe("approved");
    expect((status as any).token).toBeTruthy();
    expect((status as any).expiresAt).toBeTruthy();
  });

  it("denies pairing", () => {
    const { pairingId } = pm.startPairing("https://graphxr.kineviz.com", ["graph:read"]);
    pm.deny(pairingId);

    const status = pm.getStatus(pairingId);
    expect(status).toEqual({ status: "denied" });
  });

  it("validates token with correct origin", () => {
    const origin = "https://graphxr.kineviz.com";
    const { pairingId } = pm.startPairing(origin, ["graph:read"]);
    pm.approve(pairingId);

    const status = pm.getStatus(pairingId) as any;
    expect(pm.validateToken(status.token, origin)).toBe(true);
  });

  it("rejects token with wrong origin", () => {
    const origin = "https://graphxr.kineviz.com";
    const { pairingId } = pm.startPairing(origin, ["graph:read"]);
    pm.approve(pairingId);

    const status = pm.getStatus(pairingId) as any;
    expect(pm.validateToken(status.token, "https://evil.com")).toBe(false);
  });

  it("rejects invalid token", () => {
    expect(pm.validateToken("nonexistent", "https://graphxr.kineviz.com")).toBe(false);
  });

  it("only allows one pending pairing at a time", () => {
    const first = pm.startPairing("https://a.graphxr.com", ["graph:read"]);
    const second = pm.startPairing("https://b.graphxr.com", ["graph:read"]);
    // Should return same pairingId
    expect(second.pairingId).toBe(first.pairingId);
  });

  it("returns null for unknown pairingId", () => {
    expect(pm.getStatus("unknown-id")).toBeNull();
  });

  it("cannot approve already denied session", () => {
    const { pairingId } = pm.startPairing("https://graphxr.kineviz.com", ["graph:read"]);
    pm.deny(pairingId);
    expect(pm.approve(pairingId)).toBe(false);
  });
});
