import path from "node:path";
import fs from "fs-extra";
import YAML from "yaml";
import {
  ArreyConfig,
  CompletionOptions,
  ProviderConfig,
  ProviderName,
  ResolvedGlobalConfig,
  RunOptions,
  ToolRuntimeConfig
} from "./types";

export const ARREY_CONFIG_FILE = "arrey.config.yaml";

const DEFAULT_PROVIDER_NAME: ProviderName = "openai";
const DEFAULT_MODEL = "gpt-4o-mini";

function defaultProviderConfig(): ProviderConfig {
  return {
    name: DEFAULT_PROVIDER_NAME,
    model: DEFAULT_MODEL
  };
}

function normalizeInstalledTools(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((item): item is string => typeof item === "string"))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function normalizeProviderName(value: unknown): ProviderName {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    candidate === "openai" ||
    candidate === "anthropic" ||
    candidate === "ollama" ||
    candidate === "azure" ||
    candidate === "custom"
  ) {
    return candidate;
  }
  return DEFAULT_PROVIDER_NAME;
}

function normalizeProviderConfig(value: unknown): ProviderConfig {
  if (!value || typeof value !== "object") {
    return defaultProviderConfig();
  }

  const candidate = value as Record<string, unknown>;
  const normalized: ProviderConfig = {
    name: normalizeProviderName(candidate.name)
  };

  if (typeof candidate.model === "string" && candidate.model.trim().length > 0) {
    normalized.model = candidate.model.trim();
  }
  if (typeof candidate.apiKey === "string" && candidate.apiKey.length > 0) {
    normalized.apiKey = candidate.apiKey;
  }
  if (typeof candidate.endpoint === "string" && candidate.endpoint.trim().length > 0) {
    normalized.endpoint = candidate.endpoint.trim();
  }
  if (candidate.implementation && typeof candidate.implementation === "object") {
    normalized.implementation = candidate.implementation as ProviderConfig["implementation"];
  }

  return normalized;
}

function normalizeToolsConfig(value: unknown): ArreyConfig["tools"] {
  const fallback: ArreyConfig["tools"] = { installed: [] };
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Record<string, unknown>;
  const tools: ArreyConfig["tools"] = {
    installed: normalizeInstalledTools(candidate.installed)
  };

  for (const [key, entry] of Object.entries(candidate)) {
    if (key === "installed") {
      continue;
    }
    tools[key] = entry;
  }

  return tools;
}

function normalizeArreyConfig(config: unknown, projectRoot?: string): ArreyConfig {
  if (!config || typeof config !== "object") {
    return {
      provider: defaultProviderConfig(),
      tools: { installed: [] },
      ...(projectRoot ? { projectRoot } : {})
    };
  }

  const candidate = config as Record<string, unknown>;

  const provider = normalizeProviderConfig(candidate.provider);
  const tools = normalizeToolsConfig(candidate.tools);

  return {
    provider: {
      ...defaultProviderConfig(),
      ...provider
    },
    tools,
    ...(projectRoot ? { projectRoot } : {})
  };
}

function mergeProvider(
  base: ProviderConfig,
  override?: Partial<ProviderConfig>
): ProviderConfig {
  if (!override) {
    return { ...base };
  }

  return {
    ...base,
    ...override,
    name: normalizeProviderName(override.name ?? base.name)
  };
}

function getEnvApiKey(providerName: ProviderName): string | undefined {
  if (providerName === "openai") {
    return process.env.OPENAI_API_KEY;
  }
  if (providerName === "anthropic") {
    return process.env.ANTHROPIC_API_KEY;
  }
  if (providerName === "azure") {
    return process.env.AZURE_OPENAI_KEY;
  }
  return undefined;
}

function mergeTools(base: ArreyConfig["tools"], override: ArreyConfig["tools"]): ArreyConfig["tools"] {
  const mergedInstalled = [...new Set([...(base.installed ?? []), ...(override.installed ?? [])])];
  const merged: ArreyConfig["tools"] = {
    ...base,
    ...override,
    installed: mergedInstalled.sort((a, b) => a.localeCompare(b))
  };
  return merged;
}

function normalizeCompletionOptions(
  toolConfig: Record<string, unknown> | undefined,
  runOptions: RunOptions
): CompletionOptions {
  const completion: CompletionOptions = {};

  if (typeof toolConfig?.temperature === "number") {
    completion.temperature = toolConfig.temperature;
  }
  if (typeof toolConfig?.maxTokens === "number") {
    completion.maxTokens = toolConfig.maxTokens;
  }
  if (Array.isArray(toolConfig?.stopSequences)) {
    completion.stopSequences = toolConfig.stopSequences.filter(
      (value): value is string => typeof value === "string"
    );
  }
  if (typeof toolConfig?.model === "string") {
    completion.model = toolConfig.model;
  }

  if (typeof runOptions.temperature === "number") {
    completion.temperature = runOptions.temperature;
  }
  if (typeof runOptions.maxTokens === "number") {
    completion.maxTokens = runOptions.maxTokens;
  }
  if (Array.isArray(runOptions.stopSequences)) {
    completion.stopSequences = runOptions.stopSequences;
  }
  if (typeof runOptions.model === "string") {
    completion.model = runOptions.model;
  }

  return completion;
}

export function getDefaultConfig(projectRoot = process.cwd()): ArreyConfig {
  return {
    projectRoot,
    provider: defaultProviderConfig(),
    tools: {
      installed: []
    }
  };
}

export async function readConfigFile(projectRoot: string): Promise<ArreyConfig> {
  const configPath = path.join(projectRoot, ARREY_CONFIG_FILE);
  if (!(await fs.pathExists(configPath))) {
    return getDefaultConfig(projectRoot);
  }

  const content = await fs.readFile(configPath, "utf8");
  if (content.trim().length === 0) {
    return getDefaultConfig(projectRoot);
  }

  const parsed = YAML.parse(content) as unknown;
  return normalizeArreyConfig(parsed, projectRoot);
}

export async function writeConfigFile(projectRoot: string, config: ArreyConfig): Promise<void> {
  const output: ArreyConfig = normalizeArreyConfig(config, undefined);
  if (output.provider.implementation) {
    delete output.provider.implementation;
  }
  const configPath = path.join(projectRoot, ARREY_CONFIG_FILE);
  await fs.writeFile(configPath, YAML.stringify(output), "utf8");
}

export async function loadMergedGlobalConfig(
  runtimeConfig: Partial<ArreyConfig> = {},
  projectRoot = runtimeConfig.projectRoot ?? process.cwd()
): Promise<ResolvedGlobalConfig> {
  const fromDisk = await readConfigFile(projectRoot);
  const defaults = getDefaultConfig(projectRoot);
  const runtimeCandidate = runtimeConfig as Record<string, unknown>;
  const runtimeProvider = runtimeCandidate.provider
    ? normalizeProviderConfig(runtimeCandidate.provider)
    : undefined;
  const runtimeTools = runtimeCandidate.tools
    ? normalizeToolsConfig(runtimeCandidate.tools)
    : undefined;

  const provider = mergeProvider(mergeProvider(defaults.provider, fromDisk.provider), runtimeProvider);
  if (!provider.model) {
    provider.model = DEFAULT_MODEL;
  }
  if (!provider.apiKey) {
    provider.apiKey = getEnvApiKey(provider.name);
  }

  const tools = runtimeTools
    ? mergeTools(mergeTools(defaults.tools, fromDisk.tools), runtimeTools)
    : mergeTools(defaults.tools, fromDisk.tools);

  return {
    projectRoot: path.resolve(projectRoot),
    provider,
    tools
  };
}

export function resolveToolConfig(
  globalConfig: ResolvedGlobalConfig,
  toolName: string,
  runOptions: RunOptions = {}
): ToolRuntimeConfig {
  const rawToolConfig = globalConfig.tools[toolName];
  const toolConfig =
    rawToolConfig && typeof rawToolConfig === "object" && !Array.isArray(rawToolConfig)
      ? (rawToolConfig as Record<string, unknown>)
      : undefined;

  const toolProviderConfig =
    toolConfig?.provider && typeof toolConfig.provider === "object"
      ? (toolConfig.provider as Partial<ProviderConfig>)
      : undefined;

  const providerFromToolModel =
    typeof toolConfig?.model === "string" ? { model: toolConfig.model } : undefined;

  const provider = mergeProvider(
    mergeProvider(
      mergeProvider(globalConfig.provider, toolProviderConfig),
      providerFromToolModel
    ),
    runOptions.provider
  );

  if (runOptions.model) {
    provider.model = runOptions.model;
  }
  if (!provider.model) {
    provider.model = DEFAULT_MODEL;
  }
  if (!provider.apiKey) {
    provider.apiKey = getEnvApiKey(provider.name);
  }

  const completion = normalizeCompletionOptions(toolConfig, runOptions);

  const arreyConfig: ArreyConfig = {
    provider,
    tools: globalConfig.tools,
    projectRoot: globalConfig.projectRoot
  };

  return {
    provider,
    completion,
    projectRoot: globalConfig.projectRoot,
    arreyConfig
  };
}

export async function ensureProjectConfig(projectRoot: string): Promise<ResolvedGlobalConfig> {
  const existing = await readConfigFile(projectRoot);
  const merged = normalizeArreyConfig(existing, projectRoot);
  await writeConfigFile(projectRoot, merged);
  return loadMergedGlobalConfig(merged, projectRoot);
}
