import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import { mapGatewayPath, startGatewayServer } from "./gateway.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function startTarget(): Promise<{ server: Server; url: string }> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "pcrd" }));
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      method: req.method,
      url: req.url,
      body: await readBody(req),
      host: req.headers.host,
    }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("Target server did not bind to a TCP port.");
  }
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

describe("pcr gateway", () => {
  it("maps the bare host root to dashboard history", () => {
    expect(mapGatewayPath(undefined)).toBe("/dashboard/history/");
    expect(mapGatewayPath("/")).toBe("/dashboard/history/");
    expect(mapGatewayPath("/?limit=1")).toBe("/dashboard/history/?limit=1");
    expect(mapGatewayPath("/health")).toBe("/health");
    expect(mapGatewayPath("/v1/history?limit=1")).toBe("/v1/history?limit=1");
    expect(mapGatewayPath("http://example.test/v1/history?limit=1")).toBe("/v1/history?limit=1");
  });

  it("proxies root, health, API, dev, and dashboard routes to pcrd", async () => {
    const target = await startTarget();
    const gateway = await startGatewayServer({ port: 0, target: target.url });
    try {
      const root = await fetch(`${gateway.url}/`);
      expect(await root.json()).toMatchObject({ url: "/dashboard/history/" });

      const health = await fetch(`${gateway.url}/health`);
      expect(await health.json()).toMatchObject({ ok: true, service: "pcrd" });

      const api = await fetch(`${gateway.url}/v1/history?limit=1`);
      expect(await api.json()).toMatchObject({ url: "/v1/history?limit=1" });

      const dev = await fetch(`${gateway.url}/dev/assets/dashboard.js`);
      expect(await dev.json()).toMatchObject({ url: "/dev/assets/dashboard.js" });

      const dashboard = await fetch(`${gateway.url}/dashboard/tools/`, {
        method: "POST",
        body: "payload",
      });
      expect(await dashboard.json()).toMatchObject({
        method: "POST",
        url: "/dashboard/tools/",
        body: "payload",
      });
    } finally {
      await gateway.close();
      await closeServer(target.server);
    }
  });
});
