# HTTP API

Start the local daemon:

```bash
pcr serve
```

The daemon binds to `127.0.0.1:4317` by default.

Routes:

```text
GET  /health
POST /v1/compile
POST /v1/context/index
GET  /v1/context/search?q=
GET  /v1/history
GET  /v1/history/:id
POST /v1/history/:id/feedback
GET  /v1/templates
GET  /v1/profiles
GET  /v1/settings
POST /v1/settings
GET  /v1/tools
POST /v1/tools/:id
```

Legacy compile contract example (generic daemon; supply the ephemeral token from
your embedded server/session):

```bash
curl -s http://127.0.0.1:4317/v1/compile \
  -H 'x-pcr-token: EPHEMERAL_TOKEN' \
  -H 'content-type: application/json' \
  -d '{"rawText":"according to my current goals and nearest schedule, compile a research prompt for assessment of my progress"}'
```

Current boundaries:

- loopback binding only
- same-origin/authority validation and an ephemeral local API session
- no raw context logging
- recursive credential-shaped redaction in ordinary JSON responses and new history;
  heuristic protection only, with no rewrite of existing database bytes

The published 0.1.0 release lacked authentication/Host validation and had settings
and dashboard disclosure defects. This branch protects the routes described below;
broader generic project/provider and gateway limits remain in
[known limitations](KNOWN_LIMITATIONS.md).

## Local session and Playground contract

This task branch requires `x-pcr-token` for `/v1/*` APIs. Browser clients obtain an
in-memory, per-process token from `/v1/session` using a same-origin fetch with
`x-pcr-bootstrap: 1`; arbitrary Host/Origin authorities and cross-site requests are
rejected. Programmatic embedded callers receive `StartedServer.apiToken` directly
from `startServer()`. Do not put this token in URLs, browser storage, library data or
logs. Unauthenticated API clients must adopt this header on this branch.

The authoring client uses `POST /v1/playground/compile` with:

```json
{
  "requestId": "synthetic-stable-invocation",
  "projectId": "WORKSPACE_ID_FROM_V1_WORKSPACE",
  "rawText": "Debug a synthetic save conflict",
  "maxContextTokens": 6000,
  "skip": false,
  "bindings": []
}
```

Bindings use `{id, revision, contentHash, role, enabled}`. Sources are resolved from
that workspace's local library; missing/changed/archived entries fail. No path,
provider, template/profile/variable override or executable configuration is exposed
by this UI contract. The dedicated launcher also applies this contract to
`/v1/compile` and blocks implicit context indexing/search and cwd overrides. The
generic daemon retains the legacy `/v1/compile` contract for other clients.

`GET /v1/workspace` reports workspace identity, active/removed library entries,
saved drafts, actual paths and unavailable capabilities. `POST /v1/drafts` accepts
`{draft, expectedRevision}`; `POST /v1/library` accepts `{item, expectedRevision}`.
Conflicting saves return 409. Removal sets `archived: true` with the observed revision;
restoration is another revision-checked update.

`GET /v1/library/export` and `POST /v1/library/import` exchange version-1
`pcr-library` envelopes. Imports validate text, IDs, hashes, versions and resolved
source references; the whole import fails on conflicts. `GET
/v1/history/:id/feedback` reads separate feedback events. The existing feedback POST
now validates rating and record fields. These are local storage actions, never
release or execution commands.

Compilation responses reuse `CompilePromptOutput`. Metadata includes the effective
context/effect policy and budget, exact provenance and included/omitted sources;
history retains the trace. Repeated concurrent or retried invocations with the same
request ID and input fingerprint return the existing compilation, including after
server restart. Reusing an ID for different input returns 409.

See [the architecture contract](PLAYGROUND_ARCHITECTURE.md) for exchange ownership,
redaction limits and the deliberately synthetic external-host proof.
