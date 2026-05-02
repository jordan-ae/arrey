import path from "node:path";
import fs from "fs-extra";

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

export interface ProjectDepsResult {
  addedDevDeps: string[];
  createdTsconfig: boolean;
  packageJsonExists: boolean;
}

export async function ensureProjectTypings(
  projectRoot: string
): Promise<ProjectDepsResult> {
  const result: ProjectDepsResult = {
    addedDevDeps: [],
    createdTsconfig: false,
    packageJsonExists: false
  };

  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  if (!(await fs.pathExists(tsconfigPath))) {
    await fs.writeJson(tsconfigPath, DEFAULT_TSCONFIG, { spaces: 2 });
    result.createdTsconfig = true;
  }

  const packageJsonPath = path.join(projectRoot, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) {
    return result;
  }

  result.packageJsonExists = true;
  const pkg = (await fs.readJson(packageJsonPath)) as Record<string, unknown>;
  const devDeps = (pkg.devDependencies as Record<string, string> | undefined) ?? {};
  const deps = (pkg.dependencies as Record<string, string> | undefined) ?? {};

  let mutated = false;
  for (const [name, version] of Object.entries(REQUIRED_DEV_DEPS)) {
    if (devDeps[name] || deps[name]) {
      continue;
    }
    devDeps[name] = version;
    result.addedDevDeps.push(name);
    mutated = true;
  }

  if (mutated) {
    pkg.devDependencies = devDeps;
    await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
  }

  return result;
}
