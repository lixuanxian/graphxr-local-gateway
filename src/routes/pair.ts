import { Router } from "express";
import type { PairingManager } from "../pairing/pairing-manager.js";
import type { PairStartRequest } from "../types/api.js";
import { openBrowser } from "../utils/open-browser.js";
import { logger } from "../utils/logger.js";

export function pairRouter(
  pairingManager: PairingManager,
  port: number
): Router {
  const router = Router();

  // POST /pair/start — initiate pairing from GraphXR frontend
  router.post("/pair/start", (req, res) => {
    const body = req.body as PairStartRequest;
    if (!body.origin) {
      res.status(400).json({ error: "origin is required" });
      return;
    }

    const { pairingId } = pairingManager.startPairing(
      body.origin,
      body.scopes ?? ["graph:read"]
    );

    const confirmUrl = `http://127.0.0.1:${port}/pair/confirm?pairingId=${pairingId}`;

    logger.audit("pair:start", { pairingId, origin: body.origin });

    // Open browser for user to confirm
    openBrowser(confirmUrl);

    res.json({ pairingId, confirmUrl });
  });

  // GET /pair/status — poll pairing status
  router.get("/pair/status", (req, res) => {
    const pairingId = req.query.pairingId as string;
    if (!pairingId) {
      res.status(400).json({ error: "pairingId is required" });
      return;
    }

    const status = pairingManager.getStatus(pairingId);
    if (!status) {
      res.status(404).json({ error: "Pairing session not found" });
      return;
    }

    res.json(status);
  });

  // GET /pair/session — get session info (for confirm page)
  router.get("/pair/session", (req, res) => {
    const pairingId = req.query.pairingId as string;
    const session = pairingManager.getSession(pairingId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ origin: session.origin, scopes: session.scopes });
  });

  // POST /pair/approve — user approves pairing (from confirm page)
  router.post("/pair/approve", (req, res) => {
    const { pairingId } = req.body;
    if (!pairingId) {
      res.status(400).json({ error: "pairingId is required" });
      return;
    }

    const ok = pairingManager.approve(pairingId);
    if (!ok) {
      res.status(400).json({ error: "Cannot approve: session not found or not pending" });
      return;
    }

    logger.audit("pair:approve", { pairingId });
    res.json({ status: "approved" });
  });

  // POST /pair/deny — user denies pairing
  router.post("/pair/deny", (req, res) => {
    const { pairingId } = req.body;
    if (!pairingId) {
      res.status(400).json({ error: "pairingId is required" });
      return;
    }

    const ok = pairingManager.deny(pairingId);
    if (!ok) {
      res.status(400).json({ error: "Cannot deny: session not found or not pending" });
      return;
    }

    logger.audit("pair:deny", { pairingId });
    res.json({ status: "denied" });
  });

  return router;
}
