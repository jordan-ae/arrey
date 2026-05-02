import path from "node:path";
import fs from "fs-extra";
import { Command } from "commander";
import { assertNoLegacyLayout } from "../core/layout";
import { ensureProjectConfig } from "../core/project-config";
import { ensureProjectTypings, runPackageInstall } from "../core/project-deps";
import { logger } from "../core/logger";

export interface RunInitCommandOptions {
  install?: boolean;
}

export async function runInitCommand(
  projectRoot = process.cwd(),
  options: RunInitCommandOptions = {}
): Promise<void> {
  await assertNoLegacyLayout(projectRoot);

  const spinner = logger.spinner("Initializing Arrey project");
  spinner.start();

  let typings;
  try {
    await fs.ensureDir(path.join(projectRoot, "arrey", "tools"));
    await ensureProjectConfig(projectRoot);
    typings = await ensureProjectTypings(projectRoot);
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

  if (typings.createdPackageJson) {
    logger.info("Created package.json (no existing one was found).");
  }
  if (typings.createdTsconfig) {
    logger.info("Created tsconfig.json with Node typings enabled.");
  }

  const addedDeps = [...typings.addedDeps, ...typings.addedDevDeps];
  if (addedDeps.length === 0) {
    return;
  }

  if (options.install === false) {
    logger.info(
      `Added to package.json: ${addedDeps.join(", ")}. Run \`npm install\` to fetch them.`
    );
    return;
  }

  logger.info(`Added to package.json: ${addedDeps.join(", ")}. Running install...`);
  try {
    await runPackageInstall(projectRoot);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Install failed: ${error.message}`);
    } else {
      logger.error("Install failed.");
    }
    throw error;
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize arrey.config.yaml and the arrey/tools workspace")
    .option("--no-install", "Skip running your package manager's install after writing dependencies")
    .action(async (options: { install?: boolean }) => {
      try {
        await runInitCommand(process.cwd(), { install: options.install });
      } catch {
        process.exitCode = 1;
      }
    });
}
