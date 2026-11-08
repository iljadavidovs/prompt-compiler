# PCR Dashboard and Playground

The maintained authoring UI is a local EssenceKit static app served by `pcrd`.
Use `pnpm build && pnpm playground`, then open
`http://127.0.0.1:4319/dashboard/playground/`.

It provides library/draft editing, explicit selected-only context, compilation through
the canonical core, result/compare/source/inspection views, copy/export, immutable
history and feedback. History, Tools and Settings are coherent views in the same app;
legacy `/dashboard/history/`, `/dashboard/tools/` and `/dashboard/settings/` URLs
redirect there. Native editing preserves platform selection and undo behavior.

The dedicated launcher uses an isolated owner-local directory/database, disables
providers and commands, and requires an ephemeral same-origin local session for API
access. No gateway is required. The existing generic daemon's dashboard also hosts
the UI, but the dedicated launcher provides the strict fixed-workspace route policy.

See [the complete UI test tour](PLAYGROUND_QUICKSTART.md), [design/architecture](PLAYGROUND_ARCHITECTURE.md),
and [actual verification](PLAYGROUND_VERIFICATION.md). Historical experimental
limitations outside this mode remain in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).
