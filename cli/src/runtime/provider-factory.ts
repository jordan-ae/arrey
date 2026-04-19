import { createProvider } from "./providers";
import { ArreyProvider, ProviderConfig } from "./types";

function cacheKey(config: ProviderConfig): string | null {
  if (config.name === "custom") {
    return null;
  }

  return JSON.stringify({
    name: config.name,
    model: config.model,
    apiKey: config.apiKey,
    endpoint: config.endpoint
  });
}

export interface ProviderFactory {
  getProvider(config: ProviderConfig): Promise<ArreyProvider>;
}

interface ProviderFactoryDeps {
  createProvider?: (config: ProviderConfig) => Promise<ArreyProvider>;
}

export function createProviderFactory(deps: ProviderFactoryDeps = {}): ProviderFactory {
  const factory = deps.createProvider ?? createProvider;
  const cache = new Map<string, Promise<ArreyProvider>>();

  async function getProvider(config: ProviderConfig): Promise<ArreyProvider> {
    const key = cacheKey(config);
    if (!key) {
      return factory(config);
    }

    const existing = cache.get(key);
    if (existing) {
      return existing;
    }

    const created = factory(config);
    cache.set(key, created);
    return created;
  }

  return {
    getProvider
  };
}
