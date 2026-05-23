import type { IntelligenceOptions } from "@pcr/shared";
import { OpenAiIntentClassificationSchema, OPENAI_INTENT_JSON_SCHEMA } from "./schema.js";
import type { ClassifyIntentInput, IntelligenceProvider, IntentClassification } from "./types.js";

export function outputTextFromResponse(response: any): string {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("");
}

export function openAiOptions(options?: IntelligenceOptions) {
  return {
    apiKey: options?.apiKey ?? process.env.PCR_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
    model: options?.model ?? process.env.PCR_OPENAI_MODEL ?? "gpt-5.5",
    baseUrl: options?.baseUrl ?? process.env.PCR_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    timeoutMs: options?.timeoutMs ?? 10000,
  };
}

function reasoningConfig(model: string): { effort: string } | undefined {
  if (!model.startsWith("gpt-5")) {
    return undefined;
  }
  return { effort: process.env.PCR_OPENAI_REASONING_EFFORT ?? "none" };
}

export class OpenAiIntentClassifier implements IntelligenceProvider {
  readonly name = "openai" as const;
  private readonly options?: IntelligenceOptions;

  constructor(options?: IntelligenceOptions) {
    this.options = options;
  }

  async classifyIntent(input: ClassifyIntentInput): Promise<IntentClassification> {
    const options = openAiOptions({ ...this.options, ...input.options });
    if (!options.apiKey) {
      throw new Error("OpenAI intelligence is enabled but PCR_OPENAI_API_KEY or OPENAI_API_KEY is not set.");
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
          reasoning: reasoningConfig(options.model),
          input: [
            {
              role: "system",
              content: [
                "You are PCR's first-pass intent classifier.",
                "Return structured JSON only.",
                "Do not write the final prompt.",
                "Classify the user's rough input into mode, intent, context needs, adapter, constraints, and a concise task rewrite.",
                "Only choose tools from enabledTools. If no enabled tool applies, set adapter to skip and intent to skip.",
                "Prefer conservative context needs. Use progress-assessment when the user asks where they stand, how progress is going, or how goals/schedule relate.",
                "Use history only to resolve continuity references such as this, it, same thing, original prompt, or previous request.",
                "If rawText contains a quoted or pasted earlier prompt, treat that earlier prompt as context, not as the current task.",
              ].join("\n"),
            },
            {
              role: "user",
              content: JSON.stringify({
                rawText: input.rawText,
                explicitMode: input.explicitMode,
                contextHints: input.contextHints ?? [],
                profileId: input.profileId,
                recentUserTurns: input.history ?? [],
                enabledTools: input.enabledTools ?? [],
              }),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "pcr_intent_classification",
              schema: OPENAI_INTENT_JSON_SCHEMA,
              strict: true,
            },
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI classification failed: ${response.status} ${body.slice(0, 300)}`);
      }

      const body = await response.json() as unknown;
      const outputText = outputTextFromResponse(body);
      const parsed = OpenAiIntentClassificationSchema.parse(JSON.parse(outputText));
      return {
        ...parsed,
        provider: "openai",
        usedLlm: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
