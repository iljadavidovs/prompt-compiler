# Prompt Compiler (PCR) 0.1.0

PCR is a local-first prompt/context compiler. It selects an enabled tool, retrieves
local context with SQLite FTS5, builds a ContextPack and PromptIR, renders a prompt,
and records compilation history and feedback. If no enabled tool applies, it returns
a structured skip so the original request can proceed.

The standalone deterministic workflow requires no Codex installation, provider
account, API key, Apple Reminders, or hosted service.

**Early experimental release:** use synthetic or non-sensitive inputs in trusted
projects. Known defects remain, including dashboard HTML injection, incomplete
structured-history redaction, executable project configuration, and database-global
retrieval. Read [Known limitations](docs/KNOWN_LIMITATIONS.md) before using the
HTTP server, dashboard, personal context, or optional providers.

## Fresh installation

Use **Node.js 22** and **pnpm 9.15.4**. The verification image and `.node-version`
pin Node **22.23.4**. Linux verification uses Debian 12 with glibc; Alpine/musl and
Windows are not established by these checks.

```bash
git clone https://github.com/iljadavidovs/prompt-compiler.git
cd prompt-compiler
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Fresh installation needs access to the npm registry and GitHub's public download
endpoints. EssenceKit is pinned to a public HTTPS source archive; no GitHub login
or SSH key is required. `better-sqlite3` needs a matching native prebuild or Python 3,
`make`, and a C++ compiler to build locally. Debian's `build-essential` and `python3`
provide the native fallback prerequisites. Do not copy `node_modules` between
macOS and Linux or disable dependency install scripts: SQLite and esbuild need them.

## Standalone use

```bash
pnpm --silent pcr init
pnpm --silent pcr context index
pnpm --silent pcr context search "goals schedule progress" --json
pnpm --silent pcr compile "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress" --json --trace
pnpm --silent pcr history --json
# Use a compileId from the previous output:
pnpm --silent pcr feedback <compileId> --rating like --comment "Useful structure"
```

Initialization creates default context and configuration under `~/.pcr`; it enables
four built-in tools and leaves Reminders disabled. Existing default files are
preserved. Keep separate user directories and databases for unrelated projects
because retrieval is not project-isolated yet.

To verify the built software with disposable defaults and no provider credentials:

```bash
pnpm smoke
```

This script creates and removes its own temporary home, project, and SQLite database.
It exercises CLI compilation, indexing/FTS, history/feedback, all six MCP tools over
stdio, and HTTP/dashboard asset delivery. It does not need Codex.

## Reproduce Linux verification

With Docker running, verify a committed revision using:

```bash
./scripts/verify-linux.sh HEAD
```

The script exports only Git-tracked contents at that commit, checks the source archive
is below 50 MB, and builds without cached dependency-install layers in a pinned Node
22/Debian image. It runs the workspace build, typecheck, lint, all existing tests,
dashboard production build, and the separate website's clean install and builds.
It then runs the actual CLI/SQLite/MCP/HTTP smoke flow with Docker networking disabled.
No host home, credentials, `.git`, ignored files, dependencies, or Codex installation
are mounted into the container. See [verification details](docs/LINUX_VERIFICATION.md).

## HTTP, dashboard, and MCP

Start the foreground local server:

```bash
pnpm --silent pcr serve
```

The server binds to `http://127.0.0.1:4317`; health is at `/health`, and the dashboard
is at `/dashboard/`. Loopback binding is not an authentication boundary; consult the
known limitations before running the server or opening stored input in the dashboard.

For an MCP client, run the stdio server directly after building:

```bash
node /path/to/prompt-compiler/apps/pcr-mcp/dist/bin.js
```

Optional background daemon, gateway, and Codex setup are described in the linked
guides. Apple Reminders requires macOS tooling and authorization; it is optional.
Optional OpenAI classification and grammar rewriting require explicit configuration
and a provider key. No external provider is required for the verified workflow.

## Workspace and documentation

The pnpm workspace contains shared types, SQLite storage, retrieval, context loading,
the compiler, optional intelligence, four tool packages, the dashboard, CLI, HTTP
daemon, and MCP server. `web/` is a separate static marketing-site build.

- [CLI](docs/CLI.md)
- [HTTP API](docs/HTTP_API.md)
- [MCP](docs/MCP.md)
- [TypeScript API](docs/TYPESCRIPT_API.md)
- [Tools](docs/TOOLS.md)
- [Optional intelligence](docs/INTELLIGENCE.md)
- [Codex Desktop setup](docs/CODEX_DESKTOP_SETUP.md)
- [Codex PCR command](docs/CODEX_PCR_COMMAND.md)
- [Historical v0.1 summary](docs/summaries/SUMMARY_V0_1.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)

Historical implementation notes describe development-time observations; the dated
release verification record states which current checks were actually executed.
This is a source release, not a published npm package. Build from a clean checkout.

## License

PCR is licensed under [MIT](LICENSE), copyright 2026 Ilja Davidovs. Copied EssenceKit
code retains its original MIT copyright and permission notice in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
