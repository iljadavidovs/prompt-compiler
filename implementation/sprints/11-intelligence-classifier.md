# Sprint 11: Optional Intelligence Classifier

## Goal

Add an optional multi-pass intelligence layer that can use a small LLM to classify vague user intent, select mode/adapter/context needs, and rewrite task intent before deterministic context retrieval and rendering.

## Thesis

PCR should not become a black-box prompt generator. The LLM should classify and normalize intent into structured data. PCR should still own retrieval, context budgeting, PromptIR construction, rendering, history, and fallback behavior.

## Pipeline

```text
raw user input
-> optional LLM classifier
-> deterministic policy/router
-> retrieval/context planning
-> deterministic ContextPack construction
-> PromptIR construction
-> deterministic rendering
-> history/feedback storage
```

## Requirements

- Default remains local-first and deterministic.
- LLM classifier is disabled by default.
- OpenAI provider may be enabled through env/options.
- Missing API key must fall back to deterministic classifier.
- Classifier must return structured JSON.
- Classifier must not generate the final prompt.
- Compiler trace must indicate whether intelligence was used or skipped.
- Tests must not call the network.

## Initial Config Surface

Environment variables:

```text
PCR_INTELLIGENCE_ENABLED=1
PCR_INTELLIGENCE_PROVIDER=openai
PCR_OPENAI_API_KEY=...
PCR_OPENAI_MODEL=gpt-4.1-nano
```

Compile options may override:

```ts
options: {
  intelligence: {
    enabled: true,
    provider: "openai",
    model: "gpt-4.1-nano"
  }
}
```

## Completion Note Target

Append a short note to `implementation/progress.md`.

