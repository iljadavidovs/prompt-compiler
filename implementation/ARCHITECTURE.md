# PCR V0 Architecture

## Monorepo Layout

```text
packages/
  pcr-core/
  pcr-store/
  pcr-context/
  pcr-retrieval/
  pcr-shared/

apps/
  pcr-cli/
  pcrd/
  pcr-mcp/

examples/
  context/
  templates/
  profiles/

docs/
```

## Package Responsibilities

### pcr-shared

- shared TypeScript types
- zod schemas
- constants
- deterministic helpers
- token estimation and redaction utilities

### pcr-core

- `compilePrompt()`
- input validation
- config/profile/template resolution orchestration
- intent and mode resolver
- PromptIR builder
- prompt renderer
- compiler trace
- history persistence integration

### pcr-store

- SQLite access
- migrations
- history persistence
- feedback persistence
- source/document/chunk persistence

### pcr-context

- context source loader
- local filesystem importer
- project/user config resolver
- context document parser
- ContextPack builder

### pcr-retrieval

- SQLite FTS5 search
- deterministic ranking
- history matching
- positive/negative example retrieval

### pcr-cli

- command-line interface
- init workflow
- compile/context/history/feedback/serve commands

### pcrd

- local HTTP daemon at `127.0.0.1:4317`
- REST API over PCR core/store/context/retrieval

### pcr-mcp

- stdio MCP server exposing PCR tools

## Compiler Pipeline

1. Validate input.
2. Resolve cwd.
3. Load configuration.
4. Resolve profile.
5. Resolve mode.
6. Resolve template.
7. Build context query from raw text, mode, profile, and context hints.
8. Retrieve context from explicit blocks, local files, indexed chunks, history, and feedback.
9. Build ContextPack within token budget.
10. Build PromptIR.
11. Render final prompt from template.
12. Estimate token usage.
13. Persist compilation and context metadata.
14. Return output.

## Storage

SQLite database defaults to `~/.pcr/pcr.sqlite`.

Tables:

- `schema_migrations`
- `context_sources`
- `context_documents`
- `context_chunks`
- `context_chunks_fts`
- `compilations`
- `feedback`

## Retrieval

V0 uses SQLite FTS5 and deterministic scoring. Ranking factors:

- query keyword match
- mode match
- context kind match
- context hints
- recency
- positive feedback
- negative feedback

Interfaces are kept separate from storage so embeddings and vector search can be added later without changing the compiler API.

## Drift Control

If implementation discovers a necessary architecture or goal change, update this document or `GOAL.md` before continuing to the next sprint.

