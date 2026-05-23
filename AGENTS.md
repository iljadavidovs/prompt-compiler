# PCR Engineering Philosophy

PCR is a local-first prompt compiler, not a prompt template pile and not a hidden chatbot.

Keep the system modular:

- Tools are plug-and-play packages.
- The classifier only chooses whether and how a tool applies.
- Deterministic code owns context loading, retrieval, PromptIR construction, rendering, history, and feedback.
- Optional LLM calls must be structured, traceable, and skippable.

Keep the code lean:

- Prefer small modules with one reason to change.
- Do not add helpers unless they remove real duplication or clarify ownership.
- Do not add broad abstractions before there are at least two concrete users.
- Keep defaults explicit in setup, not hidden in global fallbacks.
- If no enabled tool applies, PCR should skip and let the original user request proceed.

Default posture:

- Local-first.
- Deterministic fallback.
- External provider calls optional.
- Tool packages easy to add, remove, or disable.

