# Multi-platform manifest pinned with the Node release used for verification.
FROM node:22.23.4-bookworm@sha256:7702d8aa4d5910871692af4480eb3ba86f23047a6417a44d857d06c95d060d3f
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /work
ENV PCR_SKIP_ENV_FILE=1 PCR_INTELLIGENCE_ENABLED=0 PCR_INTELLIGENCE_PROVIDER=none
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build && pnpm typecheck && pnpm lint && pnpm test
RUN pnpm --filter @pcr/dashboard build:prod
RUN cd web && npm ci --no-audit --no-fund && npm run build && npm run build:prod
CMD ["node", "scripts/smoke.mjs"]
