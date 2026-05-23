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
  "intelligenceEnabled": true,
  "intelligenceProvider": "openai",
  "intelligenceModel": "gpt-5.5"
}
```

The tool returns:

- `prompt`
- `contextPack`
- `metadata`
- `warnings`
- `skipped`
- `skipReason`
