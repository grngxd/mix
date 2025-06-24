import type { Command } from "commander";
import { registerSyncCommand } from "./sync";

export const registerCommands = (p: Command) => {
    registerSyncCommand(p); 
}