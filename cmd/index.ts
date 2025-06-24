import type { Command } from "commander";
import { registerInitCommand } from "./init";
import { registerSyncCommand } from "./sync";

export const registerCommands = (p: Command) => {
    registerSyncCommand(p);
    registerInitCommand(p);
}