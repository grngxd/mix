import { exec } from "child_process";
import type { Command } from "commander";
import { createHash } from "crypto";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import * as h from "hjson";
import { homedir } from "os";
import path from "path";
import { isDev } from "../lib";

export const registerSyncCommand = (p: Command) => {
    p
        .command("sync")
        .action(() => {
            const mixDir = isDev
                ? process.cwd()
                : path.join(homedir(), ".mix");

            const getMixFiles = (): { name: string, content: MixFile }[] => {
                return readdirSync(mixDir, { withFileTypes: true })
                    .filter(d => d.isFile() && d.name.endsWith("mix.hjson") && !d.name.startsWith("_"))
                    .map(d => ({
                        name: d.name,
                        content: h.parse(readFileSync(path.join(mixDir, d.name), "utf-8"))
                    }));
            };

            const mergeMixFiles = (files: MixFile[]): MixFile => {
                const merged: MixFile = {};

                for (const file of files) {
                    for (const group in file) {
                        if (!merged[group]) {
                            merged[group] = { packages: [] };
                        }

                        const packageToCheck = file[group]?.packages?.[0];
                        const existingPackage = packageToCheck
                            ? merged[group].packages.find(pkg => pkg.id === packageToCheck.id)
                            : undefined;

                        if (existingPackage) {
                            throw new Error(`Duplicate package id found: ${packageToCheck!.id} in group ${group}`);
                        }

                        if (file[group]?.packages) {
                            merged[group].packages.push(...file[group].packages);
                        }
                    }
                }

                return merged;
            }

            const getLockFile = (): MixLockFile => {
                return h.parse(
                    readFileSync(path.join(mixDir, "mix.lock"), "utf-8")
                );
            };

            const diff = (file: MixFile, lock: MixLockFile) => {
                const toInstall: MixPackage[] = [];
                const toRemove: MixLockFile = [];
                const toUpdate: MixPackage[] = [];
                const toConfig: MixPackage[] = [];

                const pkgs = Object.values(file).flatMap(g => g.packages);

                // install
                for (const pkg of pkgs) {
                    if (!lock.find(l => l.id === pkg.id)) toInstall.push(pkg);
                }

                // remove / update / config
                for (const existing of lock) {
                    const pkg = pkgs.find(p => p.id === existing.id);
                    if (!pkg) {
                        toRemove.push(existing);
                        continue;
                    }

                    // version changed?
                    if (pkg.version !== existing.version) {
                        toUpdate.push(pkg);
                        continue;
                    }

                    // config changed?
                    for (const newCfg of pkg.config) {
                        const lockCfg = existing.config.find(c => c.path === newCfg.path);
                        const dataChanged = (() => {
                            if (!lockCfg) return true;
                            if (newCfg.type === "raw") {
                                return createHash("sha3-256").update(newCfg.data as string, "utf8").digest("hex") !== lockCfg.data;
                            } else {
                                return JSON.stringify(newCfg.data) !== JSON.stringify(lockCfg.data);
                            }
                        })();

                        if (!lockCfg || lockCfg.type !== newCfg.type || dataChanged) {
                            toConfig.push(pkg);
                            break;
                        }
                    }
                }

                return [toInstall, toRemove, toUpdate, toConfig] as const;
            };

            const mixfile = mergeMixFiles(getMixFiles().map(file => file.content));
            const lock = getLockFile();

            const [ installing, removing, updating, configuring ] = diff(mixfile, lock);

            for (const pkg of installing) {
                console.log(`Installing ${pkg.id} version ${pkg.version}`);
                exec(`winget install --id ${pkg.id} --version ${pkg.version}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error installing ${pkg.id}: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        console.error(`Error output for ${pkg.id}: ${stderr}`);
                        return;
                    }
                    console.log(`Installed ${pkg.id} version ${pkg.version}`);

                    
                    const l: MixLockPackage = {
                        id: pkg.id,
                        version: pkg.version,
                        config: []
                    }

                    lock.push(l);
                    const content = h.stringify(lock);
                    const mixDir = isDev ? "" : path.join(homedir(), ".mix");
                    writeFileSync(path.join(mixDir, "mix.lock"), content, "utf-8");
                });
            }

            for (const pkg of removing) {
                console.log(`Removing ${pkg.id}`);
                exec(`winget uninstall ${pkg.id}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error uninstalling ${pkg.id}: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        console.error(`Error output for ${pkg.id}: ${stderr}`);
                        return;
                    }
                    console.log(`Uninstalled ${pkg.id}`);

                    const index = lock.findIndex(l => l.id === pkg.id);
                    if (index !== -1) {
                        lock.splice(index, 1);
                        const content = h.stringify(lock);
                        const mixDir = isDev ? "" : path.join(homedir(), ".mix");
                        writeFileSync(path.join(mixDir, "mix.lock"), content, "utf-8");
                    }
                });
            }

            for (const pkg of updating) {
                console.log(`Updating ${pkg.id} to version ${pkg.version}`);
                exec(`winget upgrade ${pkg.id} --version ${pkg.version}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error updating ${pkg.id}: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        console.error(`Error output for ${pkg.id}: ${stderr}`);
                        return;
                    }
                    console.log(`Updated ${pkg.id} to version ${pkg.version}`);

                    const index = lock.findIndex(l => l.id === pkg.id);
                    if (index !== -1 && lock[index]) {
                        lock[index]!.version = pkg.version;
                    } else {
                        const l: MixLockPackage = {
                            id: pkg.id,
                            version: pkg.version,
                            config: []
                        };

                        lock.push(l);
                    }

                    const content = h.stringify(lock);
                    const mixDir = isDev ? "" : path.join(homedir(), ".mix");
                    writeFileSync(path.join(mixDir, "mix.lock"), content, "utf-8");
                });
            }
        });
}

type MixFile = {
   [key: string]: {
        packages: MixPackage[];
    };
};

type MixPackage = {
    id: string;
    version: string;
    config: {
        type: "raw" | "json";
        path: string;
        data: unknown;
    }[]
}

type MixLockFile = MixLockPackage[]

type MixLockPackage = {
    id: string;
    version: string;
    config: {
        type: "raw" | "json";
        path: string;
        data: string;
    }[];
}