import { createContext } from "./context-factory";
import { resolveToolConfig } from "./config-resolver";
import { createMemoryStore } from "./memory-store";
import { ProviderFactory } from "./provider-factory";
import { validateWithArreySchema } from "./schema";
import { loadTool } from "./tool-loader";
import { ResolvedGlobalConfig, RunOptions } from "./types";

interface ExecuteToolParams {
  globalConfig: ResolvedGlobalConfig;
  providerFactory: ProviderFactory;
  toolName: string;
  input: Record<string, unknown>;
  runOptions?: RunOptions;
  requestMeta?: {
    requestId?: string;
    stack?: string[];
  };
}

interface ExecuteToolDeps {
  executeNestedTool(params: {
    toolName: string;
    input: Record<string, unknown>;
    requestMeta?: {
      requestId?: string;
      stack?: string[];
    };
  }): Promise<unknown>;
}

export async function executeTool(
  params: ExecuteToolParams,
  deps: ExecuteToolDeps
): Promise<unknown> {
  const runtimeConfig = resolveToolConfig(
    params.globalConfig,
    params.toolName,
    params.runOptions
  );
  const provider = await params.providerFactory.getProvider(runtimeConfig.provider);
  const loadedTool = await loadTool(params.globalConfig.projectRoot, params.toolName);

  const inputValidation = validateWithArreySchema<Record<string, unknown>>(
    params.input,
    loadedTool.manifest.input
  );
  if (!inputValidation.success) {
    throw new Error(
      `Input validation failed for "${params.toolName}": ${JSON.stringify(
        inputValidation.errors ?? []
      )}`
    );
  }

  if (Array.isArray(loadedTool.manifest.composes)) {
    for (const composedTool of loadedTool.manifest.composes) {
      await loadTool(params.globalConfig.projectRoot, composedTool);
    }
  }

  const stack = [...(params.requestMeta?.stack ?? []), params.toolName];
  const ctx = createContext({
    toolRuntimeConfig: runtimeConfig,
    provider,
    memoryStore: createMemoryStore(runtimeConfig.projectRoot),
    toolName: params.toolName,
    runtimeRefs: {
      runTool: (name, input) =>
        deps.executeNestedTool({
          toolName: name,
          input,
          requestMeta: {
            requestId: params.requestMeta?.requestId,
            stack
          }
        })
    },
    requestMeta: {
      requestId: params.requestMeta?.requestId,
      stack
    }
  });

  const output = await loadedTool.module.run(inputValidation.data ?? params.input, ctx);
  const outputValidation = validateWithArreySchema<Record<string, unknown>>(
    output,
    loadedTool.manifest.output
  );
  if (!outputValidation.success) {
    throw new Error(
      `Output validation failed for "${params.toolName}": ${JSON.stringify(
        outputValidation.errors ?? []
      )}`
    );
  }

  return outputValidation.data ?? output;
}
