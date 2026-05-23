import type { IntelligenceOptions } from "@pcr/shared";
import { deterministicClassifyIntent } from "./deterministic.js";
import { loadLocalEnv } from "./env.js";
import { OpenAiIntentClassifier } from "./openai.js";
import { IntentClassificationSchema } from "./schema.js";
import type { ClassifyIntentInput, IntentClassification } from "./types.js";

function enabledFromEnv(): boolean {
  return ["1", "true", "yes", "on"].includes((process.env.PCR_INTELLIGENCE_ENABLED ?? "").toLowerCase());
}

function providerFromEnv(): IntelligenceOptions["provider"] {
  const provider = process.env.PCR_INTELLIGENCE_PROVIDER;
  if (provider === "openai" || provider === "local" || provider === "deterministic" || provider === "none") {
    return provider;
  }
  return undefined;
}

export function resolveIntelligenceOptions(options?: IntelligenceOptions): Required<Pick<IntelligenceOptions, "enabled" | "provider">> & IntelligenceOptions {
  loadLocalEnv();
  const enabled = options?.enabled ?? enabledFromEnv();
  const provider = options?.provider ?? providerFromEnv() ?? (enabled ? "openai" : "deterministic");
  return {
    ...options,
    enabled,
    provider,
  };
}

function canonicalizeClassification(classification: IntentClassification): IntentClassification {
  if (classification.adapter === "skip" || classification.intent.toLowerCase().trim() === "skip") {
    return {
      ...classification,
      mode: classification.mode ?? "generic",
      intent: "skip",
      contextNeeds: [],
      contextQueries: [],
    };
  }

  const normalizedIntent = classification.intent.toLowerCase().trim().replace(/[\s_]+/g, "-");
  let intent = normalizedIntent;
  if (classification.mode === "research" && normalizedIntent.includes("progress") && normalizedIntent.includes("assessment")) {
    intent = "progress-assessment";
  }
  if (normalizedIntent === "grammar-fix" || normalizedIntent === "grammar") {
    intent = "grammar-fix";
  }

  const needs = new Set(classification.contextNeeds);
  if (intent === "progress-assessment") {
    needs.add("goal");
    needs.add("schedule");
    needs.add("preference");
    needs.add("history");
  }

  return {
    ...classification,
    intent,
    contextNeeds: [...needs],
  };
}

export async function classifyIntent(input: ClassifyIntentInput): Promise<IntentClassification> {
  loadLocalEnv();
  const options = resolveIntelligenceOptions(input.options);
  const deterministic = deterministicClassifyIntent(input);
  if (deterministic.adapter === "skip") {
    return canonicalizeClassification(deterministic);
  }

  if (!options.enabled || options.provider === "deterministic" || options.provider === "none") {
    return canonicalizeClassification(deterministic);
  }

  if (options.provider === "local") {
    return canonicalizeClassification({
      ...deterministic,
      warnings: [...deterministic.warnings, "Local intelligence provider is not implemented; used deterministic fallback."],
    });
  }

  try {
    const provider = new OpenAiIntentClassifier(options);
    const classification = canonicalizeClassification(IntentClassificationSchema.parse(await provider.classifyIntent({ ...input, options })));
    if (classification.adapter === "skip") {
      return canonicalizeClassification({
        ...deterministic,
        warnings: [
          ...deterministic.warnings,
          "OpenAI classifier returned skip despite a deterministic tool trigger; used deterministic route.",
        ],
      });
    }
    if (classification.confidence < 0.35) {
      return canonicalizeClassification({
        ...deterministic,
        warnings: [
          ...deterministic.warnings,
          `OpenAI classifier confidence ${classification.confidence} was below threshold; used deterministic fallback.`,
        ],
      });
    }
    return classification;
  } catch (error) {
    return canonicalizeClassification({
      ...deterministic,
      warnings: [...deterministic.warnings, `Intelligence fallback: ${(error as Error).message}`],
    });
  }
}
