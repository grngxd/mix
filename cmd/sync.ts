import type { Command } from "commander";
import { readdirSync, readFileSync } from "fs";
import * as h from "hjson";
import { homedir } from "os";
import path from "path";
import * as z from "zod/v4";
import { isDev } from "../lib";

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

            console.log("files", h.stringify(merged));
            console.log("lock", h.stringify(lock));
            
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

const MixPackageSchema = z.object({
    id: z.string(),
    version: z.string(),
    config: z.array(z.object({
        type: z.enum(["raw", "json"]),
        path: z.string(),
        data: z.unknown()
    }))
    .optional()
    .default([]),
});

const MixFileSchema = z.record(
    z.string(),
    z.object({
        packages: z.array(MixPackageSchema)
    })
);

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

const MixLockPackageSchema = z.object({
    id: z.string(),
    version: z.string(),
    config: z.array(z.object({
        type: z.enum(["raw", "json"]),
        path: z.string(),
        data: z.string()
    }))
});

const MixLockFileSchema = z.array(MixLockPackageSchema);