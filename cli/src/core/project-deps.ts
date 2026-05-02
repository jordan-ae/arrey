import path from "node:path";
import { spawn } from "node:child_process";
import fs from "fs-extra";

const REQUIRED_DEPS: Record<string, string> = {
  "arrey-cli": "^0.2.2"
};

const REQUIRED_DEV_DEPS: Record<string, string> = {
  "@types/node": "^22.0.0",
  typescript: "^5.0.0"
};

const DEFAULT_TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "Bundler",
    lib: ["ES2022", "DOM"],
    types: ["node"],
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    allowImportingTsExtensions: false,
    noEmit: true
  },
  include: ["arrey/**/*.ts"]
};

const DEFAULT_PACKAGE_JSON = {
  name: "arrey-project",
  version: "0.0.0",
  private: true,
  type: "module"
};

export interface ProjectDepsResult {
  addedDeps: string[];
  addedDevDeps: string[];
  createdTsconfig: boolean;
  createdPackageJson: boolean;
}

async function hasArreyToolSource(projectRoot: string): Promise<boolean> {
  const toolsRoot = path.join(projectRoot, "arrey", "tools");
  if (!(await fs.pathExists(toolsRoot))) {
    return false;
  }

  const stack: string[] = [toolsRoot];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        return true;
      }
    }
  }

  return false;
}

export async function ensureProjectTypings(
  projectRoot: string
): Promise<ProjectDepsResult> {
  const result: ProjectDepsResult = {
    addedDeps: [],
    addedDevDeps: [],
    createdTsconfig: false,
    createdPackageJson: false
  };

  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  if (!(await fs.pathExists(tsconfigPath)) && (await hasArreyToolSource(projectRoot))) {
    await fs.writeJson(tsconfigPath, DEFAULT_TSCONFIG, { spaces: 2 });
    result.createdTsconfig = true;
  }

  const packageJsonPath = path.join(projectRoot, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) {
    await fs.writeJson(packageJsonPath, DEFAULT_PACKAGE_JSON, { spaces: 2 });
    result.createdPackageJson = true;
  }

  const pkg = (await fs.readJson(packageJsonPath)) as Record<string, unknown>;
  const deps = (pkg.dependencies as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg.devDependencies as Record<string, string> | undefined) ?? {};

  let mutated = false;

  for (const [name, version] of Object.entries(REQUIRED_DEPS)) {
    if (deps[name] || devDeps[name]) {
      continue;
    }
    deps[name] = version;
    result.addedDeps.push(name);
    mutated = true;
  }

  for (const [name, version] of Object.entries(REQUIRED_DEV_DEPS)) {
    if (devDeps[name] || deps[name]) {
      continue;
    }
    devDeps[name] = version;
    result.addedDevDeps.push(name);
    mutated = true;
  }

  if (mutated || result.createdPackageJson) {
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
    await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
  }

  return result;
}

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export async function detectPackageManager(projectRoot: string): Promise<PackageManager> {
  const candidates: Array<[string, PackageManager]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["package-lock.json", "npm"]
  ];

  for (const [file, manager] of candidates) {
    if (await fs.pathExists(path.join(projectRoot, file))) {
      return manager;
    }
  }

  return "npm";
}

export async function runPackageInstall(
  projectRoot: string,
  packageManager?: PackageManager
): Promise<void> {
  const manager = packageManager ?? (await detectPackageManager(projectRoot));
  const command = process.platform === "win32" ? `${manager}.cmd` : manager;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, ["install"], {
      cwd: projectRoot,
      stdio: "inherit"
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${manager} install exited with code ${code ?? "unknown"}`));
      }
    });
  });
}
