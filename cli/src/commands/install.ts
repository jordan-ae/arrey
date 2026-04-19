import { Command } from "commander";
import { ensureProjectConfig } from "../core/project-config";
import { logger } from "../core/logger";
import { runAddCommand } from "./add";

export async function runInstallCommand(projectRoot = process.cwd()): Promise<void> {
  const config = await ensureProjectConfig(projectRoot);
  const tools = config.tools.installed ?? [];

  if (tools.length === 0) {
    logger.warn("No tools are listed in arrey.config.yaml (tools.installed).");
    return;
  }

  logger.info(`Installing ${tools.length} tool(s) from arrey.config.yaml...`);

  for (const toolName of tools) {
    await runAddCommand(toolName, projectRoot);
  }
}

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description("Install all tools listed in arrey.config.yaml")
    .action(async () => {
      try {
        await runInstallCommand(process.cwd());
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error(error.message);
        } else {
          logger.error("Unknown install error.");
        }
        process.exitCode = 1;
      }
    });
}
