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

Compile example:

```bash
curl -s http://127.0.0.1:4317/v1/compile \
  -H 'content-type: application/json' \
  -d '{"rawText":"according to my current goals and nearest schedule, compile a research prompt for assessment of my progress"}'
```

Current boundaries:

- loopback binding only
- restrictive localhost CORS
- no raw context logging
- text-column redaction does not cover all structured history

The API has no authentication or Host validation; CORS does not prevent writes.
Settings can expose configured keys, and dashboard history has an HTML injection
defect. Read [known limitations](KNOWN_LIMITATIONS.md) before starting it.

