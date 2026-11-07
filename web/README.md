# Prompt Compiler Website

Static landing page for Prompt Compiler, built under `web/` with EssenceKit conventions.

## Build

```sh
cd web
npm ci
npm run build
```

The generated site is written to:

```text
web/Pub/dev/index.html
```

Preview it from the generated `Pub` root:

```sh
cd web
npm run preview
```

Then open:

```text
http://localhost:4173/dev/
```

## Structure

```text
src/App/
  config.json
  Components/
    index.html
    config.json
    BasePage/
    Layout/
    Hero/
    Problem/
    ContextStack/
    CompilePipeline/
    DeveloperWorkflow/
    RegularUserWorkflow/
    LocalFirst/
    ComponentLibraryVision/
    EssenceKitRoadmap/
    Footer/
  Rules/
  PostProcess/
  assets/

src/Core/
  EssenceKit core copied from essencekit/essencekit
```

## Why `src/Core` Is Copied

The current EssenceKit CLI package is not published to npm and the GitHub package assumes a project has both `src/App` and `src/Core` in the current working directory. When the CLI is installed as a dependency, it still resolves `src/Core` from the app root.

Because of that coupling, this site keeps a local copy of EssenceKit `src/Core`. That is the smallest practical workaround without rewriting the framework.

One local Core line was changed: `src/Core/Compiler/Renderer.js` writes output to `web/Pub` instead of `web/src/Pub`, matching the requested project shape.

The dependency is pinned to EssenceKit revision
`7fff4985cc5070547e97e41782ed50655c7e6a49` through a public HTTPS archive.
No SSH key or GitHub account is needed. Use Node 22 (see root `.node-version`).
Generated `Pub` output is rebuilt locally and excluded from source exports.
The copied Core and generated assets retain the original MIT notice in
[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

## Editing

- Edit page composition in `src/App/Components/index.html`.
- Edit individual sections in `src/App/Components/*/index.html`.
- Edit global styling in `src/App/assets/styles/site.css`.
- Edit build rules in `src/App/Rules/siteRules.js`.
- Edit postprocessing in `src/App/PostProcess/cleanHtml.js`.

Keep the site static-first: no React, Next.js, Vue, Tailwind, Astro, or client-side routing.
