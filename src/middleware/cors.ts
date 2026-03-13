import type { Request, Response, NextFunction } from "express";

/**
 * Match an origin against an allowlist pattern.
 * Supports wildcard subdomains like "https://*.graphxr.com".
 */
export function matchOrigin(origin: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return origin === pattern;
  }
  // Convert "https://*.graphxr.com" → regex "^https://[^/]+\\.graphxr\\.com$"
  // Replace * with placeholder first, then escape special chars, then restore
  const placeholder = "\0WILDCARD\0";
  const escaped = pattern
    .replace(/\*/g, placeholder)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(new RegExp(placeholder.replace(/\0/g, "\\0"), "g"), "[^/]+");
  return new RegExp(`^${escaped}$`).test(origin);
}

export function corsMiddleware(getAllowedOrigins: () => string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // No origin → non-browser request or same-origin; allow but no CORS headers
    if (!origin) {
      next();
      return;
    }

    // Console routes are local-only (host guard protected) — allow any origin
    if (req.path.startsWith("/api/console/")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      next();
      return;
    }

    // Reject "null" origin explicitly
    if (origin === "null") {
      res.status(403).json({ error: "Origin null is not allowed" });
      return;
    }

    const allowedOrigins = getAllowedOrigins();

    // Wildcard "*" allows all origins
    const allowed =
      allowedOrigins.includes("*") ||
      allowedOrigins.some((p) => matchOrigin(origin, p));

    if (!allowed) {
      res.status(403).json({ error: `Origin ${origin} is not allowed` });
      return;
    }

    // Exact echo — never use "*"
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Max-Age", "3600");
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}
