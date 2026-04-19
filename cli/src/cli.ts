#!/usr/bin/env node

import { Command } from "commander";
import { registerAddCommand } from "./commands/add";
import { registerInitCommand } from "./commands/init";
import { registerInstallCommand } from "./commands/install";
import { registerListCommand } from "./commands/list";
import { logger } from "./core/logger";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("arrey")
    .description("Install production-ready AI tools as editable code.")
    .version("0.2.0")
    .showHelpAfterError();

  registerInitCommand(program);
  registerAddCommand(program);
  registerInstallCommand(program);
  registerListCommand(program);

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error(message);
  process.exitCode = 1;
});
