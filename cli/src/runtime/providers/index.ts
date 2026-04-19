import { ArreyProvider, CompletionOptions, ProviderConfig } from "../types";

export class ArreyProviderError extends Error {
  constructor(message: string) {
    super(`[arrey/provider] ${message}`);
    this.name = "ArreyProviderError";
  }
}

export function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      console.warn(`[arrey] Prompt template references "{{${key}}}" but no value was provided.`);
      return "";
    }
    return String(value);
  });
}

function defaults(options?: CompletionOptions): Required<CompletionOptions> {
  return {
    model: options?.model ?? "",
    temperature: options?.temperature ?? 0.3,
    maxTokens: options?.maxTokens ?? 1000,
    stopSequences: options?.stopSequences ?? []
  };
}

async function lazyImport(moduleName: string): Promise<any> {
  const dynamicImport = new Function("name", "return import(name);");
  return dynamicImport(moduleName) as Promise<any>;
}

async function createOpenAIProvider(config: ProviderConfig): Promise<ArreyProvider> {
  let OpenAIClient: any;
  try {
    const mod = await lazyImport("openai");
    OpenAIClient = mod.default;
  } catch {
    throw new ArreyProviderError(
      'Provider "openai" requires the openai package.\nInstall it with: npm install openai'
    );
  }

  const client = new OpenAIClient({
    apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
    baseURL: config.endpoint
  });
  const model = config.model ?? "gpt-4o-mini";

  return {
    async complete(prompt, options = {}) {
      const final = defaults(options);
      const response = await client.chat.completions.create({
        model: final.model || model,
        temperature: final.temperature,
        max_tokens: final.maxTokens,
        stop: final.stopSequences,
        messages: [{ role: "user", content: prompt }]
      });
      return response.choices?.[0]?.message?.content ?? "";
    },
    async *stream(prompt, options = {}) {
      const final = defaults(options);
      const stream = await client.chat.completions.create({
        model: final.model || model,
        temperature: final.temperature,
        max_tokens: final.maxTokens,
        stop: final.stopSequences,
        messages: [{ role: "user", content: prompt }],
        stream: true
      });
      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content ?? "";
        if (text) {
          yield text;
        }
      }
    }
  };
}

async function createAnthropicProvider(config: ProviderConfig): Promise<ArreyProvider> {
  let AnthropicClient: any;
  try {
    const mod = await lazyImport("@anthropic-ai/sdk");
    AnthropicClient = mod.default;
  } catch {
    throw new ArreyProviderError(
      'Provider "anthropic" requires the @anthropic-ai/sdk package.\nInstall it with: npm install @anthropic-ai/sdk'
    );
  }

  const client = new AnthropicClient({
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY
  });
  const model = config.model ?? "claude-3-5-haiku-latest";

  return {
    async complete(prompt, options = {}) {
      const final = defaults(options);
      const response = await client.messages.create({
        model: final.model || model,
        max_tokens: final.maxTokens,
        temperature: final.temperature,
        messages: [{ role: "user", content: prompt }]
      });
      const first = response.content?.[0];
      return first?.type === "text" ? first.text : "";
    },
    async *stream(prompt, options = {}) {
      const final = defaults(options);
      const stream = await client.messages.stream({
        model: final.model || model,
        max_tokens: final.maxTokens,
        temperature: final.temperature,
        messages: [{ role: "user", content: prompt }]
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta" &&
          event.delta?.text
        ) {
          yield event.delta.text;
        }
      }
    }
  };
}

async function createOllamaProvider(config: ProviderConfig): Promise<ArreyProvider> {
  const endpoint = config.endpoint ?? "http://localhost:11434";
  const model = config.model ?? "llama3";

  return {
    async complete(prompt, options = {}) {
      const final = defaults(options);
      const response = await fetch(`${endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: final.model || model,
          prompt,
          stream: false,
          options: {
            temperature: final.temperature,
            num_predict: final.maxTokens,
            stop: final.stopSequences
          }
        })
      });

      if (!response.ok) {
        throw new ArreyProviderError(
          `Ollama request failed: ${response.status} ${response.statusText}. Is Ollama running?`
        );
      }

      const payload = (await response.json()) as { response?: string };
      return payload.response ?? "";
    },
    async *stream(prompt, options = {}) {
      const final = defaults(options);
      const response = await fetch(`${endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: final.model || model,
          prompt,
          stream: true,
          options: {
            temperature: final.temperature,
            num_predict: final.maxTokens,
            stop: final.stopSequences
          }
        })
      });

      if (!response.ok) {
        throw new ArreyProviderError(
          `Ollama request failed: ${response.status} ${response.statusText}. Is Ollama running?`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }
          try {
            const chunk = JSON.parse(trimmed) as { response?: string; done?: boolean };
            if (chunk.response) {
              yield chunk.response;
            }
            if (chunk.done) {
              return;
            }
          } catch {
            continue;
          }
        }
      }
    }
  };
}

async function createAzureProvider(config: ProviderConfig): Promise<ArreyProvider> {
  if (!config.endpoint) {
    throw new ArreyProviderError(
      'Azure provider requires "provider.endpoint" in arrey.config.yaml.'
    );
  }

  let AzureOpenAIClient: any;
  try {
    const mod = await lazyImport("openai");
    AzureOpenAIClient = mod.AzureOpenAI;
  } catch {
    throw new ArreyProviderError(
      'Provider "azure" requires the openai package.\nInstall it with: npm install openai'
    );
  }

  const client = new AzureOpenAIClient({
    apiKey: config.apiKey ?? process.env.AZURE_OPENAI_KEY,
    endpoint: config.endpoint,
    apiVersion: "2024-02-01"
  });
  const model = config.model ?? "gpt-4o";

  return {
    async complete(prompt, options = {}) {
      const final = defaults(options);
      const response = await client.chat.completions.create({
        model: final.model || model,
        temperature: final.temperature,
        max_tokens: final.maxTokens,
        stop: final.stopSequences,
        messages: [{ role: "user", content: prompt }]
      });
      return response.choices?.[0]?.message?.content ?? "";
    }
  };
}

export async function createProvider(config: ProviderConfig): Promise<ArreyProvider> {
  if (config.name === "custom" || config.implementation) {
    if (!config.implementation) {
      throw new ArreyProviderError(
        "Custom provider requires provider.implementation in runtime configuration."
      );
    }
    return config.implementation;
  }

  switch (config.name) {
    case "openai":
      return createOpenAIProvider(config);
    case "anthropic":
      return createAnthropicProvider(config);
    case "ollama":
      return createOllamaProvider(config);
    case "azure":
      return createAzureProvider(config);
    default:
      throw new ArreyProviderError(`Unknown provider "${config.name}".`);
  }
}
