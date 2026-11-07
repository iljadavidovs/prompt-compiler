# TypeScript API

Core API:

```ts
import { compilePrompt } from "@pcr/core";

const output = await compilePrompt({
  source: "cli",
  rawText: "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress",
  mode: "research",
  options: {
    includeTrace: true,
    maxContextTokens: 3000,
  },
});

console.log(output.prompt);
```

`compilePrompt()` validates input, selects an enabled tool and its template/profile, indexes local context, retrieves matching context/history, builds a ContextPack and PromptIR, renders the prompt, stores history in SQLite, and returns the full output. Without an applicable enabled tool it returns a structured skip. Initialize configuration with `pcr init` first.

The default path makes no external LLM call. Optional intelligence and grammar rewriting can call OpenAI. See [known limitations](KNOWN_LIMITATIONS.md) for provider-control and rendering limitations; the deterministic flag alone is not a network boundary.

