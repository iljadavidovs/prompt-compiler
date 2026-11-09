import { request } from "node:http";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startServer } from "./server.js";
import { hashContent } from "./workspace-store.js";

afterEach(() => { vi.unstubAllEnvs(); });
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "pcr-ui-api-"));
  vi.stubEnv("PCR_USER_DIR", dir); vi.stubEnv("PCR_DB_PATH", join(dir, "pcr.sqlite"));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "config.yaml"), 'tools:\n  enabled: [coding, planner, progress-assessment, grammar]\nintelligence:\n  enabled: true\n  apiKey: synthetic-secret-key\n');
  const server = await startServer({ workspaceDir: dir, port: 0 });
  const call = (path: string, body?: unknown, headers: Record<string, string> = {}) => fetch(`${server.url}/v1${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", "x-pcr-token": server.apiToken, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { dir, server, call };
}
const item = (id: string, content: string): any => ({ id, revision: 1, title: id, content, type: "context", purpose: "Synthetic API regression", inputs: [], outputCriteria: "Preserve exact sources", tags: ["synthetic"], provenance: "Synthetic fixture", sensitivity: "non-sensitive", source: { host: "quaggit-fixture", artifactId: `qg_${id}`, projectId: "synthetic-host-project", revision: id === "one" ? 4 : 9, contentHash: hashContent(content) } });

describe("local playground API", () => {
  it("allows top-level dashboard navigation while rejecting cross-site API and frame requests", async () => {
    const f = await fixture();
    const navigate = (path: string, destination = "document") => new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const req = request(`${f.server.url}${path}`, { headers: { origin: "https://untrusted.invalid", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": destination } }, response => {
        let body = ""; response.setEncoding("utf8"); response.on("data", chunk => { body += chunk; });
        response.on("end", () => resolve({ status: response.statusCode, body }));
      });
      req.on("error", reject); req.end();
    });
    try {
      const page = await navigate("/dashboard/playground/");
      expect(page.status).toBe(200); expect(page.body).toContain('id="compile"');
      expect((await navigate("/v1/history")).status).toBe(403);
      expect((await navigate("/v1/session")).status).toBe(403);
      expect((await navigate("/dashboard/playground/", "iframe")).status).toBe(403);
    } finally { await f.server.close(); }
  });
  it("requires a local session and exact origin/authority; bootstrap and settings never expose configured keys", async () => {
    const f = await fixture();
    try {
      for (const path of ["/history", "/settings", "/workspace", "/library/export", "/tools"]) expect((await fetch(`${f.server.url}/v1${path}`)).status).toBe(401);
      expect((await fetch(`${f.server.url}/v1/session`)).status).toBe(403);
      expect((await f.call('/history', undefined, { origin: "https://untrusted.invalid" })).status).toBe(403);
      const badHost = await new Promise<number | undefined>(resolve => { const req = request(`${f.server.url}/v1/history`, { headers: { host: 'evil.invalid', 'x-pcr-token': f.server.apiToken } }, response => { response.resume(); resolve(response.statusCode); }); req.end(); });
      expect(badHost).toBe(403);
      expect((await f.call('/history', undefined, { origin: "http://localhost:9999" })).status).toBe(403);
      const bootstrap = await fetch(`${f.server.url}/v1/session`, { headers: { 'sec-fetch-site': 'same-origin', 'x-pcr-bootstrap': '1' } });
      expect((await bootstrap.json() as any).token).toBe(f.server.apiToken);
      const settings = await (await f.call('/settings')).text();
      expect(settings).not.toContain('synthetic-secret-key'); expect(settings).toContain('[REDACTED_SECRET]');
      expect((await f.call('/settings', { config: { intelligence: { enabled: true } } })).status).toBe(403);
      expect((await f.call('/context/index', {})).status).toBe(403);
      expect((await f.call('/history?cwd=/other')).status).toBe(400);
      const page = await fetch(`${f.server.url}/dashboard/playground/`);
      expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    } finally { await f.server.close(); }
  });
  it("round-trips two exact revisions, roles/order, idempotent concurrent/restarted requests and feedback", async () => {
    const f = await fixture();
    try {
      const items = [item("one", "SYNTHETIC_FIRST"), item("two", "SYNTHETIC_SECOND")];
      const imported = await f.call('/library/import', { format: 'pcr-library', schemaVersion: 1, projectId: 'synthetic-host-project', items }); expect(imported.status).toBe(200);
      const workspace = await (await f.call('/workspace')).json() as any;
      const bindings = workspace.items.map((entry: any, index: number) => ({ id: entry.id, revision: entry.revision, contentHash: entry.contentHash, role: index ? 'criteria' : 'requirement', enabled: true }));
      const input = { requestId: "synthetic-compile-one", rawText: "implement a code review", projectId: workspace.projectId, maxContextTokens: 6000, bindings };
      const responses = await Promise.all([f.call('/playground/compile', input), f.call('/playground/compile', input)]);
      const outputs = await Promise.all(responses.map(response => response.json())) as any[];
      expect(outputs[0].metadata.compileId).toBe(outputs[1].metadata.compileId);
      expect(outputs[0].metadata.provenance.derivedFrom.map((source: any) => source.source.revision)).toEqual([4, 9]);
      expect(outputs[0].prompt).toContain('SYNTHETIC_FIRST'); expect(outputs[0].prompt).toContain('SYNTHETIC_SECOND');
      expect((await (await f.call('/history')).json() as any[])).toHaveLength(1);
      const repeated = await (await f.call('/playground/compile', input)).json() as any;
      expect(repeated.metadata.compileId).toBe(outputs[0].metadata.compileId);
      expect((await f.call('/playground/compile', { ...input, rawText: 'different' })).status).toBe(409);
      expect((await f.call('/playground/compile', { ...input, requestId: 'wrong-project', projectId: 'another-project' })).status).toBe(409);
      const id = outputs[0].metadata.compileId;
      for (const rating of ['like', 'neutral', 'dislike']) expect((await f.call(`/history/${id}/feedback`, { rating, comment: 'synthetic note' })).status).toBe(200);
      expect((await (await f.call(`/history/${id}/feedback`)).json() as any[])).toHaveLength(3);
      expect((await f.call(`/history/${id}/feedback`, { rating: 'invalid' })).status).toBe(400);
      const noSources = await (await f.call('/playground/compile', { ...input, requestId: 'no-sources', bindings: [] })).json() as any;
      expect(noSources.prompt).not.toContain('SYNTHETIC_FIRST'); expect(noSources.prompt).not.toContain('synthetic note');
    } finally { await f.server.close(); }
  });
  it("rejects stale or missing selected sources, skipped/empty input, bad imports and command configuration", async () => {
    const f = await fixture();
    try {
      const saved = await (await f.call('/library', { item: { ...item('one', 'SYNTHETIC_CONTEXT'), source: undefined }, expectedRevision: 0 })).json() as any;
      const workspace = await (await f.call('/workspace')).json() as any;
      const input = { requestId: 'missing', rawText: 'implement code', projectId: workspace.projectId, maxContextTokens: 6000, bindings: [{ id: saved.id, revision: 99, contentHash: saved.contentHash, role: 'background', enabled: true }] };
      expect((await f.call('/playground/compile', input)).status).toBe(409);
      expect((await f.call('/library', { item: { ...saved, archived: true }, expectedRevision: 1 })).status).toBe(200);
      expect((await f.call('/playground/compile', { ...input, bindings: [{ ...input.bindings[0], revision: 1 }] })).status).toBe(409);
      const skipped = await (await f.call('/playground/compile', { ...input, requestId: 'skipped', bindings: [], rawText: 'hello there' })).json() as any;
      expect(skipped.metadata.skipped).toBe(true); expect(skipped.prompt).toBe('');
      const explicit = await (await f.call('/playground/compile', { ...input, requestId: 'explicit-skip', bindings: [], skip: true })).json() as any;
      expect(explicit.metadata.skipReason).toContain('explicitly');
      expect((await f.call('/playground/compile', { ...input, bindings: [], rawText: '   ' })).status).toBe(400);
      expect((await f.call('/tools/planner', { enabled: true, config: { reminders: { command: 'arbitrary' } } })).status).toBe(403);
      expect((await f.call('/library/import', { format: 'pcr-library', schemaVersion: 9, items: [] })).status).toBe(400);
    } finally { await f.server.close(); }
  });
  it("retains compile identity across a real server restart and session rotation", async () => {
    const f = await fixture();
    let server = f.server;
    try {
      const workspace = await (await f.call('/workspace')).json() as any;
      const input = { requestId: 'retry-after-restart', projectId: workspace.projectId, rawText: 'implement code', bindings: [], maxContextTokens: 6000 };
      const first = await (await f.call('/playground/compile', input)).json() as any;
      await server.close();
      server = await startServer({ workspaceDir: f.dir, port: 0 });
      expect(server.apiToken).not.toBe(f.server.apiToken);
      const headers = { 'content-type': 'application/json', 'x-pcr-token': server.apiToken };
      const response = await fetch(`${server.url}/v1/playground/compile`, { method: 'POST', headers, body: JSON.stringify(input) });
      expect(response.status).toBe(200);
      expect((await response.json() as any).metadata.compileId).toBe(first.metadata.compileId);
      expect((await (await fetch(`${server.url}/v1/history`, { headers })).json() as any[])).toHaveLength(1);
    } finally { if (server.server.listening) await server.close(); }
  });
});
