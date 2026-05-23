# PCR V0 Goal

Prompt Compiler V0, also called PCR, is a local-first prompt and context compiler.

PCR converts rough human intent into a structured prompt by resolving:

- explicit request text
- user and project settings
- user profiles and style preferences
- local knowledge files
- goals and schedule files
- prompt history
- later feedback

PCR V0 is not a generic prompt template manager. It is the first working version of a local context-aware compiler where prompt quality is produced from intent, context, preferences, and history instead of manually repeated setup.

## Primary V0 Scenario

Input:

```text
$pcr according to my current goals and nearest schedule, compile a research prompt for assessment of my progress
```

Expected result:

1. Detect research/progress-assessment intent.
2. Load profile and style preferences.
3. Search local goals context.
4. Search local schedule context.
5. Search successful and unsuccessful prompt history.
6. Build a compact ContextPack.
7. Compile a structured research prompt.
8. Store compilation in local history.
9. Allow feedback to be attached later.

## Boundaries

PCR V0 must:

- work locally by default
- be deterministic by default
- require no external LLM provider
- require no cloud account
- use SQLite FTS5, not embeddings or vector databases
- expose TypeScript API, CLI, local HTTP daemon, and MCP stdio server

PCR V0 must not include:

- Chrome extension work
- OAuth integrations
- hosted service
- auth, billing, marketplace, or team features

