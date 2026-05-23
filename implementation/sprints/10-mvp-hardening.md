# Sprint 10: MVP Hardening And Codex Desktop Integration

## Goal

Turn the working V0 into a smoother daily-use MVP by improving setup, integration confidence, and user-facing ergonomics without expanding scope into cloud/provider work.

## Recommended Tasks

- Add filesystem-backed template/profile listing, not only built-in template/profile listing.
- Implement full `config.yaml` resolution for default profile/template/context paths.
- Add deterministic golden-file tests for the progress-assessment prompt.
- Add an MCP stdio client/server integration test, not only direct handler tests.
- Add a small setup script or command that prints/installs the Codex Desktop MCP config snippet. Done in V0 follow-up as `pcr codex install`; next work should harden it across platforms and packaging modes.
- Add clearer errors when SQLite FTS5 is unavailable or context files are missing.
- Add richer `pcr history` filters by mode, rating, date, and text query.
- Add `pcr doctor` to check Node, pnpm, build artifacts, SQLite database, context files, and MCP readiness.
- Add local template/profile examples for coding, analysis, and reply modes.
- Improve docs for regular non-developer setup after packaging decisions are made.

## Non-Goals

- No hosted service.
- No OAuth.
- No Chrome extension implementation.
- No external LLM provider requirement.
- No embeddings requirement.
