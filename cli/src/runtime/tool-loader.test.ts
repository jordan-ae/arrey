import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { discoverInstalledTools, loadTool } from "./tool-loader";

const createdDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "arrey-loader-test-"));
  createdDirs.push(directory);
  return directory;
}

async function scaffoldTool(
  projectRoot: string,
  toolName: string,
  options: { withRun?: boolean } = {}
): Promise<void> {
  const toolDir = path.join(projectRoot, "arrey", "tools", toolName);
  await fs.ensureDir(toolDir);

  await fs.writeJson(path.join(toolDir, "manifest.json"), {
    name: toolName,
    version: "0.1.0",
    description: `${toolName} tool`,
    arrey: ">=1.0.0",
    input: {
      value: "string?"
    },
    output: {
      input: { type: "object", fields: { value: "string?" } }
    }
  });
  await fs.writeFile(path.join(toolDir, "prompt.ts"), "export const PROMPT = 'hello';\n", "utf8");
  await fs.writeFile(path.join(toolDir, "README.md"), `# ${toolName}\n`, "utf8");

  if (options.withRun ?? true) {
    await fs.writeFile(
      path.join(toolDir, "index.ts"),
      "export async function run(input) { return { input }; }\n",
      "utf8"
    );
  } else {
    await fs.writeFile(path.join(toolDir, "index.ts"), "export const missing = true;\n", "utf8");
  }
}

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((directory) => fs.remove(directory)));
});

describe("tool-loader", () => {
  it("loads valid tools with manifest and run export", async () => {
    const projectRoot = await createTempDir();
    await scaffoldTool(projectRoot, "demo");

    const loaded = await loadTool(projectRoot, "demo");

    expect(loaded.manifest.name).toBe("demo");
    const result = await loaded.module.run({ hello: "world" }, {} as never);
    expect(result).toEqual({ input: { hello: "world" } });
  });

  it("fails when run export is missing", async () => {
    const projectRoot = await createTempDir();
    await scaffoldTool(projectRoot, "broken", { withRun: false });

    await expect(loadTool(projectRoot, "broken")).rejects.toThrow(
      "must export a \"run(input, ctx)\" function"
    );
  });

  it("fails fast when legacy ai-tools layout exists", async () => {
    const projectRoot = await createTempDir();
    await scaffoldTool(projectRoot, "demo");
    await fs.ensureDir(path.join(projectRoot, "ai-tools"));
    await fs.writeFile(path.join(projectRoot, "ai-tools", "legacy.txt"), "legacy", "utf8");

    await expect(loadTool(projectRoot, "demo")).rejects.toThrow("Legacy tool layout detected");
  });

  it("discovers installed tools from arrey/tools", async () => {
    const projectRoot = await createTempDir();
    await scaffoldTool(projectRoot, "alpha");
    await scaffoldTool(projectRoot, "beta");

    const discovered = await discoverInstalledTools(projectRoot);
    expect(discovered).toEqual(["alpha", "beta"]);
  });
});
