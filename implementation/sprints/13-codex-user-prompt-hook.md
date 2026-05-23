# Sprint 13: Deterministic Codex UserPromptSubmit Hook

## Goal

Replace instruction-only Codex auto mode with an optional deterministic Codex hook that runs PCR before every submitted user prompt.

## Source

OpenAI Codex hooks support the `UserPromptSubmit` event. The hook receives the pending user `prompt`, runs at turn scope, and can add `additionalContext` before the model processes the turn.

## Scope

- Add a PCR hook handler command for Codex `UserPromptSubmit`.
- Add CLI commands to install and remove the hook from `~/.codex/hooks.json`.
- Make the hook call `compilePrompt()` with `source: "codex"`.
- If PCR returns `skipped`, emit no context and let the original prompt continue.
- If PCR compiles, emit hook JSON with `hookSpecificOutput.additionalContext`.
- Tell Codex in the injected context that PCR already ran and should not be called again for that turn.
- Preserve the older `$pcr` MCP instruction path as a manual fallback.
- Document the hook behavior, limits, and manual test cases.

## Non-goals

- Do not build a separate prompt gateway UI.
- Do not replace Codex's user prompt text directly.
- Do not require a hosted service.
- Do not require MCP for auto mode.

## Acceptance

- `pcr codex hook on` installs a `UserPromptSubmit` hook.
- `pcr codex hook off` removes only the PCR hook and preserves other hooks.
- The hook can be executed locally with sample Codex hook JSON.
- Skipped PCR output produces no hook stdout.
- Matched PCR output produces valid Codex hook JSON with compiled prompt context.
- `pnpm build`, `pnpm test`, and `pnpm lint` pass.
