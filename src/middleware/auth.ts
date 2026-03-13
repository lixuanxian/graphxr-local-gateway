import type { Request, Response, NextFunction } from "express";
import type { PairingManager } from "../pairing/pairing-manager.js";

/**
 * Bearer token auth middleware.
 * Skips auth for whitelisted paths (health, pairing, pair confirm page).
 */
const PUBLIC_PATHS = new Set(["/health", "/pair/start", "/pair/status", "/pair/confirm", "/pair/approve"]);

export function authMiddleware(pairingManager: PairingManager) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Allow public endpoints
    if (PUBLIC_PATHS.has(req.path)) {
      next();
      return;
    }

    // Allow static assets and console (local-only, protected by Host guard)
    if (req.path.startsWith("/public/") || req.path === "/console" || req.path.startsWith("/console/") || req.path.startsWith("/api/console/")) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const token = authHeader.slice(7);
    const origin = req.headers.origin ?? "";

    if (!pairingManager.validateToken(token, origin)) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }

    next();
  };
}
