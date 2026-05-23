# PCR v0.1 Summary

This is a snapshot for future agents and engineers onboarding into the Prompt Compiler project.

## Project Idea

PCR is a local-first prompt/context compiler. It turns rough user intent into a structured prompt by resolving local settings, profiles, templates, goals, schedule, preferences, project context, prompt history, and feedback.

PCR is not intended to be a generic prompt template manager. The core thesis is that prompt quality should be compiled from intent plus context plus preferences plus history, instead of manually repeated by the user on every interaction.

The system is deterministic by default. External LLM providers are optional and used only for narrow interpretation or rewriting tasks when configured.

## v0.1 Capability Snapshot

Current v0.1 capabilities include:

- TypeScript pnpm monorepo with core, store, context, retrieval, tool, CLI, daemon, MCP, and dashboard packages.
- `compilePrompt()` pipeline that validates input, resolves tools, classifies intent, builds context, renders a prompt, and stores history.
- Local user and project context from `~/.pcr/` and `.pcr/`.
- SQLite storage for compilations, feedback, context sources, documents, and chunks.
- SQLite FTS5 retrieval with deterministic ranking.
- Prompt history and feedback loop for positive and negative examples.
- Built-in tools for progress assessment, grammar rewrite, planning, and coding context.
- CLI commands for init, compile, context indexing/search, tools, history, feedback, daemon, gateway, and Codex setup.
- Local HTTP daemon on `127.0.0.1:4317`.
- Stdio MCP server exposing PCR tools.
- EssenceKit dashboard for history, tool config, and settings.
- Codex Desktop integration through MCP, `$pcr` quiet trigger, and a deterministic `UserPromptSubmit` hook.

## How Compilation Works

The compile flow is:

```text
raw input
-> config and tool resolution
-> classifier/router
-> selected tool
-> tool-specific context preparation
-> ContextPack
-> PromptIR
-> rendered generated prompt
-> local history
```

The generated prompt is what Codex hook mode attaches as additional context. The ContextPack and PromptIR are stored for inspection and debugging, and are returned by JSON, HTTP, and MCP surfaces when requested.

`PromptIR` is the intermediate representation. It records the resolved intent, mode, task, assumptions, constraints, context summary, context items, style, execution flags, and template/profile metadata.

## Current Tool Packages

The built-in tools are modular packages:

- `progress-assessment`: compiles research prompts for assessing progress against goals, schedule, risks, bottlenecks, and execution quality.
- `grammar`: activates on configurable grammar keywords such as `grammar fix`; when OpenAI intelligence is enabled, it rewrites the user prompt behind the scenes and injects the corrected prompt as higher-priority context.
- `planner`: compiles planning prompts using goals, schedule, optional Apple Reminders through `remindctl`, and optional local planning docs such as an Obsidian vault.
- `coding`: compiles coding prompts and can attach configured project documentation when setup, architecture, API, config, or convention context is relevant.

Tools expose classifier-facing metadata, supported modes/intents, trigger hints, context kinds, a profile, and a template. Enabled tools are configured in `~/.pcr/config.yaml` or project `.pcr/config.yaml`.

## Local Context And Storage

Default user directory:

```text
~/.pcr/
```

Default project directory:

```text
.pcr/
```

Important user files include:

```text
~/.pcr/config.yaml
~/.pcr/context/goals.md
~/.pcr/context/schedule.md
~/.pcr/context/preferences.md
~/.pcr/context/recurring-comments.md
~/.pcr/context/positive-patterns.md
~/.pcr/context/negative-patterns.md
~/.pcr/templates/
~/.pcr/profiles/
~/.pcr/pcr.sqlite
```

Resolution order is:

1. Explicit CLI/API/MCP args
2. Project `.pcr/`
3. User `~/.pcr/`
4. Built-in defaults

Context indexing stores source files, documents, and chunks in SQLite. Retrieval uses FTS5 and deterministic scoring. No embeddings or vector database are required in v0.1.

Every compilation is stored with raw text, generated prompt, PromptIR, ContextPack, metadata, and later feedback. Feedback supports `like`, `dislike`, `neutral`, comments, and outcome tags.

## Intelligence Layer

PCR remains deterministic by default. Without optional intelligence, PCR uses keyword and tool metadata matching.

When enabled, the OpenAI classifier is used only for structured interpretation:

- mode
- intent
- task rewrite
- context needs
- context queries
- adapter choice
- constraints and warnings

The final prompt is still rendered by PCR from PromptIR and templates.

The current OpenAI model default is `gpt-5.5` with `reasoning.effort=none` for lightweight classification. If OpenAI is unavailable or confidence is too low, PCR falls back to deterministic classification.

PCR also supports a compact classifier history window. It sends recent user requests plus minimal metadata, such as selected tool, mode, intent, and skipped state. It does not send generated prompts, Context Packs, PromptIR, or assistant responses in this history window.

Relevant config:

```yaml
intelligence:
  historyWindow:
    enabled: true
    turns: 10
    includeSkipped: true
    providerVisible: true
```

Set `providerVisible: false` to keep the classifier history window local.

## Codex Desktop Behavior

PCR can be used from Codex Desktop in three ways:

- MCP tools, including `pcr_compile`.
- `$pcr` quiet trigger, which asks Codex to call `pcr_compile` and return only the compiled prompt.
- Deterministic `UserPromptSubmit` hook, which runs before Codex processes a user prompt.

Hook mode cannot replace or delete the original user prompt. Instead, it adds the generated prompt as higher-priority additional context. If PCR returns `skipped: true`, the hook emits no context and Codex should answer the original prompt normally.

The hook path is intentionally sequential:

- If `pcrd` is unavailable, compile locally.
- If `pcrd` is available, wait for the daemon result.
- If the daemon request fails or times out after it was accepted, do not run local fallback, to avoid duplicate history writes.

## Dashboard And Daemon

`pcrd` is the local HTTP daemon. It binds to loopback by default:

```text
http://127.0.0.1:4317
```

The dashboard is an EssenceKit static app served by `pcrd`:

```text
http://127.0.0.1:4317/dashboard/
```

Dashboard pages:

- History: compilation rows and details popup with raw input, generated prompt, metadata, ContextPack, and PromptIR.
- Tools: installed tool state and per-tool config.
- Settings: global local config.

The optional `pcr.lan` gateway is intended to make the dashboard available directly at:

```text
http://pcr.lan
```

The gateway should remain a local port 80 proxy to `127.0.0.1:4317`; `pcrd` itself should stay on `4317` so existing hooks and Reminders access keep working.

## Runtime Surfaces

CLI:

```bash
pnpm --silent pcr compile "help me figure out where I stand this week"
pnpm --silent pcr context index
pnpm --silent pcr history
pnpm --silent pcr daemon start
```

HTTP daemon:

```text
GET  /health
POST /v1/compile
POST /v1/context/index
GET  /v1/context/search
GET  /v1/history
POST /v1/history/:id/feedback
GET  /v1/templates
GET  /v1/profiles
```

MCP tools:

```text
pcr_compile
pcr_context_search
pcr_add_feedback
pcr_list_templates
pcr_list_profiles
pcr_get_history
```

See `CLI.md`, `HTTP_API.md`, `MCP.md`, `DASHBOARD.md`, and `CODEX_DESKTOP_SETUP.md` for usage details.

## Security And Local-First Boundaries

v0.1 intentionally avoids hosted or account-based product surface area:

- No hosted service.
- No OAuth integrations.
- No auth, billing, marketplace, or team features.
- No Chrome extension work.
- No vector database requirement.
- No mandatory external LLM provider.

Security defaults:

- `pcrd` binds to loopback.
- CORS is restricted to local origins.
- Raw context is not logged by default.
- Obvious secrets are redacted before history storage.
- Apple Reminders access is delegated to the local macOS process that runs `remindctl`.

## Known Limits And Next Direction

Known v0.1 limits:

- `pcr.lan` gateway work exists but needs final verification on port 80 with sudo and the local hosts entry.
- Embeddings and vector search are not implemented.
- Local LLM provider support is a placeholder.
- Browser extension integration is future-only.
- Team, marketplace, billing, auth, and hosted sync are out of scope.
- The dashboard is functional but still early and intentionally local.
- The classifier improves vague input, but tool routing still depends on concise enabled-tool metadata and deterministic safeguards.

Recommended next direction:

- Finish and verify the `pcr.lan` gateway.
- Add stronger end-to-end hook tests around Codex prompt continuity.
- Improve dashboard setup UX for daemon, gateway, Reminders, and enabled tools.
- Expand planner and coding tool scenarios with focused manual tests.
- Add future provider interfaces for local models and optional embeddings without breaking the deterministic local-first default.
