# Playground recovery and independent verification

Reviewed 2026-11-08 for [PCR #9](https://github.com/iljadavidovs/prompt-compiler/issues/9). This records a new verification pass over the existing implementation, rather than a replacement implementation. Owner acceptance remains pending; #9 stays open.

## Recovered scope

The dedicated `codex/issue-9-local-playground` worktree contained implementation commit `0cdffebd232ec424436c60104f5258049bd6fbad` and verification/icon commit `ce9725ccb5c63a2c57ebbf4d852fffc38c5ec0d1`. Both descend from current remote-main baseline `cebe6524ac07fa2e9568ab44cff4f7fc14b7e56b`. The original main checkout's earlier CLI/Codex, documentation, generated-index and untracked changes were outside this branch and remain untouched. Another release worktree was also left untouched. No stash held additional issue work.

The existing architecture and [two-direction design decision](PLAYGROUND_ARCHITECTURE.md) were retained. Source inspection covered the complete task diff: launcher, local-access middleware, workspace routes/store, shared contracts, canonical compiler, history persistence, provider denial, browser modules, tokens and focused tests. The reviewed commits excluded the owner library and its private seed script.

## Corrections found in this pass

1. Shared input validation trimmed raw requests before compilation/history. A failing regression demonstrated loss of leading/trailing whitespace in matched and skipped requests. Validation now rejects blank input without changing nonblank input. Actual browser JSON/Markdown exports and history inspection preserve a 318-character whitespace-bearing request exactly. History headings trim only their display label.
2. A browser/extension top-level navigation carrying cross-site fetch metadata received 403 before opening the app. Only top-level GET document navigation to static dashboard routes is now permitted. Host validation remains mandatory; cross-origin API/session requests and framed dashboard navigation still fail. A real HTTP regression failed before this correction and passes afterward.
3. README protection claims were reconciled with the scoped implementation. Historical injection findings are not presented as an unfixed renderer in this workspace; broader legacy/private-data limits remain explicit.

## Fresh verification

All commands passed after the source corrections: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (**69 tests / 17 files**) and `pnpm smoke`. Existing tests were retained. Focused regressions cover exact raw input, local navigation/API isolation, CAS writes, restart-safe request identity, selected-only two-project isolation, all built-in tool loaders, provider denial, nested redaction, artifact envelopes, panel disposal/errors and transport recovery.

The fresh foreground runtime was launched with an empty inherited environment except executable paths and explicit `PCR_USER_DIR` / `PCR_PORT`, using a separate temporary workspace on port 4321. Tested URL: **http://127.0.0.1:4321/dashboard/playground/**. It uses four newly authored public synthetic regression fixtures, not the populated owner library. The default owner workspace on port 4319 was not restarted or edited by this pass.

Actual Chrome interaction exercised native file import, library preview, draft creation/edit/save/reload, context roles/inclusion, real compilation, Compare, Sources, expanded ContextPack/PromptIR, history, like/note round-trip, exact copy and Markdown/JSON export, explicit skip, stale-source error/recovery, context-budget omission, narrow navigation, keyboard activation and all four built-in tool routes. Synthetic HTML injection remained literal both initially and reopened from history (no injected image or DOM marker). Repeated compilation retained its request identity. The excluded sentinel did not enter the exported result. Selected external revisions 4 and 9 and their hashes survived compilation/export.

The retained earlier [implementation record](PLAYGROUND_VERIFICATION.md) separately documents two physical tabs conflicting, interrupted-save/restart recovery, native undo/redo, a 32,111-character input, draft/text exports, remove/restore, idempotent setup and other keyboard checks. Those observations are not relabeled as new browser tests. Their corresponding automated regressions were rerun here. The new browser pass did not physically repeat every earlier scenario.

## Visual and interaction assessment

The split writing desk remains the stronger direction for simultaneous input/output and source inspection. The focused canvas alternative offers longer uninterrupted writing but hides comparison. Both wireframes, the typography/palette/spacing/status/surface/radius/motion profile and extension rationale are in the architecture note. Hub's creative, purposeful-simplicity, Taste/Design and elegance guidance informed the review without publishing private source material. Installed Sites 1.1.4 supplied applicable layout/accessibility/browser-review guidance; no missing Taste engine was installed or claimed operational.

Fresh actual screenshots cover desktop editor/output at 1440×900, sources/ContextPack/PromptIR at 1280×800, tablet at 820×900, phone draft/result at 390×844, plus stale-source error, explicit skip and budget omission. DOM measurements at each representative width show the document's scroll dimensions equal the viewport. The browser override was reset afterward. Public images contain only the separate synthetic fixtures and app content, with no browser account/chrome, sensitive paths, owner library or settings paths. Screenshot names, dimensions and scenario captions are included in the issue review report.

**Objective UX:** native labeled controls, visible focus, semantic regions, a keyboard skip link, native text editing and a single Compile action support the critical path. The earlier review corrected grid minimum overflow, quiet-text contrast, modal error placement, focus loss and missing favicon. New raw-input and navigation regressions are corrected. Responsive emulation establishes rendering at four widths, not physical mobile-device or assistive-technology acceptance.

**Product/workflow:** Sources and Inspect are useful progressive-disclosure modules. Checked bindings are distinct from external provenance; local editable snapshots use their local revision, while Sources exposes host revision 4/9. Missing/stale sources fail without losing the draft. Feedback explicitly does not influence selected-only compilation. A remaining UX improvement is stronger historical-result labeling: opening history and then another draft can leave that historical result visible beside the new draft until recompilation. Its original input and compilation ID remain inspectable, and history is not mutated, but the pairing can confuse users. Initial-load action availability could also be clearer.

**Visual taste:** graphite surfaces, restrained sage, system sans prose and monospace exact output provide a coherent productivity identity. Library/context density is useful at laptop sizes; long hashes and inspector JSON are deliberately dense. Text-symbol icons are consistent in restraint but less uniform than a dedicated icon set. Dark-only appearance, small metadata and a generous empty writing area remain aesthetic tradeoffs. No score or owner aesthetic approval is claimed.

## Security and ecosystem scope

The dedicated launcher enforces selected-only local compilation. Project YAML, implicit retrieval/indexing, classifier history/feedback, tool loaders, external providers and commands do not contribute to that path. Tests include hostile project configuration and network/loader spies. API requests need an ephemeral process token and exact local authority/origin checks; the browser holds the token in memory. CSP and inert DOM rendering protect the displayed flow. Credential-shaped nested data is rejected/redacted heuristically, not encrypted or generally classified as private. Existing historical SQLite bytes are not migrated or scrubbed.

Issues #2–#8 remain open. #2 is addressed for maintained workspace rendering; #3/#6 are bounded by local effect policy here; #4/#7 have scoped redaction/access checks; #5 has selected-only isolation tests. Generic legacy project retrieval/configuration, old retained data and gateway routing (#8) still require their own acceptance work. No gateway, privileged port, live model, command execution or dispatcher was required or activated.

The versioned import/compile/export contract preserves source identity, exact revision/hash, project, binding role/order and derived references. `quaggit-fixture` proves an explicit text-snapshot contract, not live Quaggit synchronization. Two real inspection panels and a third test module demonstrate static replacement/disposal/error containment without compiler changes. Runtime arbitrary plugins, live host adapters, Codex/OpenAI assistance/execution, release/sync and light theme remain unavailable future capabilities.

## Owner testing and review

Follow [PLAYGROUND_QUICKSTART.md](PLAYGROUND_QUICKSTART.md) for startup, the complete UI feature tour, safe isolated experiments, storage and shutdown. The build reviewed here started with an empty library on first launch. The private handoff records the preserved local library location and inventory separately.

Remaining acceptance decisions: owner judgment of visual proportions/typography and workflow suitability; Safari/Firefox, physical mobile, VoiceOver and OS text scaling remain unverified. Preserve the current owner tab's unsaved work before restarting its older running server to load this reviewed build. No claim of merge, release or owner acceptance follows from publishing a review branch or draft PR.
