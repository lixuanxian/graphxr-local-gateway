import type { Request, Response, NextFunction } from "express";

const ALLOWED_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
]);

/**
 * Reject requests whose Host header doesn't match 127.0.0.1 or localhost.
 * Prevents DNS rebinding attacks.
 */
export function hostGuardMiddleware(port: number) {
  const allowedWithPort = new Set<string>();
  for (const host of ALLOWED_HOSTS) {
    allowedWithPort.add(host);
    allowedWithPort.add(`${host}:${port}`);
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const host = req.headers.host;

    if (!host || !allowedWithPort.has(host)) {
      res
        .status(403)
        .json({ error: `Forbidden: invalid Host header "${host}"` });
      return;
    }

    next();
  };
}
