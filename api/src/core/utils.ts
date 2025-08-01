// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SoftwareType } from "./usecases/readWriteSillData";

export type OmitFromExisting<T, K extends keyof T> = Omit<T, K>;

const isEqual = (var1: any, var2: any): boolean => {
    // Check if both values are strictly equal
    if (var1 === var2) {
        return true;
    }

    // Check if both values are of the same type
    if (typeof var1 !== typeof var2) {
        return false;
    }

    // Handle null and undefined cases
    if (var1 === null || var2 === null) {
        return var1 === var2;
    }

    // Handle arrays
    if (Array.isArray(var1) && Array.isArray(var2)) {
        if (var1.length !== var2.length) {
            return false;
        }
        for (let i = 0; i < var1.length; i++) {
            if (!isDeepIncludedInArray(var1[i], var2)) {
                return false;
            }
        }
        return true;
    }

    // Handle objects
    if (typeof var1 === "object" && typeof var2 === "object") {
        const keysA = Object.keys(var1);
        const keysB = Object.keys(var2);

        if (keysA.length !== keysB.length) {
            return false;
        }

        for (let key of keysA) {
            if (!keysB.includes(key) || !isEqual(var1[key], var2[key])) {
                return false;
            }
        }

        return true;
    }

    // If none of the above conditions are met, the values are not equal
    return false;
};

const isDeepIncludedInArray = (var1: any, arrayToCheck: any[]): boolean => {
    return arrayToCheck.some(element => isEqual(var1, element));
};

export function mergeArrays(arr1: any[], arr2: any[]): any[] {
    const merged = [...arr1, ...arr2];
    return merged.reduce((acc, item) => {
        if (isDeepIncludedInArray(item, acc)) return acc;
        return [...acc, item];
    }, []);
}

const stringOfArrayIncluded = (stringArray: Array<string>, text: string): boolean => {
    return stringArray.some((arg: string) => {
        return text.includes(arg);
    });
};

export const resolveSoftwareType = (keywords: string[]): SoftwareType => {
    const searchString = keywords.join("").toLocaleLowerCase();

    if (searchString.includes("docker")) {
        return {
            type: "cloud"
        };
    }

    const linux = stringOfArrayIncluded(["linux", "ubuntu", "unix", "multiplatform", "all"], searchString);
    const windows = stringOfArrayIncluded(["windows", "multiplatform", "all"], searchString);
    const mac = stringOfArrayIncluded(["mac", "unix", "multiplatform", "all"], searchString);

    const android = searchString.includes("android");
    const ios = stringOfArrayIncluded(["ios", "os x", "unix", "Multiplatform", "all"], searchString);

    return {
        type: "desktop/mobile",
        os: { "linux": linux, "windows": windows, "android": android, "ios": ios, "mac": mac }
    };
};
