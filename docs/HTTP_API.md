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
```

Compile example:

```bash
curl -s http://127.0.0.1:4317/v1/compile \
  -H 'content-type: application/json' \
  -d '{"rawText":"according to my current goals and nearest schedule, compile a research prompt for assessment of my progress"}'
```

Security defaults:

- loopback binding only
- restrictive localhost CORS
- no raw context logging
- obvious secrets redacted before history storage

