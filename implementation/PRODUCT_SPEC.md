# PCR V0 Product Spec

## Product Shape

PCR is a local compiler for prompts. It accepts rough intent and produces a structured final prompt enriched by local context and prior feedback.

## Users

The V0 user is a local developer or operator who works with tools such as Codex, Claude Code, local terminals, and MCP clients. They want consistent prompt quality without restating the same goals, style preferences, constraints, and recurring corrections.

## Inputs

The core API accepts:

- source
- rawText
- optional mode
- optional templateId
- optional profileId
- cwd
- contextHints
- explicit contextBlocks
- vars
- compile options

## Outputs

The compiler returns:

- final prompt
- PromptIR
- ContextPack
- metadata
- optional compiler trace

## Default Local Files

User directory:

```text
~/.pcr/
```

Project directory:

```text
.pcr/
```

User files:

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

Project files:

```text
.pcr/config.yaml
.pcr/context/
.pcr/templates/
.pcr/profiles/
```

## Resolution Order

1. Explicit CLI/API/MCP args.
2. Project `.pcr/`.
3. User `~/.pcr/`.
4. Built-in defaults.

## Commands

CLI commands:

```text
pcr init
pcr compile "<text>"
pcr compile --stdin
pcr compile "<text>" --mode research --profile reflective-research
pcr context index
pcr context search "<query>"
pcr history
pcr feedback <compileId> --rating like --comment "good structure"
pcr feedback <compileId> --rating dislike --outcome missed_context --comment "ignored schedule"
pcr serve
```

HTTP daemon:

```text
GET  /health
POST /v1/compile
POST /v1/context/index
GET  /v1/context/search?q=
GET  /v1/history
GET  /v1/history/:id
POST /v1/history/:id/feedback
GET  /v1/templates
GET  /v1/profiles
```

MCP tools:

- `pcr_compile`
- `pcr_context_search`
- `pcr_add_feedback`
- `pcr_list_templates`
- `pcr_list_profiles`
- `pcr_get_history`

## Security

- Bind HTTP daemon to `127.0.0.1`.
- Do not remote bind by default.
- Redact obvious secrets from stored history.
- Do not log raw context unless debug mode is enabled.
- Add restrictive CORS suitable for a future browser extension.

