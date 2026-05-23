import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    env: {
      PCR_SKIP_ENV_FILE: "1",
    },
  },
  resolve: {
    alias: {
      "@pcr/shared": `${root}packages/pcr-shared/src/index.ts`,
      "@pcr/store": `${root}packages/pcr-store/src/index.ts`,
      "@pcr/context": `${root}packages/pcr-context/src/index.ts`,
      "@pcr/retrieval": `${root}packages/pcr-retrieval/src/index.ts`,
      "@pcr/intelligence": `${root}packages/pcr-intelligence/src/index.ts`,
      "@pcr/tool-grammar": `${root}packages/pcr-tool-grammar/src/index.ts`,
      "@pcr/tool-planner": `${root}packages/pcr-tool-planner/src/index.ts`,
      "@pcr/tool-coding": `${root}packages/pcr-tool-coding/src/index.ts`,
      "@pcr/tool-progress-assessment": `${root}packages/pcr-tool-progress-assessment/src/index.ts`,
      "@pcr/dashboard": `${root}packages/dashboard/src/index.ts`,
      "@pcr/core": `${root}packages/pcr-core/src/index.ts`,
      "@pcr/pcrd": `${root}apps/pcrd/src/index.ts`,
      "@pcr/mcp": `${root}apps/pcr-mcp/src/index.ts`
    },
  },
});
