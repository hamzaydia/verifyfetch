#!/usr/bin/env node

/**
 * VerifyFetch CLI
 *
 * Commands:
 *   sign     Generate SRI hashes and create/update manifest
 *   enforce  Verify manifest matches actual files (for CI)
 *   init     Initialize VerifyFetch in a project
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { signCommand } from './commands/sign.js';
import { enforceCommand } from './commands/enforce.js';
import { initCommand } from './commands/init.js';

const VERSION = '0.1.0';

// ASCII Art Banner
const BANNER = `
${chalk.green(` _    __          _ ____      ______     __       __`)}
${chalk.green(`| |  / /__  _____(_) __/_  __/ ____/__  / /______/ /_`)}
${chalk.green(`| | / / _ \\/ ___/ / /_/ / / / /_  / _ \\/ __/ ___/ __ \\`)}
${chalk.green(`| |/ /  __/ /  / / __/ /_/ / __/ /  __/ /_/ /__/ / / /`)}
${chalk.green(`|___/\\___/_/  /_/_/  \\__, /_/    \\___/\\__/\\___/_/ /_/`)}
${chalk.green(`                    /____/`)}  ${chalk.dim('v' + VERSION)}

${chalk.cyan('Verify any file you fetch—before you trust it.')}

${chalk.dim('Star us:')} ${chalk.underline('https://github.com/hamzaydia/verifyfetch')}
${chalk.dim('Sponsor:')} ${chalk.underline('https://github.com/sponsors/hamzaydia')}
`;

// Create the main program
const program = new Command()
  .name('verifyfetch')
  .description('Generate and enforce integrity hashes for your assets')
  .version(VERSION, '-v, --version', 'Display version number')
  .addHelpText('beforeAll', BANNER)
  .configureHelp({
    sortSubcommands: true,
    sortOptions: true,
  });

// Add commands
program.addCommand(signCommand);
program.addCommand(enforceCommand);
program.addCommand(initCommand);

// Show banner and help if no args
if (process.argv.length <= 2) {
  console.log(BANNER);
  program.outputHelp();
  process.exit(0);
}

// Parse arguments
program.parse(process.argv);
