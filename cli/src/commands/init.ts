import path from "node:path";
import fs from "fs-extra";
import { Command } from "commander";
import { assertNoLegacyLayout } from "../core/layout";
import { ensureProjectConfig } from "../core/project-config";
import { logger } from "../core/logger";

export async function runInitCommand(projectRoot = process.cwd()): Promise<void> {
  await assertNoLegacyLayout(projectRoot);

  const spinner = logger.spinner("Initializing Arrey project");
  spinner.start();

  try {
    await fs.ensureDir(path.join(projectRoot, "arrey", "tools"));
    await ensureProjectConfig(projectRoot);
    spinner.succeed(logger.format("Initialized arrey.config.yaml and arrey/tools/"));
  } catch (error: unknown) {
    spinner.stop();
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error("Unknown init error.");
    }
    throw error;
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize arrey.config.yaml and the arrey/tools workspace")
    .action(async () => {
      try {
        await runInitCommand(process.cwd());
      } catch {
        process.exitCode = 1;
      }
    });
}
