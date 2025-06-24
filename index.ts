import { Command } from 'commander';
import { registerCommands } from './cmd';

const program = new Command();

program
  .name('mix')
  .description('a declerative file-based package manager for windows.')
  .version('0.0.4', '-v, --version', 'output the current version');

registerCommands(program);
program.parse();