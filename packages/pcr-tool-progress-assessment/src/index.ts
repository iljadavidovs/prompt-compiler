import type { PcrTool } from "@pcr/shared";

export const progressAssessmentTemplateMarkdown = `---
id: research.progress-assessment
name: Progress Assessment Research Prompt
mode: research
description: Compiles a research/self-assessment prompt using goals, schedule, preferences, and history.
outputFormat: markdown
---

# Task

{{task}}

# Relevant User Context

{{contextSummary}}

# Current Goals

{{goals}}

# Near Schedule

{{schedule}}

# Preferences And Recurring Instructions

{{preferences}}

# Lessons From Prompt History

Positive patterns to preserve:
{{positivePatterns}}

Negative patterns to avoid:
{{negativePatterns}}

# Instructions

Create a rigorous research-style assessment prompt.
The prompt should help evaluate progress against current goals, near schedule, constraints, and recent execution quality.
The final prompt should ask for:
- progress assessment
- bottleneck identification
- next actions
- risks
- priority corrections
- concrete review questions
- output as a structured markdown report
`;

export const progressAssessmentTool: PcrTool = {
  metadata: {
    id: "progress-assessment",
    packageName: "@pcr/tool-progress-assessment",
    name: "Progress Assessment",
    description: "Compile research prompts for assessing progress against goals, schedule, risks, and execution quality.",
    modes: ["research", "analysis"],
    intents: ["progress-assessment"],
    triggers: [
      "progress",
      "goals",
      "schedule",
      "where I stand",
      "this week",
      "assessment",
      "bottlenecks",
    ],
    contextKinds: ["goal", "schedule", "preference", "history"],
    defaultEnabled: true,
  },
  profile: {
    id: "reflective-research",
    name: "Reflective Research",
    tone: "direct",
    verbosity: "deep",
    strictness: "high",
    defaults: {
      requireCitations: false,
      requirePlan: true,
      askClarifyingQuestions: false,
      allowWeb: false,
      requireTests: false,
    },
    rules: [
      "Preserve the user's stated intent.",
      "Include current goals when available.",
      "Include near schedule when available.",
      "Prefer concrete evaluation criteria.",
      "Avoid generic motivational advice.",
      "Surface contradictions and weak assumptions.",
    ],
  },
  template: {
    id: "research.progress-assessment",
    name: "Progress Assessment Research Prompt",
    mode: "research",
    description: "Compiles a research/self-assessment prompt using goals, schedule, preferences, and history.",
    outputFormat: "markdown",
    body: progressAssessmentTemplateMarkdown.replace(/^---[\s\S]*?---\n/, "").trim(),
  },
};

export const pcrTool = progressAssessmentTool;

