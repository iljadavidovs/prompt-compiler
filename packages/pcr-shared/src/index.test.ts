import { describe, expect, it } from "vitest";
import { CompilePromptInputSchema, estimateTokens, PCR_COMPILER_VERSION } from "./index.js";

describe("pcr-shared", () => {
  it("exports a compiler version", () => {
    expect(PCR_COMPILER_VERSION).toBe("0.1.0");
  });

  it("validates compile inputs", () => {
    const parsed = CompilePromptInputSchema.parse({
      source: "cli",
      rawText: "compile a prompt",
    });

    expect(parsed.source).toBe("cli");
  });

  it("estimates tokens deterministically", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
