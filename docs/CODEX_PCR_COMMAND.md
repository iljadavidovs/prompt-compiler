# Codex PCR Command

PCR can be exposed to Codex Desktop in two ways:

- deterministic `UserPromptSubmit` hook for always-on prompt compilation
- MCP server for explicit `$pcr` and manual `pcr_compile` calls

The hook is the right path when PCR must run before Codex processes every prompt.

## Deterministic Prompt Hook

Install:

```bash
pnpm --silent pcr codex hook on
```

Disable:

```bash
pnpm --silent pcr codex hook off
```

The hook is written to:

```text
~/.codex/hooks.json
```

It uses Codex's `UserPromptSubmit` event. Codex passes the pending user `prompt` to the hook on stdin. PCR compiles with `source: "codex"`.

Behavior:

- if PCR returns `skipped`, the hook emits nothing and Codex answers the original prompt normally
- if PCR matches an enabled tool, the hook emits `hookSpecificOutput.additionalContext`
- the injected context says PCR already ran and Codex should not call `pcr_compile` again for that turn
- Codex sees the PCR compiled prompt before answering the user

## Recommended Quiet Trigger

Use `$pcr` when you want Codex to return only the compiled prompt:

```text
$pcr according to my current goals and nearest schedule, compile a research prompt for assessment of my progress
```

Desired Codex behavior:

- detect `$pcr`
- call MCP tool `pcr_compile`
- pass the text after `$pcr` as `rawText`
- return only the compiled prompt
- avoid prefaces such as "I will use PCR" or "Calling pcr_compile"

Codex Desktop may still display tool activity in the UI. This instruction only suppresses assistant prose around the call.

## Instruction Snippet

Install it automatically:

```bash
pnpm --silent pcr codex install
```

Or add this manually to a Codex instruction file such as `~/.codex/AGENTS.md`:

```md
## PCR Prompt Compiler

When a user message starts with `$pcr`, call the MCP tool `pcr_compile`.

Use:
- `rawText`: the user message after removing the `$pcr` prefix
- `source`: MCP default
- `cwd`: current workspace when relevant

Return only the compiled prompt text unless the user explicitly asks for JSON, trace, metadata, or an explanation.

Do not announce that you are using PCR.
Do not describe the tool call.
Do not add a preface before the compiled prompt.
If PCR fails, briefly report the error and one concrete recovery step.
```

## Manual Test

After restarting Codex Desktop, send:

```text
$pcr according to my current goals and nearest schedule, compile a research prompt for assessment of my progress
```

Expected:

- Codex calls `pcr_compile`.
- The answer is the compiled prompt.
- There is no extra prose announcing PCR.

## Optional Auto Mode

You can also ask Codex to use PCR automatically by instruction:

```bash
pnpm --silent pcr codex auto on
```

Disable it:

```bash
pnpm --silent pcr codex auto off
```

Auto mode is implemented as a Codex instruction block in `~/.codex/AGENTS.md`. It is not deterministic. Prefer `pcr codex hook on` when PCR must run first.

If `pcr_compile` returns `skipped: true`, Codex should ignore PCR output and answer the original user request normally.
