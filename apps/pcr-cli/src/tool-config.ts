import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { listAvailableTools, resolveConfig } from "@pcr/core";
import { PcrConfigSchema, resolvePcrPaths, type PcrConfig } from "@pcr/shared";
import YAML from "yaml";

async function readConfig(path: string): Promise<PcrConfig> {
  try {
    return PcrConfigSchema.parse(YAML.parse(await readFile(path, "utf8")) ?? {});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeConfig(path: string, config: PcrConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, YAML.stringify(config));
}

export async function listToolStates(cwd?: string) {
  const paths = resolvePcrPaths(cwd, process.env.PCR_USER_DIR);
  const config = await resolveConfig(paths.cwd, paths.userDir);
  const enabled = new Set(config.tools?.enabled ?? []);
  return listAvailableTools().map((tool) => ({
    ...tool.metadata,
    enabled: enabled.has(tool.metadata.id) || enabled.has(tool.metadata.packageName),
  }));
}

export async function setToolEnabled(toolId: string, enabled: boolean, cwd?: string) {
  const paths = resolvePcrPaths(cwd, process.env.PCR_USER_DIR);
  const configPath = join(paths.userDir, "config.yaml");
  const config = await readConfig(configPath);
  const current = new Set(config.tools?.enabled ?? []);
  const tool = listAvailableTools().find((candidate) => (
    candidate.metadata.id === toolId || candidate.metadata.packageName === toolId
  ));
  if (!tool) {
    throw new Error(`Unknown PCR tool: ${toolId}`);
  }

  if (enabled) {
    current.add(tool.metadata.id);
  } else {
    current.delete(tool.metadata.id);
    current.delete(tool.metadata.packageName);
  }

  const nextConfig: PcrConfig = {
    ...config,
    tools: {
      ...config.tools,
      enabled: [...current],
    },
  };
  await writeConfig(configPath, nextConfig);
  return { configPath, tool: tool.metadata, enabled };
}

