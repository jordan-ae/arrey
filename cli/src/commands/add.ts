import path from "node:path";
import { Command } from "commander";
import { installToolFiles } from "../core/installer";
import { addInstalledToolToConfig } from "../core/project-config";
import { ensureProjectTypings } from "../core/project-deps";
import { logger } from "../core/logger";
import {
  fetchToolFile,
  fetchToolMeta,
  InvalidRegistryError,
  RegistryNetworkError,
  ToolNotFoundError
} from "../core/registry";

function normalizeToolName(tool: string): string {
  return tool.trim().toLowerCase();
}

export async function runAddCommand(
  rawToolName: string,
  projectRoot = process.cwd()
): Promise<void> {
  const toolName = normalizeToolName(rawToolName);

  const spinner = logger.spinner(`Fetching ${toolName} metadata`);
  spinner.start();

  try {
    const meta = await fetchToolMeta(toolName, projectRoot);
    spinner.text = logger.format(`Downloading ${meta.files.length} file(s) for ${toolName}`);

    const files = await Promise.all(
      meta.files.map(async (fileName) => {
        const content = await fetchToolFile(toolName, fileName, projectRoot);
        return { fileName, content };
      })
    );

    spinner.text = logger.format(`Installing ${toolName}`);
    const result = await installToolFiles({
      projectRoot,
      toolName,
      files
    });
    await addInstalledToolToConfig(projectRoot, toolName);
    const typings = await ensureProjectTypings(projectRoot);

    const relativeTarget = path.relative(projectRoot, result.toolDirectory) || result.toolDirectory;
    spinner.succeed(logger.format(`Installed ${toolName} -> ${relativeTarget}`));

    if (result.createdFiles.length > 0) {
      logger.success(`Created ${result.createdFiles.length} file(s):`);
      for (const file of result.createdFiles) {
        logger.item(file);
      }
    }

    if (result.skippedFiles.length > 0) {
      logger.warn(`Skipped ${result.skippedFiles.length} existing file(s):`);
      for (const file of result.skippedFiles) {
        logger.item(file);
      }
    }

    if (typings.createdTsconfig) {
      logger.info("Created tsconfig.json with Node typings enabled.");
    }
    if (typings.addedDevDeps.length > 0) {
      logger.info(
        `Added devDependencies: ${typings.addedDevDeps.join(", ")}. Run your package manager's install to fetch them.`
      );
    }
  } catch (error: unknown) {
    spinner.stop();

    if (error instanceof ToolNotFoundError) {
      logger.error(`Tool "${toolName}" was not found in the registry.`);
    } else if (error instanceof RegistryNetworkError) {
      logger.error(error.message);
    } else if (error instanceof InvalidRegistryError) {
      logger.error(error.message);
    } else if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error("Unknown installation error.");
    }

    throw error;
  }
}

export function registerAddCommand(program: Command): void {
  program
    .command("add")
    .argument("<tool>", "Tool name to install")
    .description("Install a registry tool into arrey/tools/<tool>")
    .action(async (rawToolName: string) => {
      try {
        await runAddCommand(rawToolName, process.cwd());
      } catch {
        process.exitCode = 1;
      }
    });
}
