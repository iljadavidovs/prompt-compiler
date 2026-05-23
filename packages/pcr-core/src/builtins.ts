import { codingTool } from "@pcr/tool-coding";
import { grammarTool } from "@pcr/tool-grammar";
import { plannerTool } from "@pcr/tool-planner";
import { progressAssessmentTemplateMarkdown, progressAssessmentTool } from "@pcr/tool-progress-assessment";

export const BUILTIN_PROFILE = progressAssessmentTool.profile;
export const BUILTIN_TEMPLATE_MARKDOWN = progressAssessmentTemplateMarkdown;
export const BUILTIN_TEMPLATE = progressAssessmentTool.template;

export const BUILTIN_TEMPLATES = [
  BUILTIN_TEMPLATE,
  grammarTool.template,
  plannerTool.template,
  codingTool.template,
];

export const BUILTIN_PROFILES = [
  BUILTIN_PROFILE,
  grammarTool.profile,
  plannerTool.profile,
  codingTool.profile,
];
