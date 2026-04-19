import path from "node:path";
import fs from "fs-extra";
import { createJiti } from "jiti";
import { assertNoLegacyLayout } from "../core/layout";
import { LoadedTool, ToolManifest, ToolModule } from "./types";

const REQUIRED_FILES = ["index.ts", "prompt.ts", "manifest.json", "README.md"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertManifest(toolName: string, value: unknown): asserts value is ToolManifest {
  if (!isObject(value)) {
    throw new Error(`Invalid manifest for "${toolName}": expected an object.`);
  }

  if (value.name !== toolName) {
    throw new Error(
      `Invalid manifest for "${toolName}": "name" must match the folder name "${toolName}".`
    );
  }

  if (typeof value.version !== "string" || value.version.trim().length === 0) {
    throw new Error(`Invalid manifest for "${toolName}": "version" is required.`);
  }

  if (typeof value.description !== "string" || value.description.trim().length === 0) {
    throw new Error(`Invalid manifest for "${toolName}": "description" is required.`);
  }

  if (typeof value.arrey !== "string" || value.arrey.trim().length === 0) {
    throw new Error(`Invalid manifest for "${toolName}": "arrey" is required.`);
  }

  if (!isObject(value.input)) {
    throw new Error(`Invalid manifest for "${toolName}": "input" is required.`);
  }

  if (!isObject(value.output)) {
    throw new Error(`Invalid manifest for "${toolName}": "output" is required.`);
  }

  if (value.composes !== undefined) {
    if (!Array.isArray(value.composes) || value.composes.some((tool) => typeof tool !== "string")) {
      throw new Error(`Invalid manifest for "${toolName}": "composes" must be a string array.`);
    }
  }

  if (value.optionalDeps !== undefined) {
    if (
      !Array.isArray(value.optionalDeps) ||
      value.optionalDeps.some((dep) => typeof dep !== "string")
    ) {
      throw new Error(`Invalid manifest for "${toolName}": "optionalDeps" must be a string array.`);
    }
  }

  if (value.examples !== undefined) {
    if (!Array.isArray(value.examples)) {
      throw new Error(`Invalid manifest for "${toolName}": "examples" must be an array.`);
    }
  }

  if (value.experimental !== undefined && typeof value.experimental !== "boolean") {
    throw new Error(`Invalid manifest for "${toolName}": "experimental" must be a boolean.`);
  }

  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string")) {
      throw new Error(`Invalid manifest for "${toolName}": "tags" must be a string array.`);
    }
  }
}

async function assertRequiredFiles(toolDirectory: string, toolName: string): Promise<void> {
  for (const requiredFile of REQUIRED_FILES) {
    const filePath = path.join(toolDirectory, requiredFile);
    if (!(await fs.pathExists(filePath))) {
      throw new Error(
        `Tool "${toolName}" is missing required file "${requiredFile}" in ${toolDirectory}.`
      );
    }
  }
}

async function importToolModule(modulePath: string): Promise<unknown> {
  const jiti = createJiti(__filename, { interopDefault: true, esmResolve: true });
  return jiti.import(modulePath);
}

export async function loadTool(projectRoot: string, toolName: string): Promise<LoadedTool> {
  await assertNoLegacyLayout(projectRoot);

  const toolDirectory = path.join(projectRoot, "arrey", "tools", toolName);
  if (!(await fs.pathExists(toolDirectory))) {
    throw new Error(
      `Tool "${toolName}" is not installed. Expected directory "${toolDirectory}".`
    );
  }

  await assertRequiredFiles(toolDirectory, toolName);

  const manifestPath = path.join(toolDirectory, "manifest.json");
  const manifestData = await fs.readJson(manifestPath);
  assertManifest(toolName, manifestData);

  const modulePath = path.join(toolDirectory, "index.ts");
  const loaded = (await importToolModule(modulePath)) as Record<string, unknown>;
  const run = loaded.run;
  if (typeof run !== "function") {
    throw new Error(
      `Tool "${toolName}" must export a "run(input, ctx)" function from index.ts.`
    );
  }

  return {
    directory: toolDirectory,
    manifest: manifestData,
    module: {
      run: run as ToolModule["run"]
    }
  };
}

export async function discoverInstalledTools(projectRoot: string): Promise<string[]> {
  await assertNoLegacyLayout(projectRoot);

  const toolsRoot = path.join(projectRoot, "arrey", "tools");
  if (!(await fs.pathExists(toolsRoot))) {
    return [];
  }

  const entries = await fs.readdir(toolsRoot);
  const discovered: string[] = [];

  for (const entry of entries) {
    const directory = path.join(toolsRoot, entry);
    const stat = await fs.stat(directory);
    if (!stat.isDirectory()) {
      continue;
    }

    const manifestPath = path.join(directory, "manifest.json");
    if (!(await fs.pathExists(manifestPath))) {
      continue;
    }
    discovered.push(entry);
  }

  return discovered.sort((a, b) => a.localeCompare(b));
}
