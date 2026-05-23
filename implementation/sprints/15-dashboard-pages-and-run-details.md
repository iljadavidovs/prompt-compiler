# Sprint 15: Dashboard Pages, Run Details, And Grammar Input Policy

## Goal

Make the dashboard usable for inspecting historical output and reduce prompt duplication for grammar-style tools.

## Scope

- Split the EssenceKit dashboard into three served pages:
  - `/dashboard/history/`
  - `/dashboard/tools/`
  - `/dashboard/settings/`
- Keep `/dashboard/` as a redirect or entry to History.
- Add historical run detail popup from History.
- Detail popup must show:
  - raw user input
  - generated prompt
  - metadata
  - context pack
  - PromptIR
- Add a tool input policy so tools can choose whether the compiled task repeats the original request.
- Set grammar to avoid repeating the raw original request because Codex already has the user prompt.
- Make hook context explicitly tell Codex to treat the original user prompt as the source text for grammar edits.

## Acceptance

- Dashboard pages build with EssenceKit.
- History rows open a detail popup with generated prompt and metadata.
- Tools and Settings pages still save through `pcrd`.
- Grammar compiled prompt does not include the raw original request block.
- Hook context remains higher-priority developer context and tells Codex not to call PCR again.
- `pnpm build`, `pnpm test`, and `pnpm lint` pass.
