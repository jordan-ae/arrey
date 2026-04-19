import path from "node:path";
import fs from "fs-extra";
import { MemoryEntry, MemoryStore } from "./types";

interface StoredValue {
  value: string;
  expiresAt?: number;
}

type MemoryState = Record<string, StoredValue>;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function similarity(query: string, value: string): number {
  const queryTokens = new Set(tokenize(query));
  const valueTokens = new Set(tokenize(value));
  if (queryTokens.size === 0 || valueTokens.size === 0) {
    return 0;
  }

  let hits = 0;
  for (const token of queryTokens) {
    if (valueTokens.has(token)) {
      hits += 1;
    }
  }
  return hits / queryTokens.size;
}

export class FileMemoryStore implements MemoryStore {
  private readonly storagePath: string;

  constructor(projectRoot: string) {
    this.storagePath = path.join(projectRoot, ".arrey", "memory.json");
  }

  private async readState(): Promise<MemoryState> {
    if (!(await fs.pathExists(this.storagePath))) {
      return {};
    }

    const parsed = await fs.readJson(this.storagePath);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as MemoryState;
  }

  private async writeState(state: MemoryState): Promise<void> {
    await fs.ensureDir(path.dirname(this.storagePath));
    await fs.writeJson(this.storagePath, state, { spaces: 2 });
  }

  private isExpired(value: StoredValue): boolean {
    return typeof value.expiresAt === "number" && value.expiresAt <= Date.now();
  }

  private async pruneAndPersist(state: MemoryState): Promise<MemoryState> {
    const next: MemoryState = {};
    let changed = false;

    for (const [key, entry] of Object.entries(state)) {
      if (this.isExpired(entry)) {
        changed = true;
        continue;
      }
      next[key] = entry;
    }

    if (changed) {
      await this.writeState(next);
    }

    return next;
  }

  async get(key: string): Promise<string | null> {
    const state = await this.pruneAndPersist(await this.readState());
    const entry = state[key];
    if (!entry) {
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const state = await this.pruneAndPersist(await this.readState());
    const expiresAt =
      typeof ttl === "number" && ttl > 0 ? Date.now() + ttl * 1000 : undefined;
    state[key] = { value, expiresAt };
    await this.writeState(state);
  }

  async delete(key: string): Promise<void> {
    const state = await this.pruneAndPersist(await this.readState());
    if (!(key in state)) {
      return;
    }
    delete state[key];
    await this.writeState(state);
  }

  async list(prefix?: string): Promise<string[]> {
    const state = await this.pruneAndPersist(await this.readState());
    const keys = Object.keys(state).sort((a, b) => a.localeCompare(b));
    if (!prefix) {
      return keys;
    }
    return keys.filter((key) => key.startsWith(prefix));
  }

  async search(query: string, topK = 5): Promise<MemoryEntry[]> {
    const state = await this.pruneAndPersist(await this.readState());
    const ranked = Object.entries(state)
      .map(([key, entry]) => ({
        key,
        value: entry.value,
        score: Number(similarity(query, entry.value).toFixed(3))
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
      .slice(0, Math.max(1, topK));

    return ranked;
  }
}

export function createMemoryStore(projectRoot: string): MemoryStore {
  return new FileMemoryStore(projectRoot);
}
