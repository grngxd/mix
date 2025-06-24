import { Command } from 'commander';
import { registerCommands } from './cmd';

const program = new Command();

program
  .name('string-util')
  .description('CLI to some JavaScript string utilities')
  .version('0.8.0');

registerCommands(program);

program.parse();