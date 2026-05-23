import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePcrPaths } from "@pcr/shared";
import { createPcrStore } from "@pcr/store";
import { codingTemplateMarkdown, codingTool } from "@pcr/tool-coding";
import { grammarTemplateMarkdown, grammarTool } from "@pcr/tool-grammar";
import { plannerTemplateMarkdown, plannerTool } from "@pcr/tool-planner";
import { progressAssessmentTemplateMarkdown, progressAssessmentTool } from "@pcr/tool-progress-assessment";
import YAML from "yaml";

export interface InitOptions {
  cwd?: string;
  userDir?: string;
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await writeFile(path, content, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

export async function initPcr(options: InitOptions = {}): Promise<{ userDir: string; files: string[] }> {
  const paths = resolvePcrPaths(options.cwd, options.userDir ?? process.env.PCR_USER_DIR);
  const files: string[] = [];

  await mkdir(join(paths.userDir, "context"), { recursive: true });
  await mkdir(join(paths.userDir, "templates"), { recursive: true });
  await mkdir(join(paths.userDir, "profiles"), { recursive: true });

  const defaults = [
    {
      path: join(paths.userDir, "config.yaml"),
      content: YAML.stringify({
        tools: {
          enabled: [
            progressAssessmentTool.metadata.id,
            grammarTool.metadata.id,
            plannerTool.metadata.id,
            codingTool.metadata.id,
          ],
          config: {
            grammar: {
              keywords: ["grammar fix"],
            },
            planner: {
              reminders: {
                enabled: false,
                command: "remindctl",
                args: ["upcoming", "--json"],
              },
              docs: {
                folder: "",
                limit: 3,
              },
            },
            coding: {
              autoActivate: false,
              autoAttachDocs: false,
              docs: {
                files: ["README.md", "AGENTS.md", "docs/ARCHITECTURE.md"],
              },
            },
          },
        },
      }),
    },
    {
      path: join(paths.userDir, "context", "goals.md"),
      content: "- Finish PCR V0\n- Improve execution consistency\n- Reduce repeated prompt setup\n- Build local-first AI tools\n",
    },
    {
      path: join(paths.userDir, "context", "schedule.md"),
      content: "- This week: implement core compiler\n- Friday: review architecture\n- Weekend: test Claude/Codex adapter flow\n",
    },
    {
      path: join(paths.userDir, "context", "preferences.md"),
      content: "- Direct tone\n- No generic motivation\n- Prefer structured output\n- Include risks and weak assumptions\n",
    },
    {
      path: join(paths.userDir, "context", "recurring-comments.md"),
      content: "- Keep prompts concrete and grounded in local context.\n",
    },
    {
      path: join(paths.userDir, "context", "positive-patterns.md"),
      content: "- Clear sectioning with goals, schedule, risks, and next actions works well.\n",
    },
    {
      path: join(paths.userDir, "context", "negative-patterns.md"),
      content: "- Avoid generic motivational language and vague productivity advice.\n",
    },
    {
      path: join(paths.userDir, "templates", "research.progress-assessment.md"),
      content: `${progressAssessmentTemplateMarkdown}\n`,
    },
    {
      path: join(paths.userDir, "templates", "writing.grammar-fix.md"),
      content: `${grammarTemplateMarkdown}\n`,
    },
    {
      path: join(paths.userDir, "templates", "analysis.planner.md"),
      content: `${plannerTemplateMarkdown}\n`,
    },
    {
      path: join(paths.userDir, "templates", "coding.context.md"),
      content: `${codingTemplateMarkdown}\n`,
    },
    {
      path: join(paths.userDir, "profiles", "reflective-research.yaml"),
      content: YAML.stringify(progressAssessmentTool.profile),
    },
    {
      path: join(paths.userDir, "profiles", "grammar-editor.yaml"),
      content: YAML.stringify(grammarTool.profile),
    },
    {
      path: join(paths.userDir, "profiles", "planner.yaml"),
      content: YAML.stringify(plannerTool.profile),
    },
    {
      path: join(paths.userDir, "profiles", "coding.yaml"),
      content: YAML.stringify(codingTool.profile),
    },
  ];

  for (const file of defaults) {
    await writeIfMissing(file.path, file.content);
    files.push(file.path);
  }

  const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH ?? paths.dbPath });
  store.close();

  return { userDir: paths.userDir, files };
}
