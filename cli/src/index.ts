import { createRuntime } from "./runtime/create-runtime";
import {
  ArreyConfig,
  RunOptions,
  ToolReference,
  ToolJsonDefinition,
  VercelToolDefinition
} from "./runtime/types";

let configuredRuntimeConfig: Partial<ArreyConfig> = {};
let runtime = createRuntime(configuredRuntimeConfig);

function rebuildRuntime(): void {
  runtime = createRuntime(configuredRuntimeConfig);
}

function normalizeToolReferenceName(ref: ToolReference): string {
  if (typeof ref === "string") {
    return ref.trim();
  }

  const fromExplicit =
    typeof ref.arreyToolName === "string" ? ref.arreyToolName.trim() : "";
  if (fromExplicit.length > 0) {
    return fromExplicit;
  }

  const fromName = typeof ref.name === "string" ? ref.name.trim() : "";
  if (fromName.length > 0) {
    return fromName;
  }

  throw new Error(
    "Invalid tool reference. Pass a tool name string or an imported tool function with arreyToolName."
  );
}

function normalizeToolReferences(refs: ToolReference[]): string[] {
  const names = refs
    .map((ref) => normalizeToolReferenceName(ref))
    .filter((name) => name.length > 0);
  return [...new Set(names)];
}

export const arrey = {
  configure(config: Partial<ArreyConfig>): void {
    configuredRuntimeConfig = {
      ...configuredRuntimeConfig,
      ...(config.projectRoot ? { projectRoot: config.projectRoot } : {}),
      ...(config.provider
        ? {
            provider: {
              ...(configuredRuntimeConfig.provider ?? {}),
              ...config.provider
            } as ArreyConfig["provider"]
          }
        : {}),
      ...(config.tools
        ? {
            tools: {
              ...(configuredRuntimeConfig.tools ?? {}),
              ...config.tools
            } as ArreyConfig["tools"]
          }
        : {})
    };
    rebuildRuntime();
  },
  async run<TInput = unknown, TOutput = unknown>(
    toolName: string,
    input: TInput,
    options?: RunOptions
  ): Promise<TOutput> {
    return runtime.run(toolName, input as Record<string, unknown>, options) as Promise<TOutput>;
  },
  toJSON(toolNames?: string[]): Promise<Record<string, ToolJsonDefinition>> {
    return runtime.toJSON(toolNames);
  },
  toJSONFrom(toolRefs: ToolReference[]): Promise<Record<string, ToolJsonDefinition>> {
    return runtime.toJSON(normalizeToolReferences(toolRefs));
  },
  toVercelAI(toolNames?: string[]): Promise<Record<string, VercelToolDefinition>> {
    return runtime.toVercelAI(toolNames);
  },
  toVercelAIFrom(toolRefs: ToolReference[]): Promise<Record<string, VercelToolDefinition>> {
    return runtime.toVercelAI(normalizeToolReferences(toolRefs));
  }
};

export { createRuntime } from "./runtime/create-runtime";
export type {
  ArreyConfig,
  ArreyContext,
  ArreyProvider,
  ArreyRuntime,
  CompletionOptions,
  ToolRuntimeConfig,
  RunOptions,
  ToolReference,
  ToolJsonDefinition,
  ToolManifest,
  VercelToolDefinition
} from "./runtime/types";
