# Codex Desktop Setup

This guide connects PCR to Codex Desktop with the smallest useful setup.

Use the deterministic hook if you want PCR to run before every prompt. Keep the MCP server as a manual fallback for `$pcr` and direct tool calls.

## 1. Build PCR

From the PCR repo:

```bash
cd /path/to/prompt-compiler
pnpm install
pnpm build
pnpm --silent pcr init
```

This creates:

```text
~/.pcr/config.yaml
~/.pcr/context/
~/.pcr/templates/
~/.pcr/profiles/
~/.pcr/pcr.sqlite
```

## 2. Install PCR Into Codex Desktop

Run:

```bash
pnpm --silent pcr codex install
pnpm --silent pcr codex hook on
```

This updates:

```text
~/.codex/config.toml
~/.codex/AGENTS.md
~/.codex/hooks.json
```

It installs:

- the PCR MCP server
- the quiet `$pcr` trigger instruction
- a deterministic `UserPromptSubmit` hook that runs PCR before Codex processes each user prompt

Then restart Codex Desktop.

If Codex asks you to review hooks, open `/hooks` and trust the PCR hook.

## Manual Config Alternative

Open:

```text
~/.codex/config.toml
```

Add this block:

```toml
[mcp_servers.pcr]
command = "node"
args = ["/path/to/prompt-compiler/apps/pcr-mcp/dist/bin.js"]
```

## 3. Verify In Codex Desktop

After restart, send a normal prompt that should match the enabled progress-assessment tool:

```text
help me figure out where I stand this week
```

Expected result:

- The `UserPromptSubmit` hook runs before Codex answers.
- If PCR matches the prompt, Codex receives the compiled prompt as extra developer context.
- Codex answers the original request using current goals, near schedule, preferences, and history patterns.
- Codex should not announce PCR or call `pcr_compile` again for that turn.

To test the MCP fallback directly, ask:

```text
Use pcr_compile to compile this:
according to my current goals and nearest schedule, compile a research prompt for assessment of my progress
```

## 4. Quiet `$pcr` Command

PCR is an MCP tool, not a Codex skill. Codex can use it when asked, but automatic `$pcr` behavior comes from the instruction installed by:

```bash
pnpm --silent pcr codex install
```

The installed instruction is:

```md
When a user message starts with `$pcr`, call the MCP tool `pcr_compile`.
Return only the compiled prompt text.
Do not announce that you are using PCR.
```

Codex Desktop may still show the tool call in the UI; the instruction only suppresses assistant narration.

## 5. Optional Auto Mode

Instruction-based auto mode is now a fallback. Prefer the deterministic hook:

```bash
pnpm --silent pcr codex hook on
```

Turn the hook off:

```bash
pnpm --silent pcr codex hook off
```

The hook uses Codex's `UserPromptSubmit` event. It cannot replace the user prompt text directly, but it can add the PCR compiled prompt as developer context before the model processes the turn.

Hook execution is intentionally sequential:

- If the local daemon is unavailable, the hook compiles locally.
- If the local daemon is available, the hook waits for the daemon result.
- If the daemon request fails or times out after it was accepted, the hook reports a recoverable hook error and does not run a local fallback. This prevents one user prompt from being stored twice when the daemon keeps working after the hook client gives up.

The older auto mode asks Codex to run PCR by instruction:

Turn it on:

```bash
pnpm --silent pcr codex auto on
```

Turn it off:

```bash
pnpm --silent pcr codex auto off
```

Restart Codex Desktop after changing the setting.

Auto mode is instruction-based, not a hard runtime hook. Codex should follow it, but the MCP call may still be visible in the UI and simple/status messages are intentionally skipped.

If PCR returns `skipped: true`, Codex should ignore PCR output and answer the original user request normally.

## 6. Keep Setup Simple

For normal use, you only need these commands after pulling updates:

```bash
cd /path/to/prompt-compiler
pnpm install
pnpm build
```

Your PCR data remains in `~/.pcr`.

## 7. Optional Local HTTP Daemon

MCP is enough for the `$pcr` command. The local HTTP daemon is useful for the dashboard and for Codex prompt hooks that need macOS-owned integrations such as Reminders.

For Reminders, start the daemon from Terminal.app after granting Terminal Reminders access:

```bash
cd /path/to/prompt-compiler
pnpm --silent pcr daemon start
```

This runs `pcrd` in the background; no Terminal window needs to stay open.

If planner history shows `Local reminders unavailable` or `Reminders access denied`, the blocker is macOS Privacy, not PCR. Run:

```bash
/opt/homebrew/bin/remindctl authorize
```

Then open **System Settings -> Privacy & Security -> Reminders** and allow the app shown there, usually Terminal, Codex, or `remindctl`. After permission is granted, restart the background daemon from the same authorized Terminal session:

```bash
cd /path/to/prompt-compiler
pnpm --silent pcr daemon stop
pnpm --silent pcr daemon start
```

Do not restart it from Codex if Reminders is only granted to Terminal. The daemon cannot bypass macOS TCC permissions. Background mode avoids keeping a Terminal window open after authorization, but the first permission grant still requires the macOS UI.

Status and stop:

```bash
pnpm --silent pcr daemon status
pnpm --silent pcr daemon stop
```

Foreground mode is still available for debugging:

```bash
pnpm --silent pcr serve
```

It listens on:

```text
http://127.0.0.1:4317
```

Logs are written to:

```text
~/.pcr/pcrd.log
```

## Troubleshooting

If Codex cannot see the tools:

- Confirm `pnpm build` completed.
- Confirm `/path/to/prompt-compiler/apps/pcr-mcp/dist/bin.js` exists.
- Restart Codex Desktop after editing `~/.codex/config.toml`.
- Run `pnpm --silent pcr compile "test"` from the repo to confirm PCR itself works.
