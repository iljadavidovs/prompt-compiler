# MCP Usage

Build the MCP app:

```bash
pnpm build
```

Run the stdio MCP server:

```bash
pnpm --silent pcr-mcp
```

Tools:

- `pcr_compile`
- `pcr_context_search`
- `pcr_add_feedback`
- `pcr_list_templates`
- `pcr_list_profiles`
- `pcr_get_history`

Example `pcr_compile` input:

```json
{
  "rawText": "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress",
  "mode": "research",
  "maxContextTokens": 3000,
  "intelligenceEnabled": false,
  "intelligenceProvider": "none"
}
```

The tool returns:

- `prompt`
- `contextPack`
- `metadata`
- `warnings`
- `skipped`
- `skipReason`

Initialize default context/configuration with `pcr init` before starting the server.
The standalone stdio process requires Node and built workspace dependencies, not a
Codex installation. Optional provider use and known safety limitations are described
in [INTELLIGENCE.md](INTELLIGENCE.md) and [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).
