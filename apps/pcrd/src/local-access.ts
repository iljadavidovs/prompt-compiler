import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Express } from "express";

/** Browser bootstrap is same-origin only; other clients receive the ephemeral token from startServer. */
export function installLocalAccess(app: Express, token: string): void {
  app.use((req, res, next) => {
    let authority: URL;
    try { authority = new URL(`http://${req.headers.host ?? ""}`); }
    catch { res.status(403).json({ error: "Invalid local authority." }); return; }
    if (!["127.0.0.1", "localhost"].includes(authority.hostname) || authority.username || authority.password) {
      res.status(403).json({ error: "Local authority required." }); return;
    }
    const origin = req.headers.origin;
    const dashboardNavigation = req.method === "GET" && (req.path === "/dashboard" || req.path.startsWith("/dashboard/"))
      && req.headers["sec-fetch-mode"] === "navigate" && req.headers["sec-fetch-dest"] === "document";
    if (!dashboardNavigation && ((origin && origin !== authority.origin) || ["cross-site", "same-site"].includes(String(req.headers["sec-fetch-site"] ?? "")))) {
      res.status(403).json({ error: "Same-origin access required." }); return;
    }
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (req.path.startsWith("/v1/")) res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/v1/session", (req, res) => {
    if (req.headers["sec-fetch-site"] !== "same-origin" || req.headers["x-pcr-bootstrap"] !== "1") {
      res.status(403).json({ error: "Open the local dashboard to start a browser session." }); return;
    }
    res.json({ token });
  });
  app.use("/v1", (req, res, next) => {
    const supplied = Buffer.from(String(req.headers["x-pcr-token"] ?? ""));
    const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.status(401).json({ error: "Local session required. Reload the dashboard." }); return;
    }
    next();
  });
}

export function createLocalToken(): string { return randomBytes(32).toString("hex"); }
