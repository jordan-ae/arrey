import chalk from "chalk";
import ora, { Ora } from "ora";

const prefix = chalk.bold.cyan("arrey");

function withPrefix(message: string): string {
  return `${prefix} ${message}`;
}

export const logger = {
  format: withPrefix,
  info(message: string): void {
    console.log(withPrefix(chalk.gray(message)));
  },
  success(message: string): void {
    console.log(withPrefix(chalk.green(message)));
  },
  warn(message: string): void {
    console.log(withPrefix(chalk.yellow(message)));
  },
  error(message: string): void {
    console.error(withPrefix(chalk.red(message)));
  },
  item(message: string): void {
    console.log(`  ${chalk.gray("-")} ${message}`);
  },
  spinner(message: string): Ora {
    return ora({ text: withPrefix(message), spinner: "dots" });
  }
};

