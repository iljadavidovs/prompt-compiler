# PCR V0 Acceptance Criteria

1. `pnpm install` works.
2. `pnpm build` works.
3. `pnpm test` works.
4. `pcr init` creates default `~/.pcr` files.
5. `pcr context index` indexes local context files.
6. `pcr context search "goals schedule progress"` returns relevant chunks.
7. `pcr compile "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress"` returns a context-aware research prompt.
8. `pcr feedback` can attach a like/dislike/comment to a compilation.
9. Future compilation can retrieve positive/negative prompt examples from history.
10. `pcr serve` exposes the HTTP API.
11. `pcr-mcp` exposes `pcr_compile` and `pcr_context_search`.
12. V0 works without any external LLM provider.
13. No Chrome extension is implemented.
14. No OAuth integrations are implemented.
15. Documentation explains how future providers, embeddings, and browser extension would fit.

