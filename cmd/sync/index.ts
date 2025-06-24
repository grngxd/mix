import { exec } from "child_process";
import type { Command } from "commander";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import * as h from "hjson";
import { homedir } from "os";
import path from "path";
import { isDev } from "../../lib";
import { type MixFile, MixFileSchema, type MixLockFile, MixLockFileSchema, type MixLockPackage, type MixPackage } from "./types";

export const registerSyncCommand = (p: Command) => {
    p
        .command("sync")
        .action(() => {
            const files = getMixFiles();
            if (files.length === 0) {
                console.log("No mix files found.");
                return;
            }

            const merged = mergeMixFiles(files.map(f => f.content));
            const lock = getLockFile();
            
            const { toInstall, toRemove } = diff(merged, lock)

            if (toInstall.length === 0 && toRemove.length === 0) {
                console.log("No changes detected. Everything is up to date.");
                return;
            }

            if (toInstall.length > 0) {
                toInstall.forEach(async (pkg) =>{
                    console.log(`Installing ${pkg.id}@${pkg.version}`);
                    await installPackage(lock, pkg.id, pkg.version);
                });
            }

            if (toRemove.length > 0) {
                toRemove.forEach(async (pkg) => {
                    console.log(`Removing ${pkg.id}@${pkg.version}`);
                    await removePackage(lock, pkg.id, pkg.version);
                });
            }
        });
}

const mixDir = isDev
                ? process.cwd()
                : path.join(homedir(), ".mix");

const getMixFiles = (): { name: string, content: MixFile }[] => {
    return readdirSync(mixDir, { withFileTypes: true })
        .filter(d => d.isFile() && d.name.endsWith("mix.hjson") && !d.name.startsWith("_"))
        .map(d => ({
            name: d.name,
            content: MixFileSchema.parse(
                h.parse(readFileSync(path.join(mixDir, d.name), "utf-8"))
            )
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

    return MixFileSchema.parse(merged);
}

const getLockFile = (): MixLockFile => {
    return MixLockFileSchema.parse(h.parse(
        readFileSync(path.join(mixDir, "mix.lock"), "utf-8")
    ));
};

const saveLockFile = (lock: MixLockFile) => {
    const lockFilePath = path.join(mixDir, "mix.lock");
    const lockContent = h.stringify(lock, { space: 2 });
    writeFileSync(lockFilePath, lockContent, "utf-8");
}

const diff = (mix: MixFile, lock: MixLockFile) => {
    const mixPkgs = Object.values(mix).flatMap(g => g.packages)

    const toInstall: MixPackage[] = [];
    const toRemove: MixLockPackage[] = [];

    for (const pkg of mixPkgs) {
        if (!lock.find(l => l.id === pkg.id && l.version === pkg.version)) {
            toInstall.push(pkg);
        }
    }

    for (const pkg of lock) {
        if (!mixPkgs.find(m => m.id === pkg.id && m.version === pkg.version)) {
            toRemove.push(pkg);
        }
    }

    return {
        toInstall,
        toRemove
    }
}

const installPackage = async (lock: MixLockFile, id: string, version: string) => {
    await exec(`winget install --id ${id} --version ${version} --exact --silent --force --disable-interactivity`, (error, _, e) => {
        if (error) {
            console.error(`Error installing package ${id}@${version}:`, error);
            return;
        }

        const pkg: MixLockPackage = {
            id,
            version,
            config: []
        }

        lock.push(pkg);
        saveLockFile(lock);

        console.log(`Successfully installed ${id}@${version}`);
        e && console.error(e);
    });
};

const removePackage = async (lock: MixLockFile, id: string, version: string) => {
    exec(`winget remove --id ${id} --version ${version} --silent`, (error, _, e) => {
        if (error) {
            console.error(`Error removing package ${id}@${version}:`, error);
            return;
        }

        const index = lock.findIndex(pkg => pkg.id === id && pkg.version === version);
        if (index !== -1) {
            lock.splice(index, 1);
            saveLockFile(lock);
            console.log(`Successfully removed ${id}@${version}`);
        } else {
            console.warn(`Package ${id}@${version} not found in lock file.`);
        }
        
        e && console.error(e);
    });
}