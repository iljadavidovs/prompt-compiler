import type { IntelligenceOptions } from "@pcr/shared";
import { loadLocalEnv } from "./env.js";
import { GrammarRewriteSchema, OPENAI_GRAMMAR_REWRITE_JSON_SCHEMA } from "./schema.js";
import { openAiOptions, outputTextFromResponse } from "./openai.js";

export interface GrammarRewriteInput {
  rawText: string;
  keywords?: string[];
  options?: IntelligenceOptions;
}

export interface GrammarRewriteOutput {
  correctedPrompt: string;
  provider: "openai" | "deterministic";
  usedLlm: boolean;
  warnings: string[];
}

function enabledFromEnv(): boolean {
  return ["1", "true", "yes", "on"].includes((process.env.PCR_INTELLIGENCE_ENABLED ?? "").toLowerCase());
}

function stripKeyword(rawText: string, keywords: string[]): string {
  let text = rawText.trim();
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^\\s*${escaped}\\s*[:\\-–—]?\\s*`, "i"), "").trim();
  }
  return text.replace(/^\s*\$pcr\s+/i, "").trim();
}

function shouldUseOpenAi(options?: IntelligenceOptions): boolean {
  const provider = options?.provider ?? process.env.PCR_INTELLIGENCE_PROVIDER;
  if (options?.enabled === false || provider === "none" || provider === "deterministic") return false;
  return options?.enabled === true || (options?.enabled !== false && enabledFromEnv() && provider !== "deterministic" && provider !== "none");
}

export async function rewriteGrammarPrompt(input: GrammarRewriteInput): Promise<GrammarRewriteOutput> {
  if (input.options?.enabled !== false && !["none", "deterministic"].includes(input.options?.provider ?? "")) loadLocalEnv();
  const keywords = input.keywords?.length ? input.keywords : ["grammar fix"];
  const sourceText = stripKeyword(input.rawText, keywords);
  if (!sourceText) {
    return {
      correctedPrompt: "",
      provider: "deterministic",
      usedLlm: false,
      warnings: ["Grammar rewrite skipped because no source text remained after removing the trigger."],
    };
  }

  if (!shouldUseOpenAi(input.options)) {
    return {
      correctedPrompt: sourceText,
      provider: "deterministic",
      usedLlm: false,
      warnings: ["Grammar rewrite used deterministic fallback because OpenAI intelligence is disabled. No grammar correction was performed; only the trigger was removed."],
    };
  }

  const options = openAiOptions({
    ...input.options,
    model: input.options?.model ?? process.env.PCR_GRAMMAR_MODEL ?? process.env.PCR_OPENAI_MODEL,
  });
  if (!options.apiKey) {
    return {
      correctedPrompt: sourceText,
      provider: "deterministic",
      usedLlm: false,
      warnings: ["Grammar rewrite used deterministic fallback because no OpenAI API key is configured."],
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(`${options.baseUrl}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        input: [
          {
            role: "system",
            content: [
              "You rewrite user prompts for grammar, spelling, punctuation, and clarity.",
              "Do not answer the prompt.",
              "Remove wrapper phrases such as grammar-fix triggers.",
              "Preserve the user's intent, questions, tone, and domain-specific wording.",
              "Do not add new claims, facts, or extra explanation.",
              "Return JSON only.",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              sourceText,
              triggerKeywords: keywords,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "pcr_grammar_rewrite",
            schema: OPENAI_GRAMMAR_REWRITE_JSON_SCHEMA,
            strict: true,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI grammar rewrite failed: ${response.status} ${body.slice(0, 300)}`);
    }

    const body = await response.json() as unknown;
    const parsed = GrammarRewriteSchema.parse(JSON.parse(outputTextFromResponse(body)));
    return {
      correctedPrompt: parsed.correctedPrompt.trim(),
      provider: "openai",
      usedLlm: true,
      warnings: [],
    };
  } catch (error) {
    return {
      correctedPrompt: sourceText,
      provider: "deterministic",
      usedLlm: false,
      warnings: [`Grammar rewrite fallback: ${(error as Error).message}`],
    };
  } finally {
    clearTimeout(timeout);
  }
}
