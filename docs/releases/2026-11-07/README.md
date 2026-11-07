# PCR 0.1.0 Linux release preparation — 2026-11-07

Status: committed source verified on Linux; branch/PR publication, final owner
approval, and anonymous public checks remain pending.
This record does not claim that PCR is already public or production-safe.

## Provenance and preservation

Original local and remote `main`:
`1650b4c8a2b70185ea0eb63fd2ed47f491f50035`.
Task branch: `codex/hub-45-linux-release`. The task uses a separate worktree.
The original checkout's four pre-existing modified Codex source/test/docs files
remain unchanged and were excluded from this candidate. Their SHA-256 hashes were
rechecked against the audit. The Codex setup guide in this branch independently
replaces personal paths with placeholders; it does not incorporate the owner's
uncommitted guide change. No existing committed test was removed: 46 tests run,
where the earlier dirty-working-tree audit ran 47.

The first candidate was exported from current intended files, with no `.git`, ignored
local files, dependencies, native binaries, caches, databases, or private backlog.
Its Linux build image ID was
`sha256:f243826773136013b21bea271b2238db67e0bc87a13e5bfb534a2349bfbb44ca`.
Source release implementation commit:
`a4c7175570829ce90c3964529e3e89e2a71e0e8b`.
The owner explicitly confirmed local commit request
`7bd43cb40172485f904c70c790b6df89`; it was created through the installed workflow.
`DOCKER_CONTEXT=colima-pcr45 ./scripts/verify-linux.sh HEAD` then passed against that
exact committed revision, including fresh install, every build/check, and the
network-disabled runtime smoke. Its Git source archive was 839,680 bytes.
See [committed-revision output](evidence/committed-release-verification.txt).
The evidence commit and final exact-head rerun are identified in the canonical
PR/execution report; a committed file cannot embed its own commit hash.

## Environment and executed checks

Disposable Colima profile with host mounts and SSH-agent forwarding disabled.
Docker test containers had no host mounts, personal credentials, or Codex installation.
Debian GNU/Linux 12 (bookworm), Linux ARM64/aarch64, glibc; Node 22.23.4,
npm 10.9.9, Corepack 0.36.0, pnpm 9.15.4. The Docker base manifest is pinned in
[`scripts/linux/Dockerfile`](../../../scripts/linux/Dockerfile).

Exact commands, timestamps, exit statuses, and elapsed times are in
[`evidence/commands.json`](evidence/commands.json); full meaningful stdout/stderr
is retained in the linked text records. ANSI color escapes and trailing line whitespace were removed;
[`log-manifest.json`](evidence/log-manifest.json) records original and archived hashes.

| Check | Result | Evidence |
| --- | --- | --- |
| Corepack/pnpm bootstrap in fresh container | PASS, exit 0 | [bootstrap](evidence/baseline-bootstrap.txt) |
| Original baseline `pnpm install --frozen-lockfile` | PASS, 292 packages, reused 0, exit 0 | [install](evidence/baseline-install.txt) |
| Candidate fresh frozen workspace install | PASS, 292 fresh packages, exit 0 | [candidate build](evidence/candidate-linux-build-context.txt) |
| Workspace build/typecheck/ESLint | PASS, all commands exit 0 | [candidate build](evidence/candidate-linux-build-context.txt) |
| Full existing Vitest suite | PASS, 46 tests across 11 files | [candidate build](evidence/candidate-linux-build-context.txt) |
| CLI init twice, index, FTS search, compile JSON/trace, stable prompt, skip | PASS, exit 0 | [offline smoke](evidence/candidate-offline-runtime.txt) |
| SQLite migration/integrity/foreign keys/FTS5/history/feedback | PASS | [offline smoke](evidence/candidate-offline-runtime.txt) |
| Real MCP stdio initialize/list/all six tool calls/clean exit | PASS, exit 0, no stderr | [offline smoke](evidence/candidate-offline-runtime.txt) |
| Loopback HTTP health/index/search/compile/history/feedback/metadata | PASS, HTTP 200 | [offline smoke](evidence/candidate-offline-runtime.txt) |
| Dashboard HTML/JS/CSS delivery and production build | PASS | [smoke](evidence/candidate-offline-runtime.txt), [build](evidence/candidate-linux-build-context.txt) |
| Separate website `npm ci`, dev/prod builds | PASS, no credentials | [candidate build](evidence/candidate-linux-build-context.txt) |
| Native better-sqlite3 forced source rebuild and runtime smoke | PASS, exit 0; upstream compiler warnings retained | [native build](evidence/native-fallback-recursive.txt) |
| Empty-store, disconnected-network `pnpm install --offline --frozen-lockfile` | FAIL as expected, exit 1: missing uncached tarball | [offline install](evidence/offline-empty-store.txt) |
| Installed CLI/SQLite/MCP/HTTP without network | PASS with `docker run --network none` | [offline smoke](evidence/candidate-offline-runtime.txt) |
| Actual Codex host, Apple Reminders, live providers, browser behavior, privileged gateway, x86-64, Windows, Alpine | NOT TESTED | [boundaries](../../KNOWN_LIMITATIONS.md) |
| Public visibility and anonymous release access | BLOCKED pending exact owner approval | Current repository remains private |

The smoke resets inherited environment, uses disposable HOME/PCR_USER_DIR/PCR_DB_PATH,
sets PCR_SKIP_ENV_FILE=1 and intelligence disabled/provider none, and uses the README's
ordinary documented input. No external provider call or real Reminders access occurs.

## Corrections and unsuccessful harness attempts

The baseline itself installed and built on Linux. No compiler, SQLite, esbuild, Rollup,
or Vitest repair was required. EssenceKit references were pinned to their existing
commit through HTTPS, eliminating floating GitHub and SSH-form references. npm's old
SSH-form lockfile also installed successfully in this environment; it was not reported
as an observed authentication failure. Package versions now agree with the runtime's
0.1.0 identity, Node/pnpm requirements are explicit, generated output is excluded,
and MIT/root/EssenceKit notices are present.

The first new smoke invocation failed because the harness used `store.db` instead of
`store.database`; CLI compilation had already passed. The harness was corrected and
rerun successfully. Two initial Docker build attempts failed before application checks
because the installed legacy Docker CLI lacked `--progress` and rejected an ambiguous
stdin Dockerfile/context. The verifier now exports to a disposable directory and uses
ordinary Docker build arguments. These failed commands and their logs are preserved;
no test was disabled and no application failure was hidden.

## Source/history and licensing review

The existing remote advertised only `main`, at the original SHA, with no tags.
Its reachable history consists of the two original commits. GitHub reports no releases.
No credential-pattern or sensitive-file-name matches were found across 236 reachable
historical blobs (including the source implementation commit) or the candidate source. See [scan inventory](evidence/publication-scan.json).
The scan is evidence from patterns and review, not proof against every secret format.
The separate hosted Actions-artifact listing could not be retrieved with available
connector capabilities; no artifact was published by this task.

Current setup examples are portable and the credential-configuration narrative is
generalized. Normal history is retained. Older commits still contain machine-specific
setup paths and a credential-configuration narrative without any credential value.
Commit author name/email also remain. Those disclosures must be included in the
exact public-release approval; no destructive rewrite or key rotation was performed.
Only the task branch is intended for push; local Codex checkpoint refs are excluded.

Root LICENSE is MIT, copyright 2026 Ilja Davidovs. THIRD_PARTY_NOTICES.md preserves
EssenceKit's exact original MIT notice, copyright 2025 essencekit, for the copied Core
and derived assets. Dependencies retain their package licenses and are not vendored.
The source export is far below 50 MB; the final committed archive size will be
checked by the verifier. Known security/correctness findings remain explicitly listed
in [KNOWN_LIMITATIONS.md](../../KNOWN_LIMITATIONS.md).

## Required remaining release steps

1. Commit this separate evidence record through the installed workflow.
2. Run `scripts/verify-linux.sh` against the actual final commit and record its SHA,
   archive size, exits, and scan results on the canonical PCR PR/execution report.
3. Push only the task branch and open a PR against main, preserving ordinary history.
4. Present that exact revision, PR, evidence, known defects, and historical disclosures
   to the owner for public-release approval.
5. After approval, merge/release only PCR, change only PCR's visibility, and verify
   README, LICENSE, notices, source, history, and released SHA without authentication.

The installed push workflow was invoked after the source commit and returned
`local_only`: PCR is outside its separate push allowlist. Local GitHub CLI is
unauthenticated; the GitHub connector and SSH remote access work. Personal hook
configuration was not changed. The owner must authorize a narrow alternate
publication route or arrange the required allowlist/authentication setup before
branch publication. No direct-push workaround was attempted.
