import { Command } from "commander";
import { logger } from "../core/logger";
import { loadProjectConfig } from "../core/project-config";
import { InvalidRegistryError, listTools, RegistryNetworkError } from "../core/registry";

export async function runListCommand(projectRoot = process.cwd()): Promise<void> {
  const spinner = logger.spinner("Fetching available tools");
  spinner.start();

  try {
    const [availableTools, projectConfig] = await Promise.all([
      listTools(projectRoot),
      loadProjectConfig(projectRoot)
    ]);
    spinner.stop();

    if (availableTools.length === 0) {
      logger.warn("No tools found in registry.");
      return;
    }

    const installed = new Set(projectConfig.tools.installed ?? []);
    logger.success(`Available tools (${availableTools.length}):`);
    for (const tool of availableTools) {
      const suffix = installed.has(tool) ? " (installed)" : "";
      logger.item(`${tool}${suffix}`);
    }
  } catch (error: unknown) {
    spinner.stop();

    if (error instanceof RegistryNetworkError) {
      logger.error(error.message);
    } else if (error instanceof InvalidRegistryError) {
      logger.error(error.message);
    } else if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error("Unknown listing error.");
    }

    throw error;
  }
}

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List available registry tools and local installation status")
    .action(async () => {
      try {
        await runListCommand(process.cwd());
      } catch {
        process.exitCode = 1;
      }
    });
}
