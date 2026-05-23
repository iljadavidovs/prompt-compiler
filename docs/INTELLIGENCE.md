# PCR Intelligence Layer

PCR V0 remains deterministic by default. Sprint 11 adds an optional intelligence classifier for vague user input.

The classifier does not write the final prompt. It sees only enabled PCR tool metadata and returns structured planning data:

```json
{
  "mode": "research",
  "intent": "progress-assessment",
  "confidence": 0.86,
  "taskRewrite": "Assess current progress against goals, near schedule, constraints, risks, and execution quality.",
  "contextQueries": ["current goals", "near schedule", "progress risks"],
  "contextNeeds": ["goal", "schedule", "preference", "history"],
  "adapter": "research_prompt_compile",
  "complexity": "medium",
  "shouldAskClarifyingQuestion": false,
  "clarifyingQuestions": [],
  "constraints": [],
  "warnings": []
}
```

PCR then continues with deterministic retrieval, ContextPack construction, PromptIR construction, rendering, and history storage.

If no enabled tool applies, the classifier/router returns skip and PCR does not compile a prompt.

## Continuity Window

Before classification, PCR reads a compact local history window from SQLite. This is only for continuity, such as resolving "it", "this", "same plan", or "original prompt".

The classifier receives recent user requests plus minimal metadata:

```json
{
  "role": "user",
  "text": "Let's plan next month so I can launch essencekit and prompt compiler.",
  "selectedToolId": "planner",
  "intent": "planning",
  "mode": "analysis",
  "skipped": false
}
```

PCR does not include generated prompts, Context Packs, PromptIR, or assistant responses in this classifier history window.

Configure it in `~/.pcr/config.yaml`:

```yaml
intelligence:
  historyWindow:
    enabled: true
    turns: 10
    includeSkipped: true
    providerVisible: true
```

Set `providerVisible: false` to prevent sending the history window to remote classifier providers.

## Default Behavior

Intelligence is disabled unless explicitly enabled.

Without intelligence, PCR uses deterministic keyword classification against enabled tools.

If no tools are enabled in `~/.pcr/config.yaml`, PCR skips.

## Enable With Environment

```bash
export PCR_INTELLIGENCE_ENABLED=1
export PCR_INTELLIGENCE_PROVIDER=openai
export PCR_OPENAI_API_KEY=...
export PCR_OPENAI_MODEL=gpt-5.5
export PCR_OPENAI_REASONING_EFFORT=none
```

Or create a local ignored env file:

```bash
cp .env.example .env.local
```

Then fill `PCR_OPENAI_API_KEY` in `.env.local`.

`.env.local` is ignored by git and loaded automatically by PCR CLI/MCP when present.

Then run:

```bash
pnpm --silent pcr compile "help me figure out where I stand this week"
```

## Enable Per CLI Call

```bash
pnpm --silent pcr compile "help me figure out where I stand this week" \
  --intelligence \
  --intelligence-provider openai \
  --intelligence-model gpt-5.5
```

## MCP Input

```json
{
  "rawText": "help me figure out where I stand this week",
  "intelligenceEnabled": true,
  "intelligenceProvider": "openai",
  "intelligenceModel": "gpt-5.5"
}
```

## Fallback

If OpenAI is enabled but no API key is configured, PCR falls back to deterministic classification and records a warning in metadata.

## Why Structured Classification

PCR uses the LLM only for interpretation:

- mode
- intent
- task rewrite
- context needs
- context queries
- adapter choice
- constraints

The final prompt is still rendered by PCR from PromptIR and templates. This preserves traceability and keeps local deterministic behavior available.
