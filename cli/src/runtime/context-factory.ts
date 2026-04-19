import {
  ArreyConfig,
  ArreyContext,
  ArreyLogger,
  ArreyProvider,
  ArreySchema,
  ChunkOptions,
  CompletionOptions,
  MemoryStore,
  ToolRuntimeConfig,
  ValidationResult
} from "./types";
import { validateWithArreySchema } from "./schema";

interface RuntimeRefs {
  runTool(name: string, input: Record<string, unknown>): Promise<unknown>;
}

interface CreateContextParams {
  toolRuntimeConfig: ToolRuntimeConfig;
  toolName: string;
  provider: ArreyProvider;
  memoryStore: MemoryStore;
  runtimeRefs: RuntimeRefs;
  requestMeta?: {
    requestId?: string;
    stack?: string[];
  };
}

function renderTemplate(template: string, vars?: Record<string, unknown>): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function createLogger(toolName: string, requestId?: string): ArreyLogger {
  const prefix = requestId ? `[arrey:${toolName}:${requestId}]` : `[arrey:${toolName}]`;

  function print(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const payload = meta ? `${message} ${JSON.stringify(meta)}` : message;
    if (level === "info") {
      console.log(`${prefix} ${payload}`);
      return;
    }
    if (level === "warn") {
      console.warn(`${prefix} ${payload}`);
      return;
    }
    if (level === "error") {
      console.error(`${prefix} ${payload}`);
      return;
    }
    if (process.env.ARREY_DEBUG === "1") {
      console.debug(`${prefix} ${payload}`);
    }
  }

  return {
    info(message, meta): void {
      print("info", message, meta);
    },
    warn(message, meta): void {
      print("warn", message, meta);
    },
    error(message, meta): void {
      print("error", message, meta);
    },
    debug(message, meta): void {
      print("debug", message, meta);
    }
  };
}

function chunkByCharacters(
  content: string,
  maxCharacters: number,
  overlap: number
): string[] {
  if (content.length <= maxCharacters) {
    return [content];
  }

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < content.length) {
    const end = Math.min(content.length, cursor + maxCharacters);
    chunks.push(content.slice(cursor, end));
    if (end >= content.length) {
      break;
    }
    cursor = Math.max(end - overlap, cursor + 1);
  }
  return chunks;
}

function chunkBySentence(content: string, maxCharacters: number): string[] {
  const sentences = content.match(/[^.!?]+[.!?]*/g) ?? [content];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = `${current}${sentence}`;
    if (next.length > maxCharacters && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [content];
}

function chunkContent(content: string, options: ChunkOptions = {}): string[] {
  const maxTokens = Math.max(1, options.maxTokens ?? 2000);
  const overlap = Math.max(0, options.overlap ?? 200);
  const approxCharsPerToken = 4;
  const maxCharacters = maxTokens * approxCharsPerToken;
  const overlapChars = overlap * approxCharsPerToken;

  switch (options.strategy ?? "semantic") {
    case "sentence":
      return chunkBySentence(content, maxCharacters);
    case "fixed":
      return chunkByCharacters(content, maxCharacters, 0);
    case "code":
      return chunkByCharacters(content, maxCharacters, overlapChars);
    case "semantic":
    default:
      return chunkByCharacters(content, maxCharacters, overlapChars);
  }
}

function embedText(text: string): number[] {
  const dimensions = 64;
  const vector = new Array<number>(dimensions).fill(0);

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    vector[index % dimensions] += code;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function toArreyConfig(config: ToolRuntimeConfig): ArreyConfig {
  return config.arreyConfig;
}

export function createContext(params: CreateContextParams): ArreyContext {
  const logger = createLogger(params.toolName, params.requestMeta?.requestId);

  async function complete(
    prompt: string,
    vars?: Record<string, unknown>,
    options?: CompletionOptions
  ): Promise<string> {
    const rendered = renderTemplate(prompt, vars);
    return params.provider.complete(rendered, {
      ...params.toolRuntimeConfig.completion,
      ...options,
      model: options?.model ?? params.toolRuntimeConfig.provider.model
    });
  }

  async function* stream(
    prompt: string,
    vars?: Record<string, unknown>,
    options?: CompletionOptions
  ): AsyncIterable<string> {
    const rendered = renderTemplate(prompt, vars);
    if (params.provider.stream) {
      for await (const token of params.provider.stream(rendered, {
        ...params.toolRuntimeConfig.completion,
        ...options,
        model: options?.model ?? params.toolRuntimeConfig.provider.model
      })) {
        yield token;
      }
      return;
    }

    yield await complete(rendered, undefined, options);
  }

  return {
    complete,
    stream,
    chunk(content, options): Promise<string[]> {
      return Promise.resolve(chunkContent(content, options));
    },
    embed(text): Promise<number[]> {
      return Promise.resolve(embedText(text));
    },
    validate<T>(value: unknown, schema: ArreySchema): ValidationResult<T> {
      return validateWithArreySchema<T>(value, schema);
    },
    memory: params.memoryStore,
    log: logger,
    async tool<T = unknown>(name: string, input: Record<string, unknown>): Promise<T> {
      return params.runtimeRefs.runTool(name, input) as Promise<T>;
    },
    config: toArreyConfig(params.toolRuntimeConfig)
  };
}
