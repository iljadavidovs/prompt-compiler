# PCR Dashboard

The dashboard is a local EssenceKit static app served by `pcrd`.

Build and run:

```bash
pnpm build
pnpm --silent pcr daemon start
```

Use `pnpm --silent pcr serve` only when you want foreground logs for debugging.

Open:

```text
http://127.0.0.1:4317/dashboard/history/
```

The dashboard shows:

- historical compilations from local SQLite
- historical run detail popup with raw input, generated prompt, metadata, ContextPack, and PromptIR
- global `~/.pcr/config.yaml` settings
- installed tools and enabled state
- per-tool JSON configuration

Pages:

```text
http://127.0.0.1:4317/dashboard/history/
http://127.0.0.1:4317/dashboard/tools/
http://127.0.0.1:4317/dashboard/settings/
```

Tool settings are saved through local `pcrd` routes:

```text
GET  /v1/settings
POST /v1/settings
GET  /v1/tools
POST /v1/tools/:id
```

## Initial Tools

### Grammar

Default trigger:

```text
grammar fix
```

Grammar uses a rewrite adapter. When OpenAI intelligence is enabled, PCR fixes the prompt behind the scenes, removes the grammar trigger, and injects:

```text
Corrected User Prompt (Higher Priority)
```

Codex then answers that corrected prompt directly. In Codex hook mode, the original user prompt is still visible to Codex because hooks cannot replace or delete it, but PCR's hook output is added as higher-priority developer context.

Config:

```yaml
tools:
  config:
    grammar:
      keywords:
        - grammar fix
        - copyedit
```

### Planner

Planner can attach local reminders through `remindctl` and prompt-relevant docs from a configured folder. Reminder lookup is dynamic by default: PCR selects a horizon/date/search command from the prompt, then formats returned reminders with title, due date, list, priority, notes/description when present, and reminder id.

Config:

```yaml
tools:
  config:
    planner:
      reminders:
        enabled: true
        command: remindctl
        dynamic: true
        searchScope: upcoming
        limit: 12
        maxTokens: 900
        maxBuffer: 2000000
        args:
          - show
          - upcoming
          - --json
      docs:
        folder: /path/to/obsidian-vault
        limit: 3
```

Examples:

- `plan this week` uses `remindctl show week --json`.
- `plan reminders on 2026-06-08` uses `remindctl show 2026-06-08 --json`.
- `plan reminders about CanarySpace` uses `remindctl show upcoming --json` and filters locally.

### Coding

Coding can attach configured project docs when the request asks for docs, setup, architecture, API, config, or conventions.

Config:

```yaml
tools:
  config:
    coding:
      autoActivate: false
      autoAttachDocs: false
      docs:
        files:
          - README.md
          - AGENTS.md
          - docs/ARCHITECTURE.md
```

For project-specific automatic activation, add a project `.pcr/config.yaml` and enable/configure the coding tool there.
