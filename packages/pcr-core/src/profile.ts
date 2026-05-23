import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import {
  DEFAULT_PROFILE_ID,
  PCR_PROJECT_DIR_NAME,
  PCR_USER_DIR_NAME,
  type PcrProfile,
} from "@pcr/shared";
import { BUILTIN_PROFILE, BUILTIN_PROFILES } from "./builtins.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function parseProfileYaml(yaml: string): PcrProfile {
  const parsed = YAML.parse(yaml) as PcrProfile;
  if (!parsed.id || !parsed.name) {
    throw new Error("Profile YAML requires id and name.");
  }
  return {
    ...parsed,
    rules: parsed.rules ?? [],
  };
}

export async function resolveProfile(options: {
  profileId?: string;
  cwd: string;
}): Promise<PcrProfile> {
  const profileId = options.profileId ?? DEFAULT_PROFILE_ID;
  const profileDirs = [
    join(options.cwd, PCR_PROJECT_DIR_NAME, "profiles"),
    join(homedir(), PCR_USER_DIR_NAME, "profiles"),
  ];

  for (const dir of profileDirs) {
    for (const extension of [".yaml", ".yml"]) {
      const file = join(dir, `${profileId}${extension}`);
      if (await exists(file)) {
        return parseProfileYaml(await readFile(file, "utf8"));
      }
    }
  }

  return BUILTIN_PROFILES.find((profile) => profile.id === profileId) ?? BUILTIN_PROFILE;
}

export function listBuiltinProfiles(): PcrProfile[] {
  return [...BUILTIN_PROFILES];
}

