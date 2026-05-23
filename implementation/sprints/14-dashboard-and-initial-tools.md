# Sprint 14: Dashboard And Initial Tool Packages

## Goal

Add a local dashboard package and expand PCR from one progress-assessment tool into a small modular tool set.

## Scope

- Add an EssenceKit-based `@pcr/dashboard` package.
- Dashboard must show:
  - historical compilation runs
  - global PCR settings
  - installed tool states
  - per-tool JSON configuration
- Add initial tool packages:
  - `@pcr/tool-grammar`
  - `@pcr/tool-planner`
  - `@pcr/tool-coding`
- Keep `@pcr/tool-progress-assessment` as an existing tool.
- Add HTTP routes needed by the dashboard for settings and tool configuration.
- Add tool runtime context hooks so tools can attach extra context before prompt rendering.

## Tool Requirements

### Grammar

- Activates on configurable keywords, defaulting to `grammar fix`.
- Produces a focused grammar-edit prompt.
- Does not load external context by default.

### Planner

- Activates on planning intent.
- Can read local Apple Reminders through `remindctl` when configured.
- Can search a configured local folder such as an Obsidian vault.
- For large matching docs, attach deterministic prompt-relevant snippets instead of the full file.

### Coding

- Activates for coding requests and can auto-activate from project config.
- For MVP, loads configured project docs when the request suggests documentation would help.
- Suggested MVP tests:
  - coding tool skips non-coding prompts
  - coding tool activates for implementation/debug/test/refactor prompts
  - coding tool attaches configured docs when docs are requested
  - project `.pcr/config.yaml` can enable coding auto activation
  - coding context remains within token budget

## EssenceKit Notes

EssenceKit currently expects both `src/App` and `src/Core` under the project root. The dashboard package will keep a local `src/Core` copy, matching the existing `web/` package workaround.

## Acceptance

- `pnpm build` builds the dashboard and all tools.
- `pnpm test` covers grammar, planner, coding, dashboard-related API/config behavior, and existing PCR flows.
- `pnpm lint` passes.
- `pcr init` creates default config for the new tools.
- `pcr serve` exposes dashboard-supporting API routes.
- Dashboard build output exists under `packages/dashboard/Pub/dev`.
