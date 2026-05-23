import type { Server } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import YAML from "yaml";
import { compilePrompt, getToolStates, listBuiltinProfiles, listBuiltinTemplates, listAvailableTools, resolveConfig } from "@pcr/core";
import { indexLocalContext } from "@pcr/context";
import { dashboardDistPath } from "@pcr/dashboard";
import { searchContext } from "@pcr/retrieval";
import { createPcrStore } from "@pcr/store";
import { PcrConfigSchema, resolvePcrPaths, type CompilePromptInput, type PcrConfig } from "@pcr/shared";

export interface StartServerOptions {
  host?: string;
  port?: number;
}

export interface StartedServer {
  app: express.Express;
  server: Server;
  url: string;
  close: () => Promise<void>;
}

function dbPathFor(cwd?: string): string {
  return process.env.PCR_DB_PATH ?? resolvePcrPaths(cwd, process.env.PCR_USER_DIR).dbPath;
}

async function readUserConfig(cwd?: string): Promise<{ config: PcrConfig; configPath: string; paths: ReturnType<typeof resolvePcrPaths> }> {
  const paths = resolvePcrPaths(cwd, process.env.PCR_USER_DIR);
  const configPath = join(paths.userDir, "config.yaml");
  try {
    return {
      config: PcrConfigSchema.parse(YAML.parse(await readFile(configPath, "utf8")) ?? {}),
      configPath,
      paths,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { config: {}, configPath, paths };
    }
    throw error;
  }
}

async function writeUserConfig(cwd: string | undefined, config: PcrConfig): Promise<string> {
  const { configPath } = await readUserConfig(cwd);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, YAML.stringify(PcrConfigSchema.parse(config)));
  return configPath;
}

function allowOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void): void {
  if (!origin) {
    callback(null, true);
    return;
  }
  try {
    const url = new URL(origin);
    callback(null, ["127.0.0.1", "localhost", "pcr.lan"].includes(url.hostname));
  } catch {
    callback(null, false);
  }
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(cors({
    origin: allowOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["content-type"],
    credentials: false,
    maxAge: 600,
  }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "pcrd", version: "0.1.0" });
  });

  app.use((req, res, next) => {
    if (req.path === "/dashboard" || req.path === "/dashboard/") {
      res.redirect("/dashboard/history/");
      return;
    }
    next();
  });

  app.use("/dashboard", express.static(dashboardDistPath("dev"), { extensions: ["html"] }));
  app.use("/dev", express.static(dashboardDistPath("dev"), { extensions: ["html"] }));

  app.post("/v1/compile", asyncRoute(async (req, res) => {
    const body = req.body as Partial<CompilePromptInput>;
    const output = await compilePrompt({
      source: body.source ?? "http",
      rawText: String(body.rawText ?? ""),
      mode: body.mode,
      templateId: body.templateId,
      profileId: body.profileId,
      cwd: body.cwd,
      contextHints: body.contextHints,
      contextBlocks: body.contextBlocks,
      vars: body.vars,
      options: body.options,
    });
    res.json(output);
  }));

  app.post("/v1/context/index", asyncRoute(async (req, res) => {
    const cwd = typeof req.body?.cwd === "string" ? req.body.cwd : undefined;
    const result = await indexLocalContext({ cwd, dbPath: dbPathFor(cwd) });
    res.json(result);
  }));

  app.get("/v1/context/search", asyncRoute((req, res) => {
    const query = String(req.query.q ?? "");
    const cwd = typeof req.query.cwd === "string" ? req.query.cwd : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const store = createPcrStore({ dbPath: dbPathFor(cwd) });
    try {
      res.json(searchContext(store, query, { limit }));
    } finally {
      store.close();
    }
  }));

  app.get("/v1/history", asyncRoute((req, res) => {
    const cwd = typeof req.query.cwd === "string" ? req.query.cwd : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const store = createPcrStore({ dbPath: dbPathFor(cwd) });
    try {
      res.json(store.listCompilations(limit));
    } finally {
      store.close();
    }
  }));

  app.get("/v1/history/:id", asyncRoute((req, res) => {
    const cwd = typeof req.query.cwd === "string" ? req.query.cwd : undefined;
    const store = createPcrStore({ dbPath: dbPathFor(cwd) });
    try {
      const compileId = String(req.params.id);
      const record = store.getCompilation(compileId);
      if (!record) {
        res.status(404).json({ error: "Compilation not found." });
        return;
      }
      res.json(record);
    } finally {
      store.close();
    }
  }));

  app.post("/v1/history/:id/feedback", asyncRoute((req, res) => {
    const cwd = typeof req.body?.cwd === "string" ? req.body.cwd : undefined;
    const store = createPcrStore({ dbPath: dbPathFor(cwd) });
    try {
      const feedback = store.addFeedback({
        compileId: String(req.params.id),
        rating: req.body.rating,
        outcome: req.body.outcome,
        comment: req.body.comment,
      });
      res.json(feedback);
    } finally {
      store.close();
    }
  }));

  app.get("/v1/templates", (_req, res) => {
    res.json(listBuiltinTemplates());
  });

  app.get("/v1/profiles", (_req, res) => {
    res.json(listBuiltinProfiles());
  });

  app.get("/v1/settings", asyncRoute(async (req, res) => {
    const cwd = typeof req.query.cwd === "string" ? req.query.cwd : undefined;
    const paths = resolvePcrPaths(cwd, process.env.PCR_USER_DIR);
    const config = await resolveConfig(paths.cwd, paths.userDir);
    const tools = await getToolStates(paths.cwd, paths.userDir);
    res.json({
      config,
      tools,
      paths: {
        cwd: paths.cwd,
        userDir: paths.userDir,
        projectDir: paths.projectDir,
        dbPath: paths.dbPath,
        userConfigPath: join(paths.userDir, "config.yaml"),
      },
    });
  }));

  app.post("/v1/settings", asyncRoute(async (req, res) => {
    const cwd = typeof req.body?.cwd === "string" ? req.body.cwd : undefined;
    const config = PcrConfigSchema.parse(req.body.config ?? {});
    const configPath = await writeUserConfig(cwd, config);
    res.json({ ok: true, configPath, config });
  }));

  app.get("/v1/tools", asyncRoute(async (req, res) => {
    const cwd = typeof req.query.cwd === "string" ? req.query.cwd : undefined;
    const paths = resolvePcrPaths(cwd, process.env.PCR_USER_DIR);
    res.json(await getToolStates(paths.cwd, paths.userDir));
  }));

  app.post("/v1/tools/:id", asyncRoute(async (req, res) => {
    const cwd = typeof req.body?.cwd === "string" ? req.body.cwd : undefined;
    const { config } = await readUserConfig(cwd);
    const toolId = String(req.params.id);
    const tool = listAvailableTools().find((candidate) => candidate.metadata.id === toolId || candidate.metadata.packageName === toolId);
    if (!tool) {
      res.status(404).json({ error: "Tool not found." });
      return;
    }

    const currentEnabled = new Set(config.tools?.enabled ?? []);
    if (req.body.enabled === true) {
      currentEnabled.add(tool.metadata.id);
    }
    if (req.body.enabled === false) {
      currentEnabled.delete(tool.metadata.id);
      currentEnabled.delete(tool.metadata.packageName);
    }

    const currentConfig = config.tools?.config ?? {};
    const nextConfig: PcrConfig = {
      ...config,
      tools: {
        ...config.tools,
        enabled: [...currentEnabled],
        config: {
          ...currentConfig,
          [tool.metadata.id]: typeof req.body.config === "object" && req.body.config ? req.body.config : currentConfig[tool.metadata.id] ?? {},
        },
      },
    };
    const configPath = await writeUserConfig(cwd, nextConfig);
    const paths = resolvePcrPaths(cwd, process.env.PCR_USER_DIR);
    res.json({ ok: true, configPath, tool: (await getToolStates(paths.cwd, paths.userDir)).find((candidate) => candidate.id === tool.metadata.id) });
  }));

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: error.message });
  });

  return app;
}

export async function startServer(options: StartServerOptions = {}): Promise<StartedServer> {
  const host = options.host ?? "127.0.0.1";
  if (!["127.0.0.1", "localhost"].includes(host)) {
    throw new Error("pcrd only binds to 127.0.0.1 by default.");
  }
  const port = options.port ?? 4317;
  const app = createApp();
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(port, host, () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;
  return {
    app,
    server,
    url: `http://${host}:${resolvedPort}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
