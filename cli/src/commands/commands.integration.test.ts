import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { runAddCommand } from "./add";
import { runInitCommand } from "./init";
import { readConfigFile } from "../runtime/config-resolver";

const tempDirs: string[] = [];
const originalRegistryPath = process.env.ARREY_REGISTRY_PATH;

async function createTempDir(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

async function scaffoldRegistry(registryRoot: string): Promise<void> {
  await fs.ensureDir(path.join(registryRoot, "summarize"));
  await fs.writeJson(path.join(registryRoot, "tools.json"), ["summarize"]);
  await fs.writeJson(path.join(registryRoot, "summarize", "meta.json"), {
    name: "summarize",
    version: "1.0.0",
    files: ["index.ts", "prompt.ts", "manifest.json", "README.md"]
  });
  await fs.writeFile(
    path.join(registryRoot, "summarize", "index.ts"),
    "export async function run(input) { return { summary: input.text }; }\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(registryRoot, "summarize", "prompt.ts"),
    "export const SUMMARY_PROMPT = 'summary';\n",
    "utf8"
  );
  await fs.writeJson(path.join(registryRoot, "summarize", "manifest.json"), {
    name: "summarize",
    version: "1.0.0",
    description: "Summarize text",
    arrey: ">=1.0.0",
    input: {
      content: "string"
    },
    output: {
      summary: "string"
    }
  });
  await fs.writeFile(path.join(registryRoot, "summarize", "README.md"), "# summarize\n", "utf8");
}

afterEach(async () => {
  if (originalRegistryPath === undefined) {
    delete process.env.ARREY_REGISTRY_PATH;
  } else {
    process.env.ARREY_REGISTRY_PATH = originalRegistryPath;
  }
  await Promise.all(tempDirs.splice(0).map((directory) => fs.remove(directory)));
});

describe("CLI command integration", () => {
  it("init scaffolds arrey.config.yaml and arrey/tools", async () => {
    const projectRoot = await createTempDir("arrey-cli-init-");
    await runInitCommand(projectRoot, { install: false });

    expect(await fs.pathExists(path.join(projectRoot, "arrey", "tools"))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, "arrey.config.yaml"))).toBe(true);
  });

  it("add installs canonical tool files and updates config", async () => {
    const projectRoot = await createTempDir("arrey-cli-add-");
    const registryRoot = await createTempDir("arrey-registry-");
    await scaffoldRegistry(registryRoot);
    process.env.ARREY_REGISTRY_PATH = registryRoot;

    await runInitCommand(projectRoot, { install: false });
    await runAddCommand("summarize", projectRoot, { install: false });

    const toolRoot = path.join(projectRoot, "arrey", "tools", "summarize");
    expect(await fs.pathExists(path.join(toolRoot, "index.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(toolRoot, "prompt.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(toolRoot, "manifest.json"))).toBe(true);
    expect(await fs.pathExists(path.join(toolRoot, "README.md"))).toBe(true);

    const config = await readConfigFile(projectRoot);
    expect(config.tools.installed).toContain("summarize");
  });

  it("fails fast when legacy ai-tools layout exists", async () => {
    const projectRoot = await createTempDir("arrey-cli-legacy-");
    const registryRoot = await createTempDir("arrey-registry-");
    await scaffoldRegistry(registryRoot);
    process.env.ARREY_REGISTRY_PATH = registryRoot;

    await fs.ensureDir(path.join(projectRoot, "ai-tools"));
    await fs.writeFile(path.join(projectRoot, "ai-tools", "legacy.txt"), "legacy", "utf8");

    await expect(runAddCommand("summarize", projectRoot, { install: false })).rejects.toThrow(
      "Legacy tool layout detected"
    );
  });
});
