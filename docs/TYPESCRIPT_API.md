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

`compilePrompt()` validates input, resolves profile and template, indexes local context files, retrieves matching context/history, builds a ContextPack, builds PromptIR, renders the prompt, estimates tokens, stores history in SQLite, and returns the full output.

V0 performs no external LLM call.

