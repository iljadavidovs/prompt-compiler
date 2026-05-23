# EssenceKit Component Library Roadmap

## Core Idea: AI Lego

EssenceKit can become an "AI Lego" system for static websites.

The goal is not just reusable HTML snippets. The goal is a library of known-good components that AI can query, understand, assemble, validate, and refine without inventing every page from scratch.

Every component should be a reusable block with:

- HTML template
- CSS
- JS behavior
- Config schema
- Props schema
- Slots
- Variants
- Metadata
- Tags
- Usage examples
- Accessibility notes
- Design constraints
- Screenshot or preview
- Compatibility info

## Component Manifest

Each component should include a `component.json` manifest.

Example:

```json
{
  "id": "hero.compiler-terminal",
  "name": "Compiler Terminal Hero",
  "category": "hero",
  "description": "Minimal hero section with terminal prompt preview.",
  "tags": ["hero", "terminal", "developer-tool", "ai", "dark"],
  "props": {
    "title": { "type": "string", "required": true },
    "subtitle": { "type": "string", "required": true },
    "command": { "type": "string", "required": false }
  },
  "variants": ["dark", "light", "compact"],
  "slots": ["actions", "aside"],
  "rules": ["a11y.heading-order", "seo.hero-title"],
  "postProcess": ["critical-css"],
  "ai": {
    "useWhen": [
      "landing page for developer tool",
      "product with CLI workflow",
      "technical homepage"
    ],
    "avoidWhen": [
      "non-technical audience",
      "image-heavy consumer brand"
    ]
  }
}
```

## AI Query Flow

An AI agent should be able to ask:

> Find a dark minimal hero for a developer tool with terminal interaction.

The registry should return compatible candidates, ranked by:

- Category match
- Semantic tag match
- Audience fit
- Variant fit
- Required props
- Slot compatibility
- Theme compatibility
- Accessibility status
- Screenshot availability

Then the AI can assemble:

- Hero
- Problem
- Feature grid
- Pipeline
- CTA
- Footer

## Registry Format

A local registry can be generated from component manifests:

```text
components/
  hero/
    compiler-terminal/
      index.html
      styles.css
      component.json
      preview.png
  pipeline/
    compiler-flow/
      index.html
      styles.css
      component.json
      preview.png
registry/
  components.index.json
  components.search.json
```

The registry should be static, versionable, and available offline.

## Component Metadata Fields

Recommended fields:

- `id`: stable component identifier
- `name`: human-readable name
- `category`: primary component type
- `description`: short purpose statement
- `tags`: search and retrieval tags
- `props`: JSON-compatible prop schema
- `slots`: named insertion points
- `variants`: supported visual or structural variants
- `dependencies`: CSS, JS, assets, postprocessors, rules
- `a11y`: heading expectations, landmark role, keyboard notes, alt requirements
- `design`: density, palette constraints, image requirements, typography constraints
- `compatibility`: allowed parents, allowed children, incompatible components
- `examples`: sample props and rendered usage
- `ai`: use cases, avoid cases, prompt hints, quality constraints
- `preview`: screenshot or rendered preview path

## Assembly Contract

AI page generation should become a deterministic compile flow:

1. User describes page intent.
2. AI queries component registry.
3. AI selects compatible components.
4. AI fills props and slots.
5. EssenceKit renders the page.
6. Rules validate output.
7. Postprocessors optimize output.
8. Build report explains decisions and unresolved risks.

## Why EssenceKit Fits

EssenceKit already has:

- Folder-based components
- Static output
- Config files
- Rules
- Postprocess
- Plain HTML/CSS/JS

Those are the right primitives. The missing piece is not a heavier runtime. The missing piece is a metadata and validation layer around the primitives.

## Milestones

### Milestone 1: Manifest Standard

Define `component.json`, validate it, and generate a registry file.

### Milestone 2: Preview System

Render each component in isolation and save screenshots for AI and human review.

### Milestone 3: Search Index

Generate a semantic and keyword index from category, tags, description, examples, and AI usage notes.

### Milestone 4: Compatibility Engine

Check parent-child compatibility, required slots, duplicate IDs, missing props, theme conflicts, and dependency conflicts.

### Milestone 5: AI Assembly API

Expose a local API:

```text
findComponents(query)
getComponent(id)
validateAssembly(pagePlan)
renderAssembly(pagePlan)
```

### Milestone 6: Section-Level Regeneration

Allow users to regenerate one section at a time while preserving the rest of the page.

## Success Criteria

EssenceKit becomes a serious AI website foundation when an AI can:

- Find components without scanning the whole filesystem.
- Know which component fits which use case.
- Fill valid props.
- Avoid incompatible blocks.
- Render and validate a page.
- Explain what it assembled.
- Regenerate a section without damaging the rest of the site.
