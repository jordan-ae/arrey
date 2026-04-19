import path from "node:path";
import fs from "fs-extra";
import { assertNoLegacyLayout } from "./layout";

interface InstallFile {
  fileName: string;
  content: string;
}

interface InstallToolFilesOptions {
  projectRoot: string;
  toolName: string;
  files: InstallFile[];
}

interface InstallToolFilesResult {
  toolDirectory: string;
  createdFiles: string[];
  skippedFiles: string[];
}

function resolveSafeFilePath(baseDirectory: string, fileName: string): string {
  const normalized = path.normalize(fileName);

  if (path.isAbsolute(normalized) || normalized.startsWith("..")) {
    throw new Error(`Unsafe file path in registry: ${fileName}`);
  }

  return path.join(baseDirectory, normalized);
}

export async function installToolFiles(
  options: InstallToolFilesOptions
): Promise<InstallToolFilesResult> {
  await assertNoLegacyLayout(options.projectRoot);

  const toolDirectory = path.join(options.projectRoot, "arrey", "tools", options.toolName);
  await fs.ensureDir(toolDirectory);

  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const file of options.files) {
    const destination = resolveSafeFilePath(toolDirectory, file.fileName);
    const relativeDestination = path.relative(options.projectRoot, destination);

    if (await fs.pathExists(destination)) {
      skippedFiles.push(relativeDestination);
      continue;
    }

    await fs.outputFile(destination, file.content, "utf8");
    createdFiles.push(relativeDestination);
  }

  return {
    toolDirectory,
    createdFiles,
    skippedFiles
  };
}
