import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntime } from "./create-runtime";
import { ProviderFactory } from "./provider-factory";
import { ProviderConfig } from "./types";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "arrey-runtime-test-"));
  tempDirs.push(directory);
  return directory;
}

async function scaffoldTool(params: {
  projectRoot: string;
  toolName: string;
  manifest?: Record<string, unknown>;
  indexCode: string;
}): Promise<void> {
  const toolDir = path.join(params.projectRoot, "arrey", "tools", params.toolName);
  await fs.ensureDir(toolDir);
  await fs.writeFile(path.join(toolDir, "index.ts"), `${params.indexCode}\n`, "utf8");
  await fs.writeFile(path.join(toolDir, "prompt.ts"), "export const PROMPT = 'prompt';\n", "utf8");
  await fs.writeFile(path.join(toolDir, "README.md"), `# ${params.toolName}\n`, "utf8");
  await fs.writeJson(path.join(toolDir, "manifest.json"), {
    name: params.toolName,
    version: "0.1.0",
    description: `${params.toolName} description`,
    arrey: ">=1.0.0",
    input: {
      value: "string?"
    },
    output: {
      echoed: "string?"
    },
    ...(params.manifest ?? {})
  });
}

function createMockProviderFactory(): ProviderFactory {
  return {
    async getProvider(_config: ProviderConfig) {
      return {
        complete: async (prompt: string) => `complete:${prompt}`
      };
    }
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => fs.remove(directory)));
});

describe("createRuntime", () => {
  it("composes tools through ctx.tool()", async () => {
    const projectRoot = await createTempDir();
    await scaffoldTool({
      projectRoot,
      toolName: "first",
      indexCode: `
export async function run(input, ctx) {
  return ctx.tool("second", input);
}
      `
    });
    await scaffoldTool({
      projectRoot,
      toolName: "second",
      indexCode: `
export async function run(input) {
  return { echoed: input.value };
}
      `
    });

    const runtime = createRuntime(
      {
        projectRoot,
        provider: {
          name: "openai",
          model: "gpt-4o-mini",
          apiKey: "test-key"
        },
        tools: { installed: ["first", "second"] }
      },
      { providerFactory: createMockProviderFactory() }
    );

    const result = await runtime.run("first", { value: "ok" });
    expect(result).toEqual({ echoed: "ok" });
  });

  it("creates a fresh context for each invocation", async () => {
    const projectRoot = await createTempDir();
    await scaffoldTool({
      projectRoot,
      toolName: "ctx-freshness",
      indexCode: `
let previous = null;
export async function run(_input, ctx) {
  const reused = previous === ctx;
  previous = ctx;
  return { echoed: reused ? "true" : "false" };
}
      `,
      manifest: {
        output: {
          echoed: "string"
        }
      }
    });

    const runtime = createRuntime(
      {
        projectRoot,
        provider: {
          name: "openai",
          model: "gpt-4o-mini",
          apiKey: "test-key"
        },
        tools: { installed: ["ctx-freshness"] }
      },
      { providerFactory: createMockProviderFactory() }
    );

    const first = await runtime.run("ctx-freshness", {});
    const second = await runtime.run("ctx-freshness", {});
    expect(first).toEqual({ echoed: "false" });
    expect(second).toEqual({ echoed: "false" });
  });

  it("excludes experimental tools from adapter auto-discovery", async () => {
    const projectRoot = await createTempDir();
    await scaffoldTool({
      projectRoot,
      toolName: "stable",
      indexCode: "export async function run() { return { echoed: 'ok' }; }"
    });
    await scaffoldTool({
      projectRoot,
      toolName: "experimental-tool",
      indexCode: "export async function run() { return { echoed: 'ok' }; }",
      manifest: {
        experimental: true
      }
    });

    const runtime = createRuntime(
      {
        projectRoot,
        provider: {
          name: "openai",
          model: "gpt-4o-mini",
          apiKey: "test-key"
        },
        tools: { installed: ["stable", "experimental-tool"] }
      },
      { providerFactory: createMockProviderFactory() }
    );

    const autoJson = await runtime.toJSON();
    expect(Object.keys(autoJson)).toEqual(["stable"]);

    const explicitJson = await runtime.toJSON(["experimental-tool"]);
    expect(Object.keys(explicitJson)).toEqual(["experimental-tool"]);
  });

  it("builds Vercel adapter definitions from manifest only", async () => {
    const projectRoot = await createTempDir();
    await scaffoldTool({
      projectRoot,
      toolName: "schema-tool",
      indexCode: "export async function run() { return { echoed: 'ok' }; }",
      manifest: {
        description: "Schema Tool",
        input: {
          text: "string"
        }
      }
    });

    const runtime = createRuntime(
      {
        projectRoot,
        provider: {
          name: "openai",
          model: "gpt-4o-mini",
          apiKey: "test-key"
        },
        tools: { installed: ["schema-tool"] }
      },
      { providerFactory: createMockProviderFactory() }
    );

    const tools = await runtime.toVercelAI(["schema-tool"]);
    expect(tools["schema-tool"].description).toBe("Schema Tool");
    expect(tools["schema-tool"].parameters).toEqual({
      type: "object",
      properties: {
        text: { type: "string" }
      },
      required: ["text"],
      additionalProperties: false
    });
  });
});
