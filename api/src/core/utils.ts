// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Os, RuntimePlatform } from "./types";

export type OmitFromExisting<T, K extends keyof T> = Omit<T, K>;

const stringOfArrayIncluded = (stringArray: Array<string>, text: string): boolean => {
    return stringArray.some((arg: string) => {
        return text.includes(arg);
    });
};

export const resolveOsAndPlatforms = (
    keywords: string[]
): { operatingSystems: Partial<Record<Os, boolean>>; runtimePlatforms: RuntimePlatform[] } => {
    const searchString = keywords.join("").toLocaleLowerCase();

    if (searchString.includes("docker")) {
        return { operatingSystems: {}, runtimePlatforms: ["cloud"] };
    }

    const linux = stringOfArrayIncluded(["linux", "ubuntu", "unix", "multiplatform", "all"], searchString);
    const windows = stringOfArrayIncluded(["windows", "multiplatform", "all"], searchString);
    const mac = stringOfArrayIncluded(["mac", "unix", "multiplatform", "all"], searchString);

    const android = searchString.includes("android");
    const ios = stringOfArrayIncluded(["ios", "os x", "unix", "Multiplatform", "all"], searchString);

    return {
        operatingSystems: { linux, windows, android, ios, mac },
        runtimePlatforms: ["desktop"]
    };
};
