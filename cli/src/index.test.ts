import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    run: vi.fn(async () => ({})),
    toJSON: vi.fn(async () => ({})),
    toVercelAI: vi.fn(async () => ({}))
  };
});

vi.mock("./runtime/create-runtime", () => {
  return {
    createRuntime: vi.fn(() => ({
      run: mocks.run,
      toJSON: mocks.toJSON,
      toVercelAI: mocks.toVercelAI
    }))
  };
});

import { arrey } from "./index";

describe("arrey imported tool helpers", () => {
  beforeEach(() => {
    mocks.run.mockClear();
    mocks.toJSON.mockClear();
    mocks.toVercelAI.mockClear();
  });

  it("converts imported tool references for Vercel adapter generation", async () => {
    function summarize() {
      return Promise.resolve({});
    }
    (summarize as typeof summarize & { arreyToolName?: string }).arreyToolName = "summarize";

    function extract() {
      return Promise.resolve({});
    }

    await arrey.toVercelAIFrom([summarize, extract]);

    expect(mocks.toVercelAI).toHaveBeenCalledWith(["summarize", "extract"]);
  });

  it("converts imported tool references for JSON adapter generation", async () => {
    await arrey.toJSONFrom([{ arreyToolName: "summarize" }, { name: "extract" }]);

    expect(mocks.toJSON).toHaveBeenCalledWith(["summarize", "extract"]);
  });

  it("throws for invalid tool references", () => {
    expect(() => arrey.toVercelAIFrom([{}])).toThrow("Invalid tool reference");
  });
});
