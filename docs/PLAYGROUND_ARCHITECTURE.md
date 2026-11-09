# Local Playground decision record

Issue: [PCR #9](https://github.com/iljadavidovs/prompt-compiler/issues/9). Baseline: `cebe6524ac07fa2e9568ab44cff4f7fc14b7e56b`. Scope: an owner-launched local authoring workspace; no release, provider activation, publication or agent execution.

## Critical path and design choice

Find/open an artifact → write → choose exact context with roles/order → Compile → compare/inspect → save, copy or export.

Two alternatives were considered before implementation:

```text
A · Split writing desk                   B · Focused editorial canvas
┌──────────┬────────────┬────────────┐    ┌─────┬────────────────────────┐
│ Library  │ Draft      │ Result     │    │Rail │        Draft           │
│ Search   │            │ Prompt     │    │     │                        │
│          │ Context    │ Inspection │    │     ├────────────────────────┤
│          │   Compile ↗│            │    │     │ Result drawer          │
└──────────┴────────────┴────────────┘    └─────┴────────────────────────┘
```

A was selected because a compiler benefits from simultaneous input/output comparison and visible source bindings. B gives more space to uninterrupted writing but hides the comparison and makes provenance less immediate. Below 1000px, A recomposes into Draft/Result views; below 650px, the library becomes a dismissible rail. The writing canvas keeps its width instead of shrinking three columns into a phone.

Interaction principles: focused document editing and native undo from text editors; a quiet navigable collection and progressive detail from notes tools; explicit inspection from developer tools. Linear and Apple Notes are conceptual references from the reviewed purposeful-simplicity guidance, not copied layouts/assets. No third-party visual assets, fonts or templates were used.

The previous dashboard's light administrative cards were unsuitable for sustained writing. EssenceKit's static build and existing navigation remain; the maintained workspace replaces the unsafe history renderer with inert DOM text. The product follows PCR's dark/monochrome brand with restrained green, rather than copying the marketing website's sections.

## App design profile

| Token | Choice / purpose |
| --- | --- |
| Typography | Installed system sans for navigation/prose; system monospace for exact compiled text, hashes and JSON. Editor 15px/1.85 on desktop; compact secondary text has quieter hierarchy. |
| Spacing | 8px base; 24–34px writing/result gutters; quiet library with consistent row spacing. |
| Palette | Graphite background `#151719`; rail `#181b1d`; result surface `#191c1e`; raised inputs `#202427`. |
| Text | Main `#e5e9e7`, secondary `#a1aba7`, quiet `#819088`. |
| Status | Sage `#b8dcc5` for Compile/focus; amber `#e3c28b` for dirty/stale; coral `#f1aaa2` for errors. Status also uses words. |
| Separation | `#303638` borders, 7px control radius; elevation reserved for dialogs and mobile library. |
| Motion | 120ms control feedback; no decorative animation; reduced-motion disables transitions. |
| States | Explicit new/saved/dirty/saving; pending/compiled/stale/skipped/failed; included/excluded/missing/changed sources; disabled empty Compile and unavailable provider capabilities. |

Anti-patterns: administrative card walls, AI chat bubbles, ornamental gradients, fake metrics, a second primary Compile button, hidden context inclusion, copied marketing heroes, unexplained icon-only actions, a half-supported theme switch, and raw HTML rendering of authored content. Dark is the only supported appearance in this increment.

Actual review is recorded in `docs/PLAYGROUND_VERIFICATION.md`; screenshots and owner-local material remain outside the repository. Objective defects, workflow findings and subjective choices are recorded separately. Owner aesthetic acceptance is still required.

## Ownership and simpler alternative

A browser-only textarea plus localStorage and additive `contextBlocks` would be smaller, but it cannot provide an authoritative local library, concurrent-file protection, or exclusive context selection. It was rejected for those concrete requirements. The chosen structure adds only the boundaries exercised now:

| Owner | Responsibility |
| --- | --- |
| Native editor adapter | Read/open/focus/dispose and native input events. Undo/redo affects the current draft, never a prior compilation. Opening a different document resets its native edit session. |
| Workspace client | Current draft, current result snapshot, selection and UI commands. It does not render/compiler-classify prompts itself. |
| Persistence client | Namespaced browser recovery and context-budget preference. Explicit backend saves remain authoritative. |
| HTTP transport | Ephemeral local session, timeout/error handling and explicit requests. No provider integration. |
| Trusted inspection panels | Sources and Inspect mount into the same result area and share design tokens, navigation and error handling. |
| WorkspaceStore | Standalone library/drafts in one versioned JSON file. Revision-checked writes under an exclusive lock, synced temporary file and atomic rename. No library search index or automatic ingestion. |
| Canonical PCR core/store | Classification within enabled tools, ContextPack, PromptIR, rendering, compilation history and separate feedback events. |

Drafts, library artifacts and compilation records are distinct. A result carries its own raw input and source snapshot. Editing a draft does not mutate history; creating a draft from a result establishes a derived reference. Failed saves preserve the editor and browser recovery; conflicting writes require an explicit copy or reload. The local library uses soft removal/restoration, and selected sources are resolved on every compile. Missing or changed bindings fail visibly. Archived sources cannot return through a search index because no such index participates.

The browser modules are static ES modules, with no new runtime dependency. The native editor can be replaced through `createEditor` without changing compilation or persistence. There is no event bus, runtime plugin loader, marketplace, DSL, scheduler or duplicate artifact database.

## Extension proof

`panels.d.ts` defines `InspectionPanel` and `InspectionContext`. `panels.js` supplies two real built-ins: Sources and Inspect. Each receives a host and an immutable result snapshot; `mount` may return cleanup. The caller disposes the old panel before mounting another. A failing panel reports an error and preserves the draft/result.

To replace/add a trusted widget: export another object implementing that contract, add it to the static `panels` array in `app.js`, and add its navigation button using the shared `data-panel` convention. No compiler edit is required. The module lifecycle regression test uses a third synthetic module, checks cleanup and contains a throwing module. Both real panels are exercised in Chrome. Static registration is intentional; external arbitrary code is not loaded.

## Artifact boundary

Library exchange: `{ format: "pcr-library", schemaVersion: 1, projectId, items }`. Items carry stable IDs, artifact type, revision, SHA-256 of exact UTF-8 content, purpose, expected inputs, review criteria, tags, sensitivity and authorship/provenance. Imported snapshots can preserve a `SourceReference` with host/project/artifact/revision/hash. Changes to imported content become a local revision; the unchanged imported source is not misrepresented as updated external content.

Compilation exchange: `{ format: "pcr-compilation", schemaVersion: 1, state: "draft", projectId, rawText, derivedFrom, result }`. `derivedFrom` preserves exact source identities/revisions/hashes and binding roles/order. The result is PCR's existing `CompilePromptOutput`, with policy, inclusion/omission and provenance in metadata. The raw request and result remain inspectable separately. Library exports preserve original source identity across local-workspace import; the importing workspace owns its editable snapshot, not the external artifact.

The synthetic `quaggit-fixture` host demonstrates two exact selected revisions, malformed/stale/missing sources and an unavailable adapter. This is explicit resolved-text import/export, **not a live Quaggit integration**. PCR never opens Quaggit's database, releases artifacts or launches execution. A future host adapter must resolve content through its approved API/CLI and save the compiled result as a derived draft. Canonical external content/revisions/releases remain with that host.

## Capability policy and protection scope

`contextMode: selected-only` is enforced in the shared compiler. It ignores project YAML and custom profiles, skips tool context loaders and implicit indexing/retrieval, and passes no classifier history or feedback examples. Selected content is budgeted and rendered once in binding order across every built-in tool. Disabled/excluded sources never enter that compilation. Global user config chooses enabled built-in tools; it does not override the selected-only effect policy.

Selected-only and `executionPolicy: local-only` deny network/provider assistance and tool context loaders. `deterministic: true`, explicit `provider: none`/`deterministic`, and disabled intelligence override enabled provider settings for classification and grammar. The local grammar fallback removes the trigger and explicitly reports that no grammar correction occurred. Empty grammar content and explicit user skip produce real skipped records.

The dedicated launcher fixes the workspace identity and database, blocks indexing/retrieval/cwd overrides and provider/command configuration, and routes both compile endpoints through the selected-only contract. Generic CLI/MCP and the legacy HTTP compile contract remain compatible and experimental outside this boundary.

HTTP APIs require an ephemeral per-process token held only in client memory. Browser bootstrap requires a same-origin fetch with a custom header; arbitrary origins/authorities and same-site/cross-site requests are rejected before API access. CORS is not the authorization mechanism. CSP disallows inline scripts, frames, remote assets and remote connections. Library, history, errors and inspector content use `textContent`/native form values. Ordinary JSON responses recursively redact credential-shaped fields; library/draft save/import reject recognizable credentials rather than silently altering authored content. Redaction is heuristic, not PII detection or encryption. Existing SQLite records are redacted when returned through HTTP but are not destructively migrated.

The original issues #2–#8 remain open. Generic project configuration, shared-database retrieval outside selected-only, old data at rest, gateway routing, and broader provider trust need their own complete acceptance evidence. This increment neither enables nor relies on the gateway.

## Future assistance and execution adapters

Compiler assistance and agent execution are separate capabilities. Both are unavailable in the current UI. There are no fake connection buttons, browser API-key fields or live account probes.

Official interfaces were rechecked on 2026-11-08. A future Codex/ChatGPT-plan adapter should use the supported app-server protocol and its explicit account/auth flow; account model availability is not blanket permission or entitlement. It must handle capability discovery, explicit invocation, cancellation, errors and provenance through that supported interface. See [Codex app-server](https://learn.chatgpt.com/docs/app-server) and [Codex authentication](https://learn.chatgpt.com/docs/auth).

A separate OpenAI API adapter should reuse PCR's intelligence boundary and trusted backend credential handling. API keys must not enter the frontend, browser storage, library, history, ordinary settings responses or exports. See [OpenAI API-key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety). No authentication stores were read and no live provider calls were made for this work. Recheck these interfaces again before implementing a live adapter.
