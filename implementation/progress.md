# PCR V0 Progress

## Sprint 00: Bootstrap

Completed monorepo scaffolding with pnpm workspace, TypeScript project references, ESLint, Vitest, package/app directories, baseline package manifests, and placeholder entry points. Verified `pnpm install`, `pnpm build`, and `pnpm test` on the bootstrap scaffold.

## Sprint 01: Core Compiler

Implemented shared types/schemas, built-in reflective research profile, built-in progress-assessment Markdown template, YAML profile parsing, frontmatter template parsing, deterministic mode/intent resolution, ContextPack construction from explicit blocks, PromptIR building, rendering, token estimation, warnings, and optional compiler trace. Verified `pnpm install`, `pnpm build`, and `pnpm test`.

## Sprint 02: Local Context Store

Implemented SQLite store with migrations, context source/document/chunk tables, FTS5 table, compilation history persistence, feedback persistence, and secret redaction before storage. Wired `compilePrompt()` to persist every compilation by default, with `PCR_DB_PATH` available for tests/local overrides and `PCR_DISABLE_HISTORY=1` available for explicit non-persistence. Verified `pnpm build` and `pnpm test`.

## Sprint 03: Retrieval And Context Pack

Implemented filesystem context indexing for user/project `.pcr/context` files, deterministic SQLite FTS5 search, query keyword extraction, ranking boosts for kind/mode/hints, feedback example retrieval, and ContextPack construction under token budget. Updated `compilePrompt()` to build context from explicit blocks, indexed local context, and feedback examples. Verified `pnpm build` and `pnpm test`.

## Sprint 04: CLI

Implemented `pcr` CLI commands for `init`, `compile`, `compile --stdin`, `context index`, `context search`, `history`, `feedback`, and `serve` handoff. Added default user files/templates/profiles for `pcr init`, JSON output support, cwd support, max context token budget, and trace flag. Fixed FTS query sanitization after CLI compile surfaced hyphenated profile-id parsing in SQLite FTS. Verified `pnpm build` and `pnpm test`.

## Sprint 05: HTTP Daemon

Implemented `pcrd` Express daemon with `GET /health`, compile, context index/search, history get/list, feedback, template list, and profile list routes. Startup binds to loopback only, uses restrictive localhost CORS, avoids raw-context logging, and is wired to the same core/context/store path as the CLI. Verified `pnpm build` and `pnpm test`.

## Sprint 06: MCP Server

Implemented `pcr-mcp` stdio server with tools for `pcr_compile`, `pcr_context_search`, `pcr_add_feedback`, `pcr_list_templates`, `pcr_list_profiles`, and `pcr_get_history`. Tool handlers are exported separately for tests and reuse core/context/store behavior. Verified `pnpm build` and `pnpm test`, including direct `pcr_compile` tool coverage.

## Sprint 07: History Feedback Loop

Verified feedback-aware retrieval end to end: liked compilations become positive examples, disliked compilations and outcome comments become negative examples, examples enter the ContextPack, and PromptIR/rendering injects them into future prompts. Added regression coverage proving later compilations include prior positive and negative feedback lessons. Verified `pnpm build` and `pnpm test`.

## Sprint 08: Docs And Examples

Added root README, example context/template/profile files, and documentation for CLI usage, TypeScript API, HTTP API, MCP usage, and future extension points for providers, embeddings/vector search, and browser extension integration. Verified `pnpm build` and `pnpm test`.

## Sprint 09: Final Validation

Ran final validation: `pnpm install`, `pnpm build`, `pnpm test`, and `pnpm lint` all pass. Exercised CLI init/index/search/compile/feedback/history with a temporary PCR home/database, verified `pcr init` creates SQLite, verified HTTP health and compile route, and verified MCP `pcr_compile` handler. Added `implementation/FINAL_REPORT.md`.

## Post-V0 Setup: Codex Desktop

Added Sprint 10 suggestions in `implementation/sprints/10-mvp-hardening.md`, Codex Desktop setup guide in `docs/CODEX_DESKTOP_SETUP.md`, and manual verification cases in `docs/MANUAL_TEST_CASES.md`. Added `[mcp_servers.pcr]` to `~/.codex/config.toml` with a timestamped backup created before editing. Verified actual MCP stdio client connection can list `pcr_compile` and call it successfully.

## Post-V0 Follow-Up: Auto Mode And Test Context

Added `pcr codex auto on/off` to toggle instruction-based automatic PCR use in Codex Desktop, plus docs for the behavior and limits. Added realistic testing data to `~/.pcr/context/`, indexed it, and verified the progress-assessment compile now includes goals, schedule, preferences, recurring comments, positive patterns, and negative patterns.

## Sprint 11: Optional Intelligence Classifier

Added `packages/pcr-intelligence` with deterministic classifier fallback, structured classification schema, and optional OpenAI Responses API provider. Wired classifier output into `compilePrompt()` for mode, intent, task rewrite, context queries, context needs, adapter, confidence, and warnings. Added CLI and MCP switches for intelligence, docs in `docs/INTELLIGENCE.md`, and tests covering vague progress language plus OpenAI-disabled fallback. Verified `pnpm install`, `pnpm build`, `pnpm test`, `pnpm lint`, and a manual `--intelligence --intelligence-provider openai` fallback compile.

## Sprint 11 Follow-Up: Live OpenAI Test

Configured optional OpenAI credentials through an ignored local environment file. Added automatic `.env.local` loading for PCR intelligence, test isolation via `PCR_SKIP_ENV_FILE`, intent canonicalization for LLM variants such as `progress assessment`, and context-need query expansion. Verified live OpenAI classification with `--intelligence --intelligence-provider openai`; it returned canonical `progress-assessment`, no warnings, and retrieved local goals, schedule, preferences, and history patterns.

## Sprint 12: Tool Modularity And Skip Classifier

Added root `AGENTS.md` with PCR engineering philosophy, `implementation/sprints/12-tool-modularity-and-skip.md`, and the first modular tool package `packages/pcr-tool-progress-assessment`. Added tool config resolution from `~/.pcr/config.yaml`, `pcr tools list/enable/disable`, tool-aware classifier metadata, skip behavior when no enabled tool applies, top-level MCP `skipped`/`skipReason`, and Codex auto-mode instructions to ignore skipped PCR output. Ran `pcr init`, enabled the progress-assessment tool in real `~/.pcr`, indexed context, and turned Codex auto mode on. Verified live skip for `what is 2 + 2?` and live progress-assessment selection for `help me figure out where I stand this week`. `pnpm build`, `pnpm test`, and `pnpm lint` pass.

## Sprint 13: Codex UserPromptSubmit Hook

Added `implementation/sprints/13-codex-user-prompt-hook.md` and implemented deterministic Codex `UserPromptSubmit` integration. Added hidden hook handler `pcr codex prompt-hook`, public toggle `pcr codex hook on/off`, JSON-preserving `~/.codex/hooks.json` installer/remover, and hook output that injects compiled PCR context before Codex processes the turn. Tightened tool selection with a raw-request activation gate so enabled tools do not attach to irrelevant prompts even if an LLM classifier misfires. Updated Codex setup/manual test docs, enabled the hook in real `~/.codex/hooks.json`, disabled the older instruction-based auto mode to avoid duplicate MCP calls, and verified live hook skip for `what is 2 + 2?` plus live compiled-context injection for `help me figure out where I stand this week`. `pnpm build`, `pnpm test`, and `pnpm lint` pass.

## Sprint 14: Dashboard And Initial Tool Packages

Added `implementation/sprints/14-dashboard-and-initial-tools.md`, an EssenceKit-based `@pcr/dashboard` package, and three new tool packages: `@pcr/tool-grammar`, `@pcr/tool-planner`, and `@pcr/tool-coding`. Added tool runtime context hooks so planner can attach `remindctl` reminders and prompt-relevant local docs, and coding can attach configured project docs. Added dashboard API routes to `pcrd` for settings and tool configuration, served the dashboard at `/dashboard/`, updated docs, and enabled grammar/planner/coding in the live `~/.pcr/config.yaml`. Verified live grammar, planner, and coding compiles; verified dashboard HTML/JS/CSS and `/v1/settings`; verified the dashboard in the in-app browser with 4 tools, history rows, and daemon status online. `pnpm build`, `pnpm test`, and `pnpm lint` pass.

## Sprint 15: Dashboard Pages And Run Details

Added `implementation/sprints/15-dashboard-pages-and-run-details.md` and split the dashboard into `/dashboard/history/`, `/dashboard/tools/`, and `/dashboard/settings/`. History now has a run detail popup that loads `GET /v1/history/:id` and displays generated prompt, raw input, metadata, ContextPack, and PromptIR. Added tool input policy support and configured grammar to avoid duplicating raw user text in the compiled prompt; Codex hook context now explicitly says the original prompt is the source text for grammar edits. Verified dashboard routes and detail popup in the in-app browser, verified grammar no longer repeats raw text in CLI or hook output, and re-ran `pnpm build`, `pnpm test`, and `pnpm lint`.

## Sprint 16: Grammar Rewrite Adapter

Added `implementation/sprints/16-grammar-rewrite-adapter.md` and changed grammar from an answer-producing edit prompt into a rewrite adapter. Added OpenAI-backed `rewriteGrammarPrompt()` in `@pcr/intelligence`, with deterministic fallback when OpenAI is disabled or unavailable. Grammar now removes the trigger, fixes the source prompt, and injects `Corrected User Prompt (Higher Priority)` with instructions to answer that corrected prompt directly. Verified live OpenAI rewrite for the reported example and verified hook output contains the corrected prompt without the `grammar fix` wrapper. `pnpm build`, `pnpm test`, and `pnpm lint` pass.
