# Sprint 16: Grammar Rewrite Adapter

## Goal

Change grammar from an answer-producing editing prompt into a behind-the-scenes rewrite adapter for Codex hook mode.

## Problem

The previous grammar tool asked Codex to return corrected text. That made prompts like `grammar fix: ...?` answer with an edited sentence instead of answering the corrected question.

## Scope

- Use the OpenAI API to rewrite grammar prompts when intelligence is enabled.
- Remove the grammar trigger from the effective prompt.
- Inject the corrected prompt as higher-priority developer context.
- Tell Codex to answer the corrected prompt directly.
- Keep deterministic fallback when OpenAI is disabled or unavailable.

## Acceptance

- `grammar fix: ...` compiles to `Corrected User Prompt (Higher Priority)`.
- The compiled prompt does not include the grammar-fix wrapper.
- Hook output includes the corrected prompt and direct-answer instruction.
- The assistant should answer the corrected prompt, not return grammar notes.
- `pnpm build`, `pnpm test`, and `pnpm lint` pass.
