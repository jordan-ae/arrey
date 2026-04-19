import { ArreyConfig } from "../runtime/types";
import {
  getDefaultConfig,
  readConfigFile,
  writeConfigFile
} from "../runtime/config-resolver";

export async function loadProjectConfig(projectRoot: string): Promise<ArreyConfig> {
  return readConfigFile(projectRoot);
}

export async function ensureProjectConfig(projectRoot: string): Promise<ArreyConfig> {
  const existing = await readConfigFile(projectRoot);
  const defaults = getDefaultConfig(projectRoot);
  const merged: ArreyConfig = {
    ...defaults,
    ...existing,
    tools: {
      ...(defaults.tools ?? {}),
      ...(existing.tools ?? {}),
      installed: existing.tools?.installed ?? defaults.tools.installed
    }
  };
  await writeConfigFile(projectRoot, merged);
  return merged;
}

export async function addInstalledToolToConfig(
  projectRoot: string,
  toolName: string
): Promise<void> {
  const config = await ensureProjectConfig(projectRoot);
  const installedTools = new Set(config.tools.installed ?? []);
  installedTools.add(toolName);
  config.tools.installed = [...installedTools].sort((a, b) => a.localeCompare(b));
  await writeConfigFile(projectRoot, config);
}
