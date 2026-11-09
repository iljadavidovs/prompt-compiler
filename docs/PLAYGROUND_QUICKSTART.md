# PCR Playground: local test tour

Use Node 22 and pnpm 9.15.4. No Codex installation, account or provider key is needed. From this branch's checkout:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm playground
```

Open **http://127.0.0.1:4319/dashboard/playground/**. Keep the terminal open; Ctrl-C stops this foreground server. This uses a dedicated workspace at `~/Library/Application Support/PCR/playground-owner` by default and leaves an existing `~/.pcr` installation alone. `PCR_USER_DIR`, `PCR_DB_PATH` and `PCR_PORT` can explicitly choose different locations/port. Do not point experiments at a database you want to keep separate.

The maintained UI is also reachable from the existing dashboard's History/Tools/Settings routes. The dedicated `playground` command provides the strict fixed-workspace, selected-only API boundary described below. No gateway, privileged port or hosts-file change is needed.

## First useful compilation

1. In a fresh workspace, open **Debug a search reset** in **Library** and choose **Use as draft**. The [sample pack](../examples/playground-sample-pack.json) includes **Recipe search behavior** and **Search fix checklist** for the context selection step. Use **+** to start with your own request.
2. Edit the title and request. Replace bracketed placeholders with facts you know; missing facts can remain explicit placeholders. **Save** or **⌘S** writes the draft locally.
3. Open a context or criteria item and choose **Add to context**. The Context tray shows inclusion, role, exact revision and a short content hash. Choose a role and order the sources with the arrow control. A checked source is included; an unchecked source remains visible but is excluded.
4. Press **Compile** or **⌘Enter**. PCR classifies the request against enabled built-in tools, constructs ContextPack/PromptIR, renders a prompt and writes a real history record. It does not answer or execute the task.
5. Read **Prompt**, **Compare**, **Sources** and **Inspect**. The source list shows inclusion or omission and exact provenance. Inspect expands warnings, effective policy, raw input, ContextPack, PromptIR, trace and metadata.
6. **Copy**, **Export**, **Keep in library**, or create a **New draft from result**. Feedback records a rating and optional note. A compilation is a snapshot, so later edits do not alter it.

## Test every supported feature

| Feature | Practical UI test | Expected behavior |
| --- | --- | --- |
| New/open/edit/save | Use **+**, write a title/request, Save; open **Drafts** and reopen it. Reload after saving. | Same title/content/bindings survive; status says Saved locally. |
| Undo/redo | Type into Request; use ⌘Z and ⇧⌘Z. | Native editing undo/redo changes only this draft. Opening another document starts a different edit session. |
| Unsaved recovery | Make an edit, reload and accept the browser's leave prompt. | Unsaved recovery is offered/restored from this browser's workspace storage. Save explicitly to make it durable outside this browser. |
| Duplicate draft | Open **••• → Duplicate draft**, edit the copy and Save. | New identity; original draft remains unchanged. This also provides a safe copy after a save conflict. |
| Draft export | **••• → Export draft .md** and **Export draft JSON**. | Markdown contains the current editable request. JSON includes draft identity, bindings and derived compilation reference; it is distinct from a compilation export. Library import accepts `pcr-library`, not this draft envelope. |
| Save conflict | Open the saved draft in two tabs. Save an edit in tab B; change and Save in tab A. | A reports a revision conflict and keeps its text. Use Duplicate or Export before reloading. No silent overwrite. |
| Save failure | Stop the foreground server, edit and Save; restart and retry. | Error is visible; editor contents remain. Browser recovery is best-effort and recognizable credentials are not retained there. |
| Browse/search/filter | Try Library/Drafts, All/Prompts/Context/Criteria, then search a title/tag/content fragment. Try a nonsense query. | Relevant entries or an explicit no-results state; search never indexes unrelated folders. |
| Library create/edit/duplicate | **••• → Keep in library**, fill purpose/inputs/criteria/tags/provenance; reopen it, Edit or Duplicate. | Validated text artifact with stable ID/revision/hash; no executable configuration. Editing an included source requires explicit binding refresh. |
| Library import | **Import JSON**; paste supported JSON or choose a file. Import it twice; try malformed JSON or a changed existing ID. | Idempotent unchanged import; conflicts or malformed data stop visibly and preserve existing work and the import text. |
| Library export | **Export library**; save JSON and reimport it into an isolated workspace. | Active library items only, including exact source identity/provenance. Drafts, history and removed items are separate. |
| Remove/restore source | Open a temporary library item and Remove. Reopen Settings → Restore removed library item. | Recoverable removal; selected missing sources stop compilation. Restoring requires explicit revision refresh. Old results remain stable. |
| Roles/order/inclusion | Select two items. Change a role, move the second up, or uncheck one; compile each version. | Ordered selected-context sections and provenance change. Unchecked content is absent. Nothing implicit is retrieved. |
| Stale source | Edit an included library item, then Compile without refreshing its binding. | Explicit changed-source error; draft preserved. Refresh its binding in Context and retry. |
| Context budget | Settings → change/save context budget; compile with a source larger than the budget. | Whole sources that do not fit are omitted and identified in Sources; the request is not silently truncated. |
| Empty/no-match/explicit skip | Empty Request disables Compile. Try `hello there`. Then **••• → Record explicit skip** on a nonempty request. | No invented successful prompt; skipped record and reason, original input still visible. |
| Pending/retry | Under browser network throttling, Compile and click again. | One pending action; repeated requests use the same identity, including after an uncertain response. No duplicate history write. |
| Compare/inspection | Use all four result views and expand each Inspect section. | Faithful original/compiled comparison, real objects and policy, exact sources and trace; long text wraps and scrolls. |
| Copy/export | Copy into a local text editor; Export as Markdown/text and JSON + provenance. | Text/Markdown contain exact prompt bytes. JSON contains the original input and real compiler/provenance record, marked draft. Nothing is released or executed. |
| Keep/reuse result | Keep in library, then reopen; or New draft from result and Save. | Reusable local text; original compilation remains unchanged. |
| History/feedback | History → Open → Feedback; save like/neutral/dislike with a note and reopen Feedback. | Rating/note round-trip. Selected-only compilation never retrieves feedback, so it does not learn from the rating. |
| Tools | Tools → disable a tool; try its trigger. Enable it and retry. Reload Tools. | Toggle persists and affects routing. Disabled tools cannot be selected. No hidden provider/reminder activation. |
| Coding | Try `Debug a save conflict in this code` with selected project context. | Coding prompt with selected sources; no automatic file loading. |
| Planning | Try `Plan the next work period using the selected constraints`. | Planner prompt; no Reminders access, command execution or background scheduling. |
| Progress | Try `Assess progress against the selected goals and evidence`. | Progress-assessment prompt using only selected context. |
| Grammar | Try `grammar fix: we is ready`. Try `grammar fix` alone. | Local fallback strips the trigger and warns that it does **not** correct grammar. Empty remaining text is skipped. No model call. |
| Inert rendering | In a disposable draft enter `Debug <img src=x onerror="document.body.dataset.pcrInjected='yes'">`; Compile, inspect and reopen from History. | Literal text only; no injected image/script/DOM change. |
| Keyboard/responsive | Use Tab/Shift-Tab, Escape to close a dialog/library, ⌘K for search, ⌘S and ⌘Enter. Resize through 1440, 1280, 820 and 390px. | Visible focus, labeled controls, usable dialogs, Draft/Result switch at narrower widths, dismissible phone library. |
| Unavailable adapters | Inspect Settings; try importing a source with an unknown `host`. | Providers and agent execution are unavailable; unsupported source adapter fails visibly. No fake Connect action. |

On Windows/Linux, Ctrl substitutes for ⌘ in the implemented shortcuts; those platforms are not physically verified by this Mac session.

## Storage and safe experiments

The dedicated launcher creates missing setup configuration and loads the sample pack only when `PCR_USER_DIR/library/workspace.json` is missing. Later launches preserve the existing library and drafts, including sample edits and removals. To add the samples to an existing workspace, use **Import JSON** and choose `examples/playground-sample-pack.json`. Import reports a conflict if a sample ID already exists with different content.

Library and drafts live in `PCR_USER_DIR/library/workspace.json`. Compilation history and feedback live in `PCR_DB_PATH`, which defaults to `PCR_USER_DIR/pcr.sqlite`. Browser recovery is keyed by workspace identity. Context-budget preference is local to this browser. Settings displays the actual paths.

The populated owner library, original import envelope, inventory and idempotent local seeding script are provided privately outside Git. They contain original AI-assisted material, not imported personal notes or assessment content. Export only the scope you intend to share. Recognizable credential patterns are rejected/redacted, but this is not a secret vault, general personal-data detector or encrypted store.

For a fresh isolated experiment, stop only the server started for this test and use a **new directory**:

```sh
PCR_DB_PATH= PCR_USER_DIR="$(mktemp -d /tmp/pcr-playground-test.XXXXXX)" PCR_PORT=4320 pnpm playground
```

Open the printed URL to try the three samples in a separate workspace and database. Keep the directory if it contains work you want. Do not reset by deleting your real library or SQLite database. A stale `workspace.json.lock` after an interrupted write requires checking that no writer is running before moving that lock aside; no automatic lock removal is performed.

## Deliberate limitations

The compiler prepares prompts, not model answers. Only the four installed built-in tools are exposed; a request with no matching enabled tool skips. Context is selected-only in this UI; project auto-retrieval is unavailable. Grammar does not correct text offline. No live Quaggit, Codex/ChatGPT-plan or API-key adapter, reminders, automatic execution, release, publication, light theme, rich Markdown preview, collaborative sync or runtime plugins are implemented. Markdown is edited and inspected as faithful text.

The generic legacy compiler's project-context behavior and gateway still have the limitations in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md). Use this dedicated workspace for the verified strict boundary. The [architecture note](PLAYGROUND_ARCHITECTURE.md) describes policy and the [verification matrix](PLAYGROUND_VERIFICATION.md) distinguishes actual tests from remaining human/environment checks.
