# Prompt Compiler Website Spec

## Purpose

Create a fast, static-first one-page website for Prompt Compiler / PCR using EssenceKit conventions.

Primary message:

> Compile intent into context-aware prompts.

Supporting thesis:

> LLMs answer. Prompt Compiler prepares the question properly.

## Product Positioning

Prompt Compiler is a local-first context compiler for LLM prompts. It turns rough human intent into high-quality prompts by compiling user preferences, goals, schedule, project context, prompt history, positive examples, negative examples, templates, and output requirements.

## Implemented Page Sections

1. Hero
2. V0 spec teaser inside the hero
3. Problem
4. What PCR compiles
5. Architecture pipeline
6. Developer workflow
7. Regular user workflow
8. Local-first / privacy
9. Component library vision
10. EssenceKit roadmap teaser
11. Footer

## EssenceKit Structure

The renderable page is `src/App/Components/index.html` with metadata in `src/App/Components/config.json`.

The root component extends `Layout`, and `Layout` extends `BasePage`:

```text
Components/index.html
  -> extends Layout
  -> Layout extends BasePage
```

The section components are included through EssenceKit component calls:

```html
@{Hero}
@{Problem}
@{ContextStack}
@{CompilePipeline}
@{DeveloperWorkflow}
@{RegularUserWorkflow}
@{LocalFirst}
@{ComponentLibraryVision}
@{EssenceKitRoadmap}
@{Footer}
```

## Build Output

EssenceKit writes generated files to:

```text
Pub/dev/
```

This app uses a root `Components/index.html` component so the homepage renders to:

```text
Pub/dev/index.html
```

## Design Direction

- Dark-first, monochrome-first interface
- Restrained green, cyan, and amber accents
- Compiler pipeline and terminal motifs
- No stock photography
- No framework-heavy client runtime
- No generic SaaS hero composition

## Local Links

All navigation and CTA links resolve to in-page anchors:

- `#v0-spec`
- `#problem`
- `#architecture`
- `#local-first`
- `#component-library`
- `#essencekit-roadmap`

The compile-time rules validate that these local anchors exist.

## Static-First Choices

- CSS is a copied App asset: `src/App/assets/styles/site.css`
- JavaScript is limited to smooth hash navigation: `src/App/assets/scripts/site.js`
- No external UI framework
- No React, Next.js, Vue, Tailwind, or Astro
- No remote images, fonts, analytics, or CDN runtime

## EssenceKit Workaround

The current EssenceKit CLI resolves `src/Core` from the project working directory. Dependency-only usage is not enough, so this website includes a local copy of EssenceKit Core under:

```text
src/Core/
```

This is intentionally documented as framework coupling, not a desired long-term pattern.

One local Core line was changed in `src/Core/Compiler/Renderer.js`: `pubDir` points to `../../../Pub/` so the build output lands in `web/Pub` rather than `web/src/Pub`.
