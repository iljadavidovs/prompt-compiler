# Future Extensions

## Providers

PCR now has an optional intelligence provider interface for classification. Future provider support should expand this into local models and additional APIs while keeping provider calls disabled by default and unnecessary for deterministic compilation.

## Embeddings And Vector Search

V0 uses SQLite FTS5. Future embedding support should be added behind the retrieval interfaces in `pcr-retrieval` without changing `compilePrompt()` inputs or ContextPack shape. FTS5 should remain available as the deterministic fallback.

## Browser Extension

V0 intentionally does not include a Chrome extension. A future extension can call the local HTTP daemon on `127.0.0.1:4317`, pass selection/context blocks into `/v1/compile`, and use the restrictive CORS allowlist as the security boundary.

## OAuth, Hosted Sync, And Teams

V0 intentionally excludes OAuth, hosted services, billing, marketplace, auth, and team workflows. Those should be separate products or later layers, not dependencies of local prompt compilation.
