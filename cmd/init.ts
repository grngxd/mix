import type { Command } from "commander";
import { readdirSync, writeFileSync } from "fs";
import * as h from "hjson";
import { homedir } from "os";
import path from "path";
import { isDev } from "../lib";

export const registerInitCommand = (p: Command) => {
    p
        .command("init")
        .action(() => {
            const dir = readdirSync(process.cwd(), { withFileTypes: true })
                .filter((dirent) => dirent.isFile() && (dirent.name.endsWith("mix.hjson") || dirent.name === "mix.lock") && !dirent.name.startsWith("_"));
            if (dir.length > 0) {
                console.error("Error: Mix project already initialized. Please remove existing .mix.hjson or mix.lock files.");
                process.exit(1);
            }

            // userhomedir/.mix/mix.hjson
            const mixDir = isDev ? "" : path.join(homedir(), ".mix");
            writeFileSync(path.join(mixDir, "mix.hjson"), h.stringify({
                default: {
                    packages: []
                }
            }));

            writeFileSync(path.join(mixDir, "mix.lock"), "[]");
        });
}