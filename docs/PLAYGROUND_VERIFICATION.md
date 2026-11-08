# Playground verification — 2026-11-08

This is the retained implementation-session record. The later independent recovery/publication audit, fresh synthetic browser evidence, 69-test result and remaining review findings are recorded in [PLAYGROUND_PUBLIC_REVIEW.md](PLAYGROUND_PUBLIC_REVIEW.md). The no-publication statement below describes the earlier session only.

This record covers issue [#9](https://github.com/iljadavidovs/prompt-compiler/issues/9), implemented from remote-main baseline `cebe6524ac07fa2e9568ab44cff4f7fc14b7e56b` on `codex/issue-9-local-playground`. The owner approved interactive implementation including Section 9. The issue remains open for review. No release, push, merge, publication, dispatcher or live provider was used.

## Reproduce

Use [PLAYGROUND_QUICKSTART.md](PLAYGROUND_QUICKSTART.md) for the complete UI test tour. From the task checkout, run `pnpm build`, then `pnpm playground`. The verified URL is `http://127.0.0.1:4319/dashboard/playground/`.

The actual owner session was launched with an empty inherited environment except explicit executable paths, `PCR_USER_DIR` and `PCR_PORT`:

```sh
env -i PATH="$HOME/.local/node/bin:/opt/homebrew/bin:/usr/bin:/bin" \
  PCR_USER_DIR="$HOME/Library/Application Support/PCR/playground-owner" \
  PCR_PORT=4319 "$HOME/.local/node/bin/node" scripts/playground.mjs
```

Tested on the owner's Mac, Darwin arm64, Node 22.11.0, pnpm 9.15.4. The launcher creates missing configuration only, denies providers/commands, fixes the workspace identity and disables dotenv loading. Dependencies/build tools require installation; the working app requires no external runtime assets or service. No Codex executable or provider credentials are needed.

## Feature matrix

**Working** means the stated scenario passed within the tested scope. **Degraded** has an intentional functional limitation. **Deferred** is unavailable and not represented as working. **Not tested** identifies an environment or acceptance check still outstanding. Browser observations below used actual native Chrome interactions, not API-only assertions.

| Capability | Status | Reproducible scenario and observed result |
| --- | --- | --- |
| Draft create/open/edit/save/reload | Working | Native Chrome: create from a library prompt, edit title/request, Save/⌘S, reopen from Drafts and reload. Saved content/bindings survived. |
| Undo/redo and document identity | Working | Native typing with ⌘Z/⇧⌘Z restored the request. Derived/new drafts have independent IDs; previous history remained unchanged. |
| Duplicate/conflicting saves | Working | Two real Chrome tabs saved competing edits. Losing save displayed conflict and retained its text; Duplicate saved an independent recovery copy. Store CAS/concurrency tests also passed. |
| Interrupted save/recovery | Working | Stopped only the task server, attempted Save, restarted it and retried. Text survived; session renewed after restart. Unsaved reload restored browser recovery with a visible notice. Transport/store tests cover interruption without changing the caller's mutation body. |
| Library browse/search/load | Working | Opened useful briefs, read purpose/inputs/review criteria/provenance, used one as a draft, searched and exercised the no-results state. The local library has 19 useful active entries; private inventory is outside Git. |
| Library edit/duplicate/remove/restore | Working | Synthetic source edited from revision 1 to 2, then compiled with an old binding: visible changed-source error. Removal produced a missing-source error. Settings restored it at a new local revision. Duplicate saved a new identity. Both QA items were soft removed again. |
| Import/export | Working | Native paste and file-picker import; malformed version remained in the dialog with an inline error. Actual exported file reimported as 0 imported/18 unchanged. Automated tests cover atomic conflicts, malformed/unknown adapters, invalid IDs/hashes and exact refs. Export contains active items only. |
| Setup/seed rerun | Working | Launcher/init creates missing setup only. Re-ran the private seeder against the owner workspace and an isolated copy containing a deliberate edit to a seeded item: complete workspace bytes stayed unchanged and the edit survived. No corpus or seed script is committed. |
| Roles/order/inclusion | Working | Native UI changed a binding role and showed both selected revisions. Core/API tests verify ordered exact content, role rendering, exclusion and omission reasons. No library search index contributes to compilation. |
| Selected-only/project isolation | Working | Two synthetic projects share a test database: indexed A context, feedback/history and B project configuration do not enter selected-only B output. All four tool loaders and network spies remain uncalled. |
| Context budget | Working | Native Settings changed budget to 256; oversized selected sources were omitted and identified in Sources. Restored 6000. Regression checks effective budget and warning metadata. Whole sources are omitted; raw input is preserved. |
| Coding/planning/progress | Working | Each real tool compiled through Chrome and the canonical core. No command, Reminders or external-provider path was used. The app prepares prompts; it does not answer the task. |
| Grammar | Degraded | Native `grammar fix: we is ready` uses the local trigger-stripping handoff and explicitly says no correction occurred. Empty post-trigger text skips. It is not a grammar checker offline. |
| Empty/no-match/explicit skip | Working | Empty request disables Compile; unsupported request creates a skipped record. Explicit skip followed by ordinary Compile produced distinct valid records without request-ID conflict. Raw input remains inspectable. |
| Pending/retry/identity | Working | Chrome 3G throttling showed disabled “Compiling…” before a real result. Concurrent/repeated HTTP requests create one record. A regression restarts the actual server, rotates its session and confirms the same request ID resolves to the original compilation in SQLite. |
| Result/Compare/Sources/Inspect | Working | All four actual Chrome views used. Original input and generated output remain distinct. Sources show exact hashes/revisions/roles; Inspect exposes real ContextPack, PromptIR, effective policy, warnings, metadata and trace. |
| Long content/copy | Working | A 32,111-character single-line request compiled to 35,096 characters. Actual Chrome Copy → native paste → saved draft matched the prompt exactly. Long text wraps in the result; panes scroll within the viewport. |
| Compilation exports | Working | Actual Chrome Markdown, text and JSON downloads were compared locally: Markdown/text/JSON prompt values match exactly; JSON preserves raw input and two source refs. Local fidelity reports accompany the screenshots. |
| Draft-specific export menu | Working | In a separate fresh workspace, actually downloaded draft Markdown and `.draft.json` through Chrome. Both match the saved draft exactly; JSON preserves identity, bindings and project ID. The owner's active unsaved draft was left intact. |
| Keep/reuse/history | Working | Kept a real result in the local library with compilation/source provenance. New draft from result created and saved an independent derived draft. Opened a prior history record, including synthetic injection text. |
| Feedback | Working | Actual Chrome like + note saved and reopened with the same note/rating. API tests cover like/neutral/dislike. Feedback is review data; selected-only compilation explicitly does not retrieve or learn from it. |
| Tools/settings | Working | Disabled coding in Chrome, observed skip, restored coding and reloaded. Context budget persists in this browser. Providers/commands and unsupported configuration are unavailable through the dedicated workspace API. |
| Inert content/local API boundary | Working | Browser injection fixture remained literal after compile and history reopen; observed injected marker null, zero images and no remote resources. Tests reject foreign authority/origin, unauthenticated reads/mutations, cwd override and command/provider config, and verify nested credential redaction. |
| Editor/panel extension seam | Working | Two real modules, Sources and Inspect, share tokens/navigation. A third synthetic module tests replacement/disposal and contained errors without compiler changes. Native editor, browser recovery, transport and file persistence are separately owned. |
| External artifact contract | Working | Explicit text import/compile/export preserves two synthetic host revisions 4/9, project identity and derived-from refs. Missing/stale/unsupported adapter errors are visible. This is a local contract fixture, not a live Quaggit connection. |
| Keyboard/responsive | Working | Actual ⌘S, ⌘Enter, ⌘K, native undo/redo, Tab/Shift-Tab, dialog focus return and Escape dismissal. A fresh-tab Tab → Return on “Skip to editor” focused Request. Rendered all four required widths; tablet Draft/Result switch, phone library drawer and real phone compilation/feedback worked. |
| Live providers/agent execution/host sync | Deferred | Capability is explicitly unavailable. No login, credential extraction, paid call, dispatch, release or sync implemented. Future supported adapter boundaries are documented separately. |
| Light theme/rich preview/runtime plugins | Deferred | Dark appearance and faithful Markdown/plain text only. No unsupported switches are shown. |
| Other browsers/devices/assistive tech | Not tested | Safari, Firefox, physical iPhone/iPad, VoiceOver, OS text scaling and non-Mac shortcuts were not physically exercised. Chrome responsive emulation establishes layout at those widths, not physical-device acceptance. |
| Owner aesthetic acceptance | Not tested | Screenshots establish rendering. The owner still needs to judge the chosen proportions, typography and visual character. |

## Automated checks

All passed: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (**67 tests across 17 files**), and `pnpm smoke`. Focused tests are in core `selected-only.test.ts`, daemon `playground.test.ts`/`workspace-store.test.ts`, and dashboard `panels.test.ts`/`transport.test.ts`/`persistence.test.ts`. Existing regression tests remain present.

The Mac smoke suite exercises CLI init twice/index/FTS/deterministic compile/skip/history/feedback, SQLite integrity, protected HTTP endpoints and dashboard assets, plus MCP initialize/list/all six tools and clean exit. It reports credentials not inherited, Codex not required, provider calls not required and reminders disabled. It uses disposable directories, not the owner library.

## Browser and design review

Native Google Chrome was used because the configured browser connector was disabled in Work settings. A task-only incognito window held the local app and a second local tab for conflicts. Chrome DevTools responsive mode supplied exact CSS viewports and real screenshot downloads. Read-only DOM measurements via the DevTools UI confirmed `scrollWidth === innerWidth`, `scrollHeight === innerHeight` and visual scale 1 at 1440×900, 1280×800, 820×900 and 390×844. A temporary emulated touch zoom was reset before final review. This was not an app overflow fix.

Screenshots are private files under `PCR_USER_DIR/evidence/`, outside Git:

| File | Viewport / purpose |
| --- | --- |
| `before-desktop-1440x900.png` | Initial real empty editor before owner-library population. |
| `review-defect-page-overflow-1440x900.png` | Observed long-result page expansion before correction. |
| `after-desktop-1440x900.png` | Populated draft/context beside a genuine compiled prompt after correction. |
| `after-sources-1280x800.png` | Laptop composition with the real Sources widget. |
| `after-tablet-draft-820x900.png` | Recomposition into a focused draft with visible library and context. |
| `after-phone-draft-390x844.png` | Focused editing, context and Compile; visible library-toggle focus. |
| `after-phone-result-390x844.png` | Real result with wrapping, inspection navigation and reuse/feedback actions. |
| `after-final-contrast-1440x900.png` | Final palette and genuine compilation in a separate fresh workspace on port 4320; empty-library state and draft exports verified without touching the owner's active draft. That disposable test server was stopped afterward. |

Before/after refers to the implementation review, not an unrecorded claim about the old dashboard. Images are real app captures with original non-sensitive synthetic material. Step-by-step primary-flow observations and copy/export fidelity reports are in the private evidence directory. No recording was needed because native interactions and the step-by-step record provide reproducible evidence.

**Objective UX/accessibility corrections.** A long result made CSS Grid's implicit minimum expand the whole page: the desk reached 2518px inside a 900px viewport. Explicit `minmax(0, 1fr)` rows and pane `min-height: 0` now keep the desk at 832px and the result scroll area at 553px, with the 2238px result scrolling inside it. The final quiet-text token was raised from `#798781` to `#819088` after a palette calculation found 4.17:1 on input surfaces; it now exceeds 4.5:1 on all five listed neutral surfaces. The additional final desktop capture verifies that exact computed token, scale 1 and no page overflow; earlier captures establish the other unchanged layouts. Dialog import errors initially appeared behind the modal; errors now render inline without losing pasted text. Binding rerenders preserve focus, labels activate inclusion controls, and reorder targets were enlarged. The skip-link now focuses the editor instead of routing to an unknown hash. A missing favicon request observed in the fresh browser was corrected with a local PCR vector icon; reload showed no console errors. Automated transport tests and an actual interrupted save drove session renewal after a server restart. Explicit skip and ordinary Compile now use distinct request identities.

**Product/workflow corrections.** Omitted-source warnings are visible in the result as well as Sources. Grammar output no longer labels untouched text “Corrected.” Edited drafts/tool settings/budgets clearly mark old results stale. Failed/missing/changed sources retain the editor. Feedback states its lack of selected-only learning. Inspection is progressive; one Compile action remains at the writing surface's foot.

**Visual taste review.** The split desk was chosen over a full-width canvas/result drawer for simultaneous comparison and source visibility; the two wireframes and tokens are in [PLAYGROUND_ARCHITECTURE.md](PLAYGROUND_ARCHITECTURE.md). Prose and exact compiler text use distinct typography, quiet surfaces establish boundaries, and sage emphasizes the action. Laptop filters may wrap; long prose scrolls inside the editor; source hashes remain dense by design. Dark-only appearance, system fonts and restrained text symbols are deliberate compromises. No numerical design score or owner approval is claimed.

Sources reviewed: PCR dashboard/website conventions; Hub creative route/profile, purposeful simplicity, shared-taste and UI-pattern research tasks, elegance/compression and Quaggit ecosystem guidance; relevant Quaggit CLI and Alignerr boundary references. Installed **Sites 1.1.4** general layout/accessibility/browser-review guidance was applicable. Hosting/registration and marketing formulas were not used. Hub-listed Taste Skill and ilja-taste were not verified installations and were not installed or represented as operational. Apple Notes/Linear supplied conceptual interaction principles, not copied code/assets.

## Protection and remaining limits

Owner material, inventory, seed script, screenshots, databases and downloaded exports stay outside Git. The original checkout's unrelated edits were preserved in place; this work uses a separate worktree. Credential-pattern checks are heuristic, not encryption or general personal-data detection. Existing historical SQLite bytes are not rewritten. Browser recovery is best-effort and disappears with incognito/private-storage lifecycle; explicit Save is authoritative. Library edits that conflict must be copied before reloading. A crash can leave a lock requiring deliberate recovery after checking that no writer is active.

Issues #2–#8 remain open. Strict selected-only and local effect policy are verified for this workspace; generic project retrieval, legacy gateway behavior and broader provider/private-data requirements are not claimed fixed. The app serves only on loopback; it is not a hardened multiuser service. See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) and the architecture note for exact scope.
