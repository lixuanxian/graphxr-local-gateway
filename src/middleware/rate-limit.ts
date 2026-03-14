import type { Request, Response, NextFunction } from "express";
import type { RateLimitConfig } from "../types/config.js";

/**
 * Simple in-memory sliding-window rate limiter per IP address.
 * Only applies to authenticated API routes (not console or public paths).
 */
export function rateLimitMiddleware(getConfig: () => RateLimitConfig) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Cleanup stale entries periodically
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) {
        hits.delete(key);
      }
    }
  }, 60_000);
  if (cleanupTimer.unref) cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting for console and public paths
    if (
      req.path.startsWith("/api/console/") ||
      req.path === "/health" ||
      req.path.startsWith("/console") ||
      req.path.startsWith("/pair/")
    ) {
      next();
      return;
    }

    const config = getConfig();
    if (config.max <= 0) {
      next();
      return;
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();

    let entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + config.windowMs };
      hits.set(ip, entry);
    }

    entry.count++;

    // Set rate limit headers
    const remaining = Math.max(0, config.max - entry.count);
    res.setHeader("X-RateLimit-Limit", config.max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > config.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: "Too many requests",
        retryAfter,
      });
      return;
    }

    next();
  };
}
