export type ProviderName = "openai" | "anthropic" | "ollama" | "azure" | "custom";

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  model?: string;
}

export interface ArreyProvider {
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  stream?(prompt: string, options?: CompletionOptions): AsyncIterable<string>;
}

export interface ChunkOptions {
  strategy?: "semantic" | "fixed" | "sentence" | "code";
  maxTokens?: number;
  overlap?: number;
  preserveHeaders?: boolean;
}

export interface MemoryEntry {
  key: string;
  value: string;
  score: number;
}

export interface MemoryStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  search(query: string, topK?: number): Promise<MemoryEntry[]>;
}

export type ArreySchema = Record<string, SchemaField>;

export type SchemaField =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "number[]"
  | { type: "string"; enum?: string[]; pattern?: string }
  | { type: "number"; min?: number; max?: number }
  | { type: "object"; fields: ArreySchema }
  | { type: "array"; items: SchemaField }
  | `${string}?`;

export interface ValidationError {
  field: string;
  message: string;
  received: unknown;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ArreyLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export interface ProviderConfig {
  name: ProviderName;
  model?: string;
  apiKey?: string;
  endpoint?: string;
  implementation?: ArreyProvider;
}

export interface ArreyConfig {
  provider: ProviderConfig;
  tools: {
    installed: string[];
    [toolName: string]: unknown;
  };
  projectRoot?: string;
}

export interface ArreyContext {
  complete(
    prompt: string,
    vars?: Record<string, unknown>,
    options?: CompletionOptions
  ): Promise<string>;
  stream(
    prompt: string,
    vars?: Record<string, unknown>,
    options?: CompletionOptions
  ): AsyncIterable<string>;
  chunk(content: string, options?: ChunkOptions): Promise<string[]>;
  embed(text: string): Promise<number[]>;
  validate<T>(value: unknown, schema: ArreySchema): ValidationResult<T>;
  memory: MemoryStore;
  log: ArreyLogger;
  tool<T = unknown>(name: string, input: Record<string, unknown>): Promise<T>;
  config: ArreyConfig;
}

export interface ToolExample {
  description: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
}

export interface ToolManifest {
  name: string;
  version: string;
  description: string;
  arrey: string;
  input: ArreySchema;
  output: ArreySchema;
  composes?: string[];
  optionalDeps?: string[];
  examples?: ToolExample[];
  experimental?: boolean;
  tags?: string[];
}

export type ToolRunner<
  TInput = Record<string, unknown>,
  TOutput = Record<string, unknown>
> = (input: TInput, ctx: ArreyContext) => Promise<TOutput>;

export interface ToolModule {
  run: ToolRunner;
}

export interface LoadedTool {
  directory: string;
  manifest: ToolManifest;
  module: ToolModule;
}

export interface ToolJsonDefinition {
  name: string;
  version: string;
  description: string;
  arrey: string;
  input: ArreySchema;
  output: ArreySchema;
  experimental?: boolean;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface JsonSchema {
  [key: string]: unknown;
}

export interface VercelToolDefinition {
  description: string;
  parameters: JsonSchema;
  experimental?: boolean;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export type ToolReference =
  | string
  | {
      arreyToolName?: string;
      name?: string;
    };

export interface RunOptions extends CompletionOptions {
  requestId?: string;
  provider?: Partial<ProviderConfig>;
}

export interface ToolRuntimeConfig {
  provider: ProviderConfig;
  completion: CompletionOptions;
  projectRoot: string;
  arreyConfig: ArreyConfig;
}

export interface ResolvedGlobalConfig {
  projectRoot: string;
  provider: ProviderConfig;
  tools: ArreyConfig["tools"];
}

export interface ArreyRuntime {
  run(
    toolName: string,
    input: Record<string, unknown>,
    options?: RunOptions
  ): Promise<unknown>;
  toJSON(toolNames?: string[]): Promise<Record<string, ToolJsonDefinition>>;
  toVercelAI(toolNames?: string[]): Promise<Record<string, VercelToolDefinition>>;
}
