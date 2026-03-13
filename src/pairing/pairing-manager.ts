import crypto from "node:crypto";

interface PairingSession {
  id: string;
  origin: string;
  scopes: string[];
  status: "pending" | "approved" | "denied";
  createdAt: number;
  token?: string;
  expiresAt?: number;
}

interface TokenEntry {
  token: string;
  origin: string;
  expiresAt: number;
}

export class PairingManager {
  private sessions = new Map<string, PairingSession>();
  private tokens = new Map<string, TokenEntry>();
  private pairingTimeoutMs: number;
  private tokenTTLMs: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(opts: { pairingTimeoutSec: number; tokenTTLSec: number }) {
    this.pairingTimeoutMs = opts.pairingTimeoutSec * 1000;
    this.tokenTTLMs = opts.tokenTTLSec * 1000;
    // Periodic cleanup every 60s
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
  }

  startPairing(origin: string, scopes: string[]): { pairingId: string } {
    // Only allow one pending pairing at a time (DoS protection)
    for (const [id, session] of this.sessions) {
      if (session.status === "pending") {
        // Auto-deny stale pairings
        if (Date.now() - session.createdAt > this.pairingTimeoutMs) {
          session.status = "denied";
        } else {
          // Already have an active pairing
          return { pairingId: id };
        }
      }
    }

    const pairingId = crypto.randomUUID();
    this.sessions.set(pairingId, {
      id: pairingId,
      origin,
      scopes,
      status: "pending",
      createdAt: Date.now(),
    });

    return { pairingId };
  }

  getSession(pairingId: string): PairingSession | undefined {
    return this.sessions.get(pairingId);
  }

  getStatus(
    pairingId: string
  ): { status: "pending" } | { status: "approved"; token: string; expiresAt: string } | { status: "denied" } | null {
    const session = this.sessions.get(pairingId);
    if (!session) return null;

    // Check timeout
    if (
      session.status === "pending" &&
      Date.now() - session.createdAt > this.pairingTimeoutMs
    ) {
      session.status = "denied";
    }

    if (session.status === "pending") {
      return { status: "pending" };
    }
    if (session.status === "denied") {
      return { status: "denied" };
    }
    // approved
    return {
      status: "approved",
      token: session.token!,
      expiresAt: new Date(session.expiresAt!).toISOString(),
    };
  }

  approve(pairingId: string): boolean {
    const session = this.sessions.get(pairingId);
    if (!session || session.status !== "pending") return false;

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + this.tokenTTLMs;

    session.status = "approved";
    session.token = token;
    session.expiresAt = expiresAt;

    this.tokens.set(token, {
      token,
      origin: session.origin,
      expiresAt,
    });

    return true;
  }

  deny(pairingId: string): boolean {
    const session = this.sessions.get(pairingId);
    if (!session || session.status !== "pending") return false;
    session.status = "denied";
    return true;
  }

  validateToken(token: string, origin: string): boolean {
    const entry = this.tokens.get(token);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.tokens.delete(token);
      return false;
    }
    // Token is bound to the origin that initiated pairing
    // Allow empty origin (non-browser clients like curl for testing)
    if (origin && entry.origin !== origin) return false;
    return true;
  }

  listSessions(): Array<{
    id: string;
    origin: string;
    scopes: string[];
    status: "pending" | "approved" | "denied";
    createdAt: string;
  }> {
    const result = [];
    for (const session of this.sessions.values()) {
      result.push({
        id: session.id,
        origin: session.origin,
        scopes: session.scopes,
        status: session.status,
        createdAt: new Date(session.createdAt).toISOString(),
      });
    }
    return result;
  }

  listActiveTokens(): Array<{
    tokenPrefix: string;
    origin: string;
    expiresAt: string;
  }> {
    const now = Date.now();
    const result = [];
    for (const entry of this.tokens.values()) {
      if (now <= entry.expiresAt) {
        result.push({
          tokenPrefix: entry.token.slice(0, 8),
          origin: entry.origin,
          expiresAt: new Date(entry.expiresAt).toISOString(),
        });
      }
    }
    return result;
  }

  revokeToken(tokenPrefix: string): boolean {
    for (const [token] of this.tokens) {
      if (token.startsWith(tokenPrefix)) {
        this.tokens.delete(token);
        return true;
      }
    }
    return false;
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  get activeTokenCount(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.tokens.values()) {
      if (now <= entry.expiresAt) count++;
    }
    return count;
  }

  private cleanup(): void {
    const now = Date.now();
    // Clean expired sessions (older than timeout + 1 hour buffer)
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > this.pairingTimeoutMs + 3_600_000) {
        this.sessions.delete(id);
      }
    }
    // Clean expired tokens
    for (const [token, entry] of this.tokens) {
      if (now > entry.expiresAt) {
        this.tokens.delete(token);
      }
    }
  }
}
