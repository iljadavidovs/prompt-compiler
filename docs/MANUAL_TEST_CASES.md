# Manual Test Cases

Use these after `pnpm install`, `pnpm build`, and `pnpm --silent pcr init`.

## 1. Init Creates Local PCR Home

Command:

```bash
pnpm --silent pcr init
```

Expected:

- `~/.pcr/config.yaml` exists.
- `~/.pcr/context/goals.md` exists.
- `~/.pcr/context/schedule.md` exists.
- `~/.pcr/context/preferences.md` exists.
- `~/.pcr/pcr.sqlite` exists.

## 2. Context Indexing Works

Command:

```bash
pnpm --silent pcr context index
```

Expected:

- Output says files and chunks were indexed.
- No external account or LLM key is requested.

## 3. Context Search Finds Goals And Schedule

Command:

```bash
pnpm --silent pcr context search "goals schedule progress"
```

Expected:

- Results include `goals.md`.
- Results include `schedule.md`.
- Results mention PCR V0 and Friday/weekend schedule entries from default context.

## 4. Progress Assessment Compile Works

Command:

```bash
pnpm --silent pcr compile "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress"
```

Expected:

- Output is a structured markdown prompt.
- It includes current goals.
- It includes near schedule.
- It includes preferences.
- It asks for progress assessment, bottlenecks, risks, next actions, priority corrections, and review questions.

## 5. JSON Compile Includes Metadata

Command:

```bash
pnpm --silent pcr compile "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress" --json
```

Expected:

- JSON includes `prompt`.
- JSON includes `promptIr`.
- JSON includes `contextPack`.
- JSON includes `metadata.compileId`.
- `metadata.source` is `cli`.

## 6. Feedback Attaches To History

First get a compile id:

```bash
pnpm --silent pcr history
```

Then attach feedback:

```bash
pnpm --silent pcr feedback <compileId> --rating like --comment "good structure"
```

Expected:

- Output confirms feedback was recorded.
- A later similar compile can include positive history lessons.

## 7. Negative Feedback Affects Later Prompts

Command:

```bash
pnpm --silent pcr feedback <compileId> --rating dislike --outcome missed_context --comment "ignored schedule"
pnpm --silent pcr compile "compile a research prompt for progress assessment against goals and schedule"
```

Expected:

- Later output includes a negative pattern or history lesson about avoiding ignored schedule context.

## 8. HTTP Daemon Works

Start server:

```bash
pnpm --silent pcr serve
```

In another terminal:

```bash
curl -s http://127.0.0.1:4317/health
```

Expected:

```json
{"ok":true,"service":"pcrd","version":"0.1.0"}
```

## 9. HTTP Compile Works

Command:

```bash
curl -s http://127.0.0.1:4317/v1/compile \
  -H 'content-type: application/json' \
  -d '{"rawText":"according to my current goals and nearest schedule, compile a research prompt for assessment of my progress"}'
```

Expected:

- JSON includes `prompt`.
- Prompt includes goals/schedule context.

## 10. Codex Desktop MCP Works

After following `docs/CODEX_DESKTOP_SETUP.md`, restart Codex Desktop and ask:

```text
Use pcr_compile to compile this:
according to my current goals and nearest schedule, compile a research prompt for assessment of my progress
```

Expected:

- Codex calls `pcr_compile`.
- Tool output includes a compiled prompt and metadata.

## 11. Quiet `$pcr` Trigger Works

After running:

```bash
pnpm --silent pcr codex install
```

Restart Codex Desktop and send:

```text
$pcr according to my current goals and nearest schedule, compile a research prompt for assessment of my progress
```

Expected:

- Codex calls `pcr_compile`.
- The answer contains only the compiled prompt text.
- There is no assistant preface announcing PCR.

## 12. Auto Mode Toggle Works

Prefer the deterministic hook for real always-on behavior:

```bash
pnpm --silent pcr codex hook on
```

Expected:

- `~/.codex/hooks.json` contains `UserPromptSubmit`.
- The hook command contains `codex prompt-hook`.
- After restart, Codex may ask you to review/trust the hook with `/hooks`.

Turn off:

```bash
pnpm --silent pcr codex hook off
```

Expected:

- The PCR `codex prompt-hook` handler is removed.
- Other hooks in `~/.codex/hooks.json` are preserved.

## 13. Hook Handler Skips Irrelevant Prompt

```bash
printf '{"hook_event_name":"UserPromptSubmit","cwd":"%s","prompt":"what is 2 + 2?"}' "$PWD" \
  | pnpm --silent pcr codex prompt-hook
```

Expected:

- No stdout when no enabled PCR tool applies.
- Codex would continue with the original prompt.

## 14. Hook Handler Injects Compiled Prompt

```bash
printf '{"hook_event_name":"UserPromptSubmit","cwd":"%s","prompt":"help me figure out where I stand this week"}' "$PWD" \
  | pnpm --silent pcr codex prompt-hook
```

Expected:

- Output is valid JSON.
- JSON contains `hookSpecificOutput.hookEventName: "UserPromptSubmit"`.
- `additionalContext` contains `PCR Prompt Compiler already ran`.
- `additionalContext` contains the compiled progress-assessment prompt.

## 15. Instruction-Based Auto Mode Toggle Works

Turn on:

```bash
pnpm --silent pcr codex auto on
```

Expected:

- `~/.codex/AGENTS.md` contains `PCR auto mode is enabled.`
- After restart, substantive prompts should trigger `pcr_compile`.

Turn off:

```bash
pnpm --silent pcr codex auto off
```

Expected:

- `~/.codex/AGENTS.md` no longer contains the auto mode block.
- `$pcr` quiet trigger remains installed.

## 16. Skip Works With No Enabled Tools

Use a temporary PCR home:

```bash
TMP_DIR=$(mktemp -d)
PCR_USER_DIR="$TMP_DIR/user-pcr" PCR_DB_PATH="$TMP_DIR/pcr.sqlite" mkdir -p "$TMP_DIR/user-pcr"
printf "tools:\n  enabled: []\n" > "$TMP_DIR/user-pcr/config.yaml"
PCR_USER_DIR="$TMP_DIR/user-pcr" PCR_DB_PATH="$TMP_DIR/pcr.sqlite" \
  pnpm --silent pcr compile "what is 2 + 2?" --json
```

Expected:

- `metadata.skipped` is `true`.
- `prompt` is empty.
- `metadata.skipReason` explains that no tools are enabled.
