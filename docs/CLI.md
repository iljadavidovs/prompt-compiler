# CLI

Build first:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Run through pnpm:

```bash
pnpm --silent pcr init
pnpm --silent pcr context index
pnpm --silent pcr context search "goals schedule progress"
pnpm --silent pcr compile "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress"
```

Useful flags:

```bash
pnpm --silent pcr compile --stdin
pnpm --silent pcr compile "..." --mode research --profile reflective-research
pnpm --silent pcr compile "..." --json
pnpm --silent pcr compile "..." --trace
pnpm --silent pcr compile "..." --cwd /path/to/project
pnpm --silent pcr compile "..." --max-context-tokens 1200
pnpm --silent pcr compile "help me figure out where I stand this week" --intelligence --intelligence-provider openai
pnpm --silent pcr tools list
pnpm --silent pcr tools enable progress-assessment
pnpm --silent pcr tools disable progress-assessment
```

Feedback:

```bash
pnpm --silent pcr history
pnpm --silent pcr feedback <compileId> --rating like --comment "good structure"
pnpm --silent pcr feedback <compileId> --rating dislike --outcome missed_context --comment "ignored schedule"
```

Daemon:

```bash
pnpm --silent pcr serve
pnpm --silent pcr daemon start
pnpm --silent pcr daemon status
pnpm --silent pcr daemon stop
```

Use `pcr serve` for foreground debugging. Use `pcr daemon start` for the normal background daemon. On macOS, run `pcr daemon start` from Terminal.app if planner reminders need Apple Reminders access.

Environment overrides useful for tests:

```bash
PCR_USER_DIR=/tmp/pcr-user PCR_DB_PATH=/tmp/pcr.sqlite pnpm --silent pcr init
```
