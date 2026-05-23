# Prompt Compiler V0 (PCR)

PCR is a local-first prompt/context compiler. It turns rough intent into a structured prompt by resolving local goals, schedule, preferences, profiles, templates, history, and feedback.

PCR V0 is deterministic by default and does not require OpenAI, Anthropic, embeddings, vector databases, OAuth, cloud accounts, or a hosted service.

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
pnpm --silent pcr init
pnpm --silent pcr codex install
pnpm --silent pcr codex hook on    # optional: run PCR before each Codex prompt
pnpm --silent pcr context index
pnpm --silent pcr compile "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress"
```

## Daemon And Dashboard

Start the local HTTP daemon in the background:

```bash
pnpm --silent pcr daemon start
```

Check or stop it:

```bash
pnpm --silent pcr daemon status
pnpm --silent pcr daemon stop
```

Foreground debugging is still available:

```bash
pnpm --silent pcr serve
```

The daemon binds to loopback only:

```text
http://127.0.0.1:4317
```

Dashboard:

```text
http://127.0.0.1:4317/dashboard/
```

Optional local hostname without typing the port or `/dashboard`:

```bash
grep -qE '(^|[[:space:]])pcr\.lan([[:space:]]|$)' /etc/hosts || echo '127.0.0.1 pcr.lan' | sudo tee -a /etc/hosts
sudo env PCR_USER_DIR="$HOME/.pcr" "$(which node)" /Users/idavidovs/Projects/prompt-compiler/apps/pcr-cli/dist/bin.js gateway start
```

Then open:

```text
http://pcr.lan
```

Gateway status and stop:

```bash
sudo env PCR_USER_DIR="$HOME/.pcr" "$(which node)" /Users/idavidovs/Projects/prompt-compiler/apps/pcr-cli/dist/bin.js gateway status
sudo env PCR_USER_DIR="$HOME/.pcr" "$(which node)" /Users/idavidovs/Projects/prompt-compiler/apps/pcr-cli/dist/bin.js gateway stop
```

Useful health checks:

```bash
curl http://127.0.0.1:4317/health
curl http://127.0.0.1:4317/dashboard/history/
curl http://pcr.lan/health
```

On macOS, start the daemon from an authorized Terminal session if planner reminders need Apple Reminders access:

```bash
remindctl authorize
cd /Users/idavidovs/Projects/prompt-compiler
pnpm --silent pcr daemon stop
pnpm --silent pcr daemon start
```

## Workspace

```text
packages/pcr-shared     shared types, schemas, constants, helpers
packages/pcr-store      SQLite migrations, history, feedback, context chunks
packages/pcr-retrieval  FTS5 retrieval and history matching
packages/pcr-context    filesystem context indexing and ContextPack building
packages/pcr-core       compilePrompt pipeline, PromptIR, templates, profiles
apps/pcr-cli            pcr command
apps/pcrd               local HTTP daemon
apps/pcr-mcp            stdio MCP server
```

## Documentation

- [PCR v0.1 Summary](docs/SUMMARY_V0_1.md)
- [CLI](docs/CLI.md)
- [TypeScript API](docs/TYPESCRIPT_API.md)
- [HTTP API](docs/HTTP_API.md)
- [MCP Usage](docs/MCP.md)
- [Intelligence Layer](docs/INTELLIGENCE.md)
- [Tools](docs/TOOLS.md)
- [Codex Desktop Setup](docs/CODEX_DESKTOP_SETUP.md)
- [Codex PCR Command](docs/CODEX_PCR_COMMAND.md)
- [Manual Test Cases](docs/MANUAL_TEST_CASES.md)
- [Future Extensions](docs/FUTURE_EXTENSIONS.md)
