# EssenceKit Rules and Postprocess Roadmap

## Thesis

AI-generated websites need two compile-time systems:

- **Rules** to prevent broken or low-quality output.
- **Postprocess** to turn valid output into production-grade static files.

Rules are validators. Postprocessors are transformations.

Without rules, AI can produce visually plausible but structurally weak pages. Without postprocess, even valid pages remain unfinished artifacts.

## Rules

Rules should run during compilation and return structured diagnostics.

Current EssenceKit rules are useful as a proof of concept: a rule module can inspect rendered HTML and component metadata, then return an error. That model should become stricter and more expressive.

Future rule output should include:

- Rule id
- Severity
- Message
- Component name
- File path
- Line or selector when available
- Documentation link
- Suggested fix
- Whether the rule blocks production builds

## Future Rule Examples

- Require exactly one `h1`.
- Require heading order without skipped levels.
- Disallow empty links.
- Disallow missing `alt` text on meaningful images.
- Enforce max DOM depth.
- Check color contrast.
- Block inline secrets and obvious API keys.
- Reject broken component props.
- Reject duplicate component IDs.
- Reject invalid component schema.
- Reject missing required slots.
- Reject incompatible component combinations.
- Detect huge unoptimized images.
- Detect broken local anchors.
- Detect empty sections.
- Detect buttons without accessible labels.
- Detect forms without labels.
- Detect pages without meta description.
- Detect repeated generic marketing phrases if a project enables content-quality rules.

## Rule Categories

Recommended categories:

- `a11y`
- `seo`
- `performance`
- `content`
- `design`
- `security`
- `component-schema`
- `routing`
- `links`
- `assets`

## Strict Production Mode

Development mode can warn.

Production mode should fail on blocking diagnostics:

```text
error: a11y.image-alt
component: Hero
message: Meaningful image missing alt text.
fix: Add alt text or mark decorative images explicitly.
```

Rules should be configurable by project:

```json
{
  "rules": {
    "strict": true,
    "enabled": [
      "a11y.*",
      "seo.*",
      "links.local",
      "performance.image-size"
    ],
    "disabled": [
      "content.marketing-cliche"
    ]
  }
}
```

## Postprocess

Postprocess should run after rendering and successful validation.

Current EssenceKit postprocess is a simple sequential HTML transform. That is a good base. It should grow into a compile-time production pipeline.

## Future Postprocessors

- Minify HTML.
- Minify CSS.
- Minify JS.
- Generate sitemap.
- Inject Open Graph tags.
- Inject Twitter/social card metadata.
- Generate component usage manifest.
- Generate build quality report.
- Optimize images.
- Extract critical CSS.
- Bundle local assets.
- Add cache-busting hashes.
- Generate web app manifest.
- Rewrite asset URLs.
- Inline tiny assets when appropriate.
- Emit route manifest.
- Emit search index for docs-like sites.

## Postprocess Manifest

Each postprocessor should declare:

- Id
- Description
- Inputs
- Outputs
- Whether it mutates HTML
- Whether it writes files
- Dependencies
- Order constraints
- Production-only status

Example:

```json
{
  "id": "assets.cache-hash",
  "description": "Adds content hashes to static asset filenames and rewrites references.",
  "inputs": ["html", "assets"],
  "outputs": ["html", "assets-manifest"],
  "writesFiles": true,
  "after": ["css.minify", "js.minify"]
}
```

## AI Build Loop

Rules and postprocess enable an AI build loop:

1. AI chooses components.
2. AI fills props.
3. EssenceKit renders static HTML.
4. Rules validate structure, accessibility, SEO, performance, and component contracts.
5. AI fixes rule failures.
6. Postprocess optimizes output.
7. Build report explains what changed.
8. User approves or regenerates specific sections.

## Why This Matters

AI can generate a page quickly. That is not enough.

A useful website generator needs a compiler-like feedback loop. It must reject invalid output, report why, and produce optimized files without relying on a human to catch every broken link, inaccessible control, missing meta tag, contrast failure, or oversized asset.

Rules prevent bad output.

Postprocess finishes good output.

Together they turn AI page generation from text completion into a build system.
