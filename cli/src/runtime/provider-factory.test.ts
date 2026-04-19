import { describe, expect, it, vi } from "vitest";
import { createProviderFactory } from "./provider-factory";
import { ProviderConfig } from "./types";

function providerConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    name: "openai",
    model: "gpt-4o-mini",
    apiKey: "test-key",
    ...overrides
  };
}

describe("createProviderFactory", () => {
  it("caches providers for non-custom configs", async () => {
    const provider = { complete: vi.fn(async () => "ok") };
    const createProviderSpy = vi.fn(async () => provider);
    const factory = createProviderFactory({ createProvider: createProviderSpy });

    const first = await factory.getProvider(providerConfig());
    const second = await factory.getProvider(providerConfig());

    expect(first).toBe(second);
    expect(createProviderSpy).toHaveBeenCalledTimes(1);
  });

  it("does not cache custom providers", async () => {
    const customOne = { complete: vi.fn(async () => "one") };
    const customTwo = { complete: vi.fn(async () => "two") };
    const createProviderSpy = vi
      .fn()
      .mockResolvedValueOnce(customOne)
      .mockResolvedValueOnce(customTwo);
    const factory = createProviderFactory({ createProvider: createProviderSpy });

    const first = await factory.getProvider({
      name: "custom",
      implementation: customOne
    });
    const second = await factory.getProvider({
      name: "custom",
      implementation: customTwo
    });

    expect(first).not.toBe(second);
    expect(createProviderSpy).toHaveBeenCalledTimes(2);
  });
});
