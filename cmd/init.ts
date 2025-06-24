import type { Command } from "commander";
import { readdirSync, writeFileSync } from "fs";
import * as h from "hjson";

export const registerInitCommand = (p: Command) => {
    p
        .command("init")
        .action(() => {
            const dir = readdirSync(process.cwd(), { withFileTypes: true })
                .filter((dirent) => dirent.isFile() && (dirent.name.endsWith("mix.hjson") || dirent.name === "mix.lock"));
            if (dir.length > 0) {
                console.error("Error: Mix project already initialized. Please remove existing .mix.hjson or mix.lock files.");
                process.exit(1);
            }

            writeFileSync("mix.hjson", h.stringify({
                default: {
                    packages: []
                }
            }));

            writeFileSync("mix.lock", "[]");
        });
}