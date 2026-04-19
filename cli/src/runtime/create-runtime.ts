import { loadMergedGlobalConfig } from "./config-resolver";
import { executeTool } from "./executor";
import { createProviderFactory, ProviderFactory } from "./provider-factory";
import { arreySchemaToJsonSchema } from "./schema";
import { discoverInstalledTools, loadTool } from "./tool-loader";
import {
  ArreyConfig,
  ArreyRuntime,
  RunOptions,
  ToolJsonDefinition,
  VercelToolDefinition
} from "./types";

interface RuntimeDeps {
  providerFactory?: ProviderFactory;
}

function normalizeToolNames(toolNames?: string[]): string[] | undefined {
  if (!toolNames) {
    return undefined;
  }

  const normalized = toolNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  if (normalized.length === 0) {
    return undefined;
  }

  return [...new Set(normalized)];
}

export function createRuntime(
  runtimeConfig: Partial<ArreyConfig> = {},
  deps: RuntimeDeps = {}
): ArreyRuntime {
  const providerFactory = deps.providerFactory ?? createProviderFactory();

  async function run(
    toolName: string,
    input: Record<string, unknown>,
    options: RunOptions = {}
  ): Promise<unknown> {
    const globalConfig = await loadMergedGlobalConfig(runtimeConfig);
    const requestId = options.requestId;

    async function executeNested(
      nestedToolName: string,
      nestedInput: Record<string, unknown>,
      requestMeta?: {
        requestId?: string;
        stack?: string[];
      }
    ): Promise<unknown> {
      return executeTool(
        {
          globalConfig,
          providerFactory,
          toolName: nestedToolName,
          input: nestedInput,
          requestMeta: {
            requestId: requestMeta?.requestId ?? requestId,
            stack: requestMeta?.stack
          }
        },
        {
          executeNestedTool: async ({ toolName, input, requestMeta }) =>
            executeNested(toolName, input, requestMeta)
        }
      );
    }

    return executeTool(
      {
        globalConfig,
        providerFactory,
        toolName,
        input,
        runOptions: options,
        requestMeta: { requestId }
      },
      {
        executeNestedTool: async ({ toolName, input }) => executeNested(toolName, input)
      }
    );
  }

  async function resolveAdapterTools(requested?: string[]): Promise<string[]> {
    const globalConfig = await loadMergedGlobalConfig(runtimeConfig);
    const explicit = normalizeToolNames(requested);
    if (explicit) {
      return explicit;
    }

    const installed = await discoverInstalledTools(globalConfig.projectRoot);
    const stableTools: string[] = [];

    for (const toolName of installed) {
      const loaded = await loadTool(globalConfig.projectRoot, toolName);
      if (!loaded.manifest.experimental) {
        stableTools.push(toolName);
      }
    }

    return stableTools;
  }

  async function toJSON(toolNames?: string[]): Promise<Record<string, ToolJsonDefinition>> {
    const globalConfig = await loadMergedGlobalConfig(runtimeConfig);
    const resolvedNames = await resolveAdapterTools(toolNames);
    const output: Record<string, ToolJsonDefinition> = {};

    for (const toolName of resolvedNames) {
      const loaded = await loadTool(globalConfig.projectRoot, toolName);
      output[toolName] = {
        name: loaded.manifest.name,
        version: loaded.manifest.version,
        description: loaded.manifest.description,
        arrey: loaded.manifest.arrey,
        input: loaded.manifest.input,
        output: loaded.manifest.output,
        experimental: loaded.manifest.experimental,
        execute: async (input) => run(toolName, input)
      };
    }

    return output;
  }

  async function toVercelAI(
    toolNames?: string[]
  ): Promise<Record<string, VercelToolDefinition>> {
    const globalConfig = await loadMergedGlobalConfig(runtimeConfig);
    const resolvedNames = await resolveAdapterTools(toolNames);
    const output: Record<string, VercelToolDefinition> = {};

    for (const toolName of resolvedNames) {
      const loaded = await loadTool(globalConfig.projectRoot, toolName);
      output[toolName] = {
        description: loaded.manifest.description,
        parameters: arreySchemaToJsonSchema(loaded.manifest.input),
        experimental: loaded.manifest.experimental,
        execute: async (input) => run(toolName, input)
      };
    }

    return output;
  }

  return {
    run,
    toJSON,
    toVercelAI
  };
}
