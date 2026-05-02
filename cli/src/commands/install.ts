import { Command } from "commander";
import { ensureProjectConfig } from "../core/project-config";
import { runPackageInstall } from "../core/project-deps";
import { logger } from "../core/logger";
import { runAddCommand } from "./add";

export interface RunInstallCommandOptions {
  install?: boolean;
}

export async function runInstallCommand(
  projectRoot = process.cwd(),
  options: RunInstallCommandOptions = {}
): Promise<void> {
  const config = await ensureProjectConfig(projectRoot);
  const tools = config.tools.installed ?? [];

  if (tools.length === 0) {
    logger.warn("No tools are listed in arrey.config.yaml (tools.installed).");
    return;
  }

  logger.info(`Installing ${tools.length} tool(s) from arrey.config.yaml...`);

  for (const toolName of tools) {
    await runAddCommand(toolName, projectRoot, { install: false });
  }

  if (options.install !== false) {
    logger.info("Running package install...");
    await runPackageInstall(projectRoot);
  }
}

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description("Install all tools listed in arrey.config.yaml")
    .option("--no-install", "Skip running your package manager's install after writing dependencies")
    .action(async (options: { install?: boolean }) => {
      try {
        await runInstallCommand(process.cwd(), { install: options.install });
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
