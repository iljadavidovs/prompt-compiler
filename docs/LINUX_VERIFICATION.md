# Linux verification

Run `./scripts/verify-linux.sh <commit-or-branch>` with Docker running. Only the
chosen committed source is included. The host needs Bash, Git, Docker, and ordinary
POSIX utilities. Set `DOCKER_CONTEXT` to choose another Docker daemon.

The pinned multi-platform image is
`node:22.23.4-bookworm@sha256:7702d8aa4d5910871692af4480eb3ba86f23047a6417a44d857d06c95d060d3f`.
It supplies Debian 12/glibc, Node 22.23.4, npm 10.9.9, Python 3, make, Git, and a C++
compiler. Corepack bootstraps pnpm 9.15.4 during the network-enabled build.

The executable stages in `scripts/linux/Dockerfile` are:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @pcr/dashboard build:prod
cd web
npm ci --no-audit --no-fund
npm run build
npm run build:prod
```

The image's default command is `node scripts/smoke.mjs`. The verifier runs it with
`docker run --rm --network none`. The smoke clears inherited environment variables,
retaining executable lookup and its own temporary paths/settings:

```text
HOME=<temporary>/home
PCR_USER_DIR=<temporary>/user
PCR_DB_PATH=<temporary>/user/pcr.sqlite
PCR_SKIP_ENV_FILE=1
PCR_INTELLIGENCE_ENABLED=0
PCR_INTELLIGENCE_PROVIDER=none
```

It initializes defaults twice, indexes/searches them, compiles the README example
with JSON and trace, checks stable output and skip behavior, persists history/feedback,
and checks SQLite migration, integrity, foreign keys, and a real FTS5 query. A test-owned
loopback server on an ephemeral port exercises compilation, retrieval, history/feedback,
metadata routes, and dashboard HTML/JS/CSS delivery. The real MCP stdio process is
initialized; all six tools are listed and invoked; stdin closure must produce exit 0
and no stderr. Temporary state is deleted on exit.

No host directories, Docker socket, SSH agent, credentials, personal context, or
Codex installation are passed to the build/run container. Native binaries are installed
fresh for Linux. Build output is generated during verification; `Pub`, `dist`,
dependencies, SQLite, and caches are excluded from source exports.

Empty-store offline installation is a separate dependency check. It is expected to
fail without downloads. Corepack's first bootstrap also needs network unless cached.
The dated release record distinguishes these checks from offline runtime execution.
Read [known limitations](KNOWN_LIMITATIONS.md) for properties not established here.
