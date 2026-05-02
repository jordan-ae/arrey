import path from "node:path";
import fs from "fs-extra";
import axios, { AxiosError } from "axios";

const DEFAULT_REGISTRY_BASE_URL = "https://raw.githubusercontent.com/jordan-ae/arrey/main/registry";
const REGISTRY_BASE_URL = (process.env.ARREY_REGISTRY_BASE_URL ?? DEFAULT_REGISTRY_BASE_URL).replace(
  /\/+$/,
  ""
);
const REQUEST_HEADERS = { "User-Agent": "arrey-cli" };
const REQUEST_TIMEOUT_MS = 8000;

export interface ToolMeta {
  name: string;
  version: string;
  files: string[];
}

export class ToolNotFoundError extends Error {}
export class RegistryNetworkError extends Error {}
export class InvalidRegistryError extends Error {}

interface RegistrySource {
  kind: "local" | "remote";
  localPath?: string;
}

function isSafeRegistryPath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("\\")) {
    return false;
  }
  return !trimmed.split(/[\\/]/).includes("..");
}

function assertToolMeta(toolName: string, data: unknown): asserts data is ToolMeta {
  if (!data || typeof data !== "object") {
    throw new InvalidRegistryError("meta.json must be an object.");
  }

  const candidate = data as ToolMeta;
  if (candidate.name !== toolName) {
    throw new InvalidRegistryError(`meta.json name mismatch: expected "${toolName}".`);
  }
  if (typeof candidate.version !== "string" || candidate.version.trim().length === 0) {
    throw new InvalidRegistryError(`meta.json version is invalid for "${toolName}".`);
  }
  if (!Array.isArray(candidate.files) || candidate.files.length === 0) {
    throw new InvalidRegistryError(`meta.json files must be a non-empty array for "${toolName}".`);
  }

  for (const fileName of candidate.files) {
    if (typeof fileName !== "string" || !isSafeRegistryPath(fileName)) {
      throw new InvalidRegistryError(`meta.json contains an unsafe file path for "${toolName}".`);
    }
  }
}

async function resolveRegistrySource(projectRoot: string): Promise<RegistrySource> {
  const explicitPath = process.env.ARREY_REGISTRY_PATH;
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (await fs.pathExists(path.join(resolved, "tools.json"))) {
      return { kind: "local", localPath: resolved };
    }
    throw new InvalidRegistryError(
      `ARREY_REGISTRY_PATH is set but tools.json was not found at "${resolved}".`
    );
  }

  const candidate = path.join(projectRoot, "registry");
  if (await fs.pathExists(path.join(candidate, "tools.json"))) {
    return { kind: "local", localPath: candidate };
  }

  return { kind: "remote" };
}

function toRegistryError(
  error: unknown,
  options: { kind: "meta" | "file" | "index"; toolName?: string; fileName?: string }
): Error {
  if (!axios.isAxiosError(error)) {
    return new RegistryNetworkError("Registry request failed.");
  }

  const axiosError = error as AxiosError;
  const status = axiosError.response?.status;
  if (status === 404 && options.kind === "meta" && options.toolName) {
    return new ToolNotFoundError(`Tool "${options.toolName}" not found.`);
  }
  if (status === 404 && options.kind === "file" && options.toolName && options.fileName) {
    return new InvalidRegistryError(
      `Registry entry "${options.toolName}" is missing file "${options.fileName}".`
    );
  }
  if (status === 404 && options.kind === "index") {
    return new InvalidRegistryError(`Registry index not found at ${REGISTRY_BASE_URL}/tools.json.`);
  }
  if (status !== undefined) {
    return new InvalidRegistryError(`Registry returned status ${status}.`);
  }

  return new RegistryNetworkError(`Could not connect to registry at ${REGISTRY_BASE_URL}.`);
}

function buildToolUrl(toolName: string, fileName: string): string {
  const safeFilePath = fileName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${REGISTRY_BASE_URL}/${encodeURIComponent(toolName)}/${safeFilePath}`;
}

async function readLocalRegistryJson<T>(registryPath: string, relativePath: string): Promise<T> {
  const absolutePath = path.join(registryPath, relativePath);
  if (!(await fs.pathExists(absolutePath))) {
    throw new InvalidRegistryError(`Registry file not found: ${absolutePath}`);
  }
  return fs.readJson(absolutePath) as Promise<T>;
}

export async function fetchToolMeta(toolName: string, projectRoot = process.cwd()): Promise<ToolMeta> {
  const source = await resolveRegistrySource(projectRoot);

  if (source.kind === "local") {
    const parsed = await readLocalRegistryJson<unknown>(
      source.localPath!,
      path.join(toolName, "meta.json")
    );
    assertToolMeta(toolName, parsed);
    return parsed;
  }

  const url = buildToolUrl(toolName, "meta.json");
  try {
    const response = await axios.get<string>(url, {
      responseType: "text",
      timeout: REQUEST_TIMEOUT_MS,
      headers: REQUEST_HEADERS
    });
    const raw = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    const parsed = JSON.parse(raw) as unknown;
    assertToolMeta(toolName, parsed);
    return parsed;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new InvalidRegistryError(`meta.json for "${toolName}" is not valid JSON.`);
    }
    throw toRegistryError(error, { kind: "meta", toolName });
  }
}

export async function fetchToolFile(
  toolName: string,
  fileName: string,
  projectRoot = process.cwd()
): Promise<string> {
  const source = await resolveRegistrySource(projectRoot);

  if (source.kind === "local") {
    if (!isSafeRegistryPath(fileName)) {
      throw new InvalidRegistryError(`Unsafe registry file path "${fileName}".`);
    }
    const absolutePath = path.join(source.localPath!, toolName, fileName);
    if (!(await fs.pathExists(absolutePath))) {
      throw new InvalidRegistryError(
        `Registry entry "${toolName}" is missing file "${fileName}".`
      );
    }
    return fs.readFile(absolutePath, "utf8");
  }

  const url = buildToolUrl(toolName, fileName);
  try {
    const response = await axios.get<string>(url, {
      responseType: "text",
      timeout: REQUEST_TIMEOUT_MS,
      headers: REQUEST_HEADERS
    });
    return typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2);
  } catch (error: unknown) {
    throw toRegistryError(error, { kind: "file", toolName, fileName });
  }
}

export async function listTools(projectRoot = process.cwd()): Promise<string[]> {
  const source = await resolveRegistrySource(projectRoot);

  if (source.kind === "local") {
    const parsed = await readLocalRegistryJson<unknown>(source.localPath!, "tools.json");
    if (!Array.isArray(parsed)) {
      throw new InvalidRegistryError("tools.json must be an array of tool names.");
    }
    for (const toolName of parsed) {
      if (typeof toolName !== "string" || !isSafeRegistryPath(toolName)) {
        throw new InvalidRegistryError("tools.json contains an invalid tool name.");
      }
    }
    return [...parsed].sort((a, b) => a.localeCompare(b));
  }

  const url = `${REGISTRY_BASE_URL}/tools.json`;
  try {
    const response = await axios.get<string>(url, {
      responseType: "text",
      timeout: REQUEST_TIMEOUT_MS,
      headers: REQUEST_HEADERS
    });
    const raw = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new InvalidRegistryError("tools.json must be an array of tool names.");
    }
    for (const toolName of parsed) {
      if (typeof toolName !== "string" || !isSafeRegistryPath(toolName)) {
        throw new InvalidRegistryError("tools.json contains an invalid tool name.");
      }
    }
    return [...parsed].sort((a, b) => a.localeCompare(b));
  } catch (error: unknown) {
    if (error instanceof InvalidRegistryError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new InvalidRegistryError("tools.json is not valid JSON.");
    }
    throw toRegistryError(error, { kind: "index" });
  }
}
