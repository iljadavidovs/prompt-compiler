# PCR Tools

PCR tools are plug-and-play packages. A tool owns a narrow prompt-compilation capability:

- metadata
- supported modes/intents
- trigger hints
- context needs
- profile
- template

The classifier only sees minimal metadata for enabled tools. If a request does not match an enabled tool, PCR skips.

## Current Tool Packages

```text
packages/pcr-tool-progress-assessment/
```

Tool id:

```text
progress-assessment
```

Purpose:

```text
Compile research prompts for assessing progress against goals, schedule, risks, and execution quality.
```

## Config

User config:

```text
~/.pcr/config.yaml
```

Example:

```yaml
tools:
  enabled:
    - progress-assessment
```

If the config is missing or `tools.enabled` is empty, PCR has no active tools and will skip compilation.

## Setup Defaults

`pcr init` creates a config with recommended default tools preselected:

```bash
pnpm --silent pcr init
```

For now, the default preselected tool is:

```text
progress-assessment
```

## Commands

List tools:

```bash
pnpm --silent pcr tools list
```

Enable a tool:

```bash
pnpm --silent pcr tools enable progress-assessment
```

Disable a tool:

```bash
pnpm --silent pcr tools disable progress-assessment
```

## Skip Behavior

When no enabled tool applies, `pcr_compile` returns:

```json
{
  "skipped": true,
  "skipReason": "PCR skipped because no enabled tool matched the request."
}
```

In Codex auto mode, skipped output should be ignored and Codex should answer the original user request normally.

## Built-In Tool Packages

- `progress-assessment`: assessment prompts using goals, schedule, preferences, and history.
- `grammar`: activates on configurable grammar keywords, default `grammar fix`; rewrites the prompt through OpenAI when enabled, then asks Codex to answer the corrected prompt directly.
- `planner`: attaches optional `remindctl` reminders and prompt-relevant local folder docs; selects reminder commands from the request horizon, date, or reminder/list/topic search.
- `coding`: attaches configured project docs for coding requests when documentation context is relevant.

Tool configuration lives in `~/.pcr/config.yaml` or project `.pcr/config.yaml`:

```yaml
tools:
  enabled:
    - progress-assessment
    - grammar
    - planner
    - coding
  config:
    grammar:
      keywords:
        - grammar fix
    planner:
      reminders:
        enabled: false
        command: remindctl
        dynamic: true
        searchScope: upcoming
        limit: 12
        maxTokens: 900
        maxBuffer: 2000000
        args: [show, upcoming, --json]
      docs:
        folder: ""
        limit: 3
    coding:
      autoActivate: false
      autoAttachDocs: false
      docs:
        files:
          - README.md
          - AGENTS.md
```

Planner reminder command selection is deterministic:

- `plan this week` -> `remindctl show week --json`
- `plan today` -> `remindctl show today --json`
- `plan reminders on 2026-06-08` -> `remindctl show 2026-06-08 --json`
- `plan reminders about CanarySpace` -> `remindctl show upcoming --json`, then local filtering by title, list, notes/description, and id

Reminder context is formatted as compact planning bullets with title, due date, list, priority, notes/description when present, and reminder id.

## Adding A Tool

Create a package:

```text
packages/pcr-tool-my-tool/
```

Export a `PcrTool`:

```ts
export const pcrTool = {
  metadata: {
    id: "my-tool",
    packageName: "@pcr/tool-my-tool",
    name: "My Tool",
    description: "Short classifier-facing description.",
    modes: ["analysis"],
    intents: ["my-intent"],
    triggers: ["short", "trigger", "phrases"],
    contextKinds: ["preference", "history"],
    defaultEnabled: false
  },
  profile: { "...": "..." },
  template: { "...": "..." }
};
```

Then register it in `packages/pcr-core/src/tools.ts`.
