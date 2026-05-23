# Sprint 12: Tool Modularity And Skip Classifier

## Goal

Restructure PCR around enabled tool packages instead of globally enabled modes/profiles/templates. The classifier should see minimal metadata for enabled tools and return `skip` when no tool applies.

## Product Behavior

- By default, no tool is active unless setup/config enables one.
- `pcr init` creates config with recommended default tools preselected.
- Tools are package-shaped modules with metadata, template, profile, and context needs.
- Classifier receives enabled tool metadata only.
- If no enabled tool applies, PCR returns a skipped result and Codex should answer the original request normally.
- `$pcr` still forces explicit compilation behavior where applicable.

## Initial Tool Package

Create:

```text
packages/pcr-tool-progress-assessment/
```

This package owns:

- progress-assessment metadata
- reflective research profile
- progress-assessment template
- default context needs

## Config Shape

```yaml
tools:
  enabled:
    - progress-assessment
```

If config is missing or `tools.enabled` is empty, no tools are enabled.

## Completion Criteria

- `pcr init` writes tool-based config.
- `compilePrompt()` selects an enabled tool or returns skipped.
- MCP `pcr_compile` exposes `skipped` metadata.
- Auto mode docs explain that skipped tool results should be ignored by Codex.
- Tests cover enabled tool compile and no-tool skip.
- `pnpm build`, `pnpm test`, and `pnpm lint` pass.

