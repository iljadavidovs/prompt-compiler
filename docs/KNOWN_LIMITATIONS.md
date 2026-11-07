# Known limitations in PCR 0.1.0

This is an experimental source release for trusted local use with non-sensitive
data. Linux reproducibility establishes that the software runs; it does not establish
production safety. Release work did not implement the earlier audit's broader fixes.

## Security and trust

- Dashboard history and errors use unescaped `innerHTML`. Stored input can become
  executable HTML when displayed. Do not view untrusted history in the dashboard.
- Text-column redaction does not cover nested PromptIR, ContextPack, or metadata.
  Do not enter secrets; stored structured records can retain them.
- Project `.pcr/config.yaml` is trusted executable configuration in practice. Planner
  configuration can select a program and arguments; providers can select destinations.
  Compile only in projects whose configuration you trust.
- Context, classifier history, and feedback retrieval share the selected database
  across projects. Use separate `PCR_USER_DIR` and `PCR_DB_PATH` values to separate
  projects; project boundaries are not enforced by the compiler.
- `deterministic: true` is not a complete network policy. Grammar rewriting can
  disregard `provider: none` when intelligence is enabled. The verified flow uses
  intelligence disabled, no credentials, fresh trusted defaults, and a network-disabled
  runtime container. Do not rely on the deterministic flag alone.
- The HTTP API is unauthenticated. CORS does not prevent mutation, Host validation
  is absent, and settings can return configured keys. Loopback binding does not
  resolve these issues. Use disposable state for experiments.
- The optional gateway can forward a specially formed path to another upstream.
  Its routing boundary is not safe for untrusted traffic.

## Correctness and operation

- Codex compilation deduplication can delete feedback through SQLite replacement.
- Deleted context files remain indexed after reindexing. Removing a source file
  does not remove its indexed contents. Recreate a disposable database when needed.
- Explicit template selection, configured template/profile defaults, and arbitrary
  variables do not consistently control active rendering. Custom profile lookup can
  ignore `PCR_USER_DIR`. Some accepted context and IR fields do not reach the prompt.
- Local grammar fallback removes the trigger; it does not correct grammar.
  The local intelligence provider is a placeholder.
- HTTP/CLI feedback and numeric validation are incomplete. Infrastructure errors can
  become HTTP 400. Settings updates are not concurrency-safe.
- Background daemon startup can report success after its child failed. PID-file
  identity checks are limited. Prefer foreground startup for diagnosis.
- Every matched compilation reindexes configured context. Returned token budgets
  do not bound file-reading/indexing work; no large-data performance claim is made.
- Tools are statically registered in core; runtime package discovery is absent.

## Verification boundaries

The release excludes the owner's four uncommitted Codex gateway-gating changes.
They remain preserved in the original checkout. Its committed baseline therefore
has 46 tests; the prior working-tree audit's 47 included an uncommitted test.
No existing committed test was disabled or deleted.

Real Codex host consumption, Apple Reminders, live providers, privileged port-80/
hosts-file setup, Windows, Alpine/musl, browser interaction/visual behavior, and
production security are not established by the Linux smoke. HTTP asset delivery
is checked; that is not a browser security test.

Fresh installation requires network access or a supplied compatible cache.
An empty-cache offline install is expected to fail. The installed deterministic
runtime is tested without networking.
