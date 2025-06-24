import * as z from "zod/v4";

export type MixFile = {
   [key: string]: {
        packages: MixPackage[];
    };
};

export type MixPackage = {
    id: string;
    version: string;
    config: {
        type: "raw" | "json";
        path: string;
        data: unknown;
    }[]
}

export const MixPackageSchema = z.object({
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

export const MixFileSchema = z.record(
    z.string(),
    z.object({
        packages: z.array(MixPackageSchema)
    })
);

export type MixLockFile = MixLockPackage[]

export type MixLockPackage = {
    id: string;
    version: string;
    config: {
        type: "raw" | "json";
        path: string;
        data: string;
    }[];
}

export const MixLockPackageSchema = z.object({
    id: z.string(),
    version: z.string(),
    config: z.array(z.object({
        type: z.enum(["raw", "json"]),
        path: z.string(),
        data: z.string()
    }))
});

export const MixLockFileSchema = z.array(MixLockPackageSchema);