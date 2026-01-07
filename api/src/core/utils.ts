// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Person } from "../lib/ApiTypes";
import { SchemaIdentifier, SchemaOrganization } from "./adapters/dbApi/kysely/kysely.database";
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
        return [item, ...acc];
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

// Fonction d'aide pour vérifier si un identifiant est présent dans un tableau d'identifiants
const isIdentifierInArray = (identifier: SchemaIdentifier, identifiersArray: SchemaIdentifier[]): boolean => {
    return identifiersArray.some(item => item.propertyID === identifier.propertyID && item.value === identifier.value);
};

const isSamePerson = (personA: Person, personB: Person): boolean => {
    if (personA.name.toLowerCase() === personB.name.toLowerCase()) return true;

    // email is id ?

    if (!personA.identifiers || !personB.identifiers) {
        return false;
    }

    // Vérifie si au moins un identifiant de personA est présent dans les identifiants de personB
    return personA.identifiers.some(identifierA => isIdentifierInArray(identifierA, personB.identifiers!));
};

// Fonction pour fusionner deux objets SchemaPerson
function mergePersons(personA: Person, personB: Person): Person {
    // Fusionne les identifiants sans doublons
    const mergedIdentifiers = [...(personA.identifiers || [])];
    for (const identifierB of personB.identifiers || []) {
        if (!isIdentifierInArray(identifierB, mergedIdentifiers)) {
            mergedIdentifiers.push(identifierB);
        }
    }

    // Fusionne les affiliations
    const mergedAffiliations = mergeOrganizationArrays(personA.affiliations, personB.affiliations);

    // Retourne un nouvel objet fusionné
    return {
        "@type": "Person",
        name: personA.name, // On garde le nom de personA (ou personB, ils sont identiques)
        identifiers: mergedIdentifiers,
        url: personA.url || personB.url, // On prend l'URL de celui qui en a une
        affiliations: mergedAffiliations
    };
}

export const mergePersonArrays = (personListA: Person[] | undefined, personListB: Person[] | undefined): Person[] => {
    // Si les deux tableaux sont vides ou undefined, retourne un tableau vide
    if (!personListA?.length && !personListB?.length) {
        return [];
    }
    // Si array1 est vide ou undefined, retourne une copie de array2
    if (!personListA?.length) {
        return personListB ? personListB : [];
    }
    // Si array2 est vide ou undefined, retourne une copie de array1
    if (!personListB?.length) {
        return personListA;
    }

    // Crée une copie du premier tableau pour éviter de le modifier directement
    const mergedArray = [...personListA];

    for (const personB of personListB) {
        // Cherche si la personne existe déjà dans le tableau fusionné
        const existingIndex = mergedArray.findIndex(personA => isSamePerson(personA, personB));

        if (existingIndex !== -1) {
            // Si la personne existe, fusionne les deux objets
            mergedArray[existingIndex] = mergePersons(mergedArray[existingIndex], personB);
        } else {
            // Sinon, ajoute la personne au tableau
            mergedArray.push(personB);
        }
    }

    return mergedArray;
};

/* Organization */

const isSameOrganization = (orgA: SchemaOrganization, orgB: SchemaOrganization): boolean => {
    if (orgA.name !== orgB.name) {
        return false;
    }
    if (!orgA.identifiers || !orgB.identifiers) {
        return false;
    }
    return orgA.identifiers.some(identifierA => isIdentifierInArray(identifierA, orgB.identifiers!));
};

const mergeOrganizations = (orgA: SchemaOrganization, orgB: SchemaOrganization): SchemaOrganization => {
    // Fusionne les identifiants sans doublons
    const mergedIdentifiers = [...(orgA.identifiers || [])];
    for (const identifierB of orgB.identifiers || []) {
        if (!isIdentifierInArray(identifierB, mergedIdentifiers)) {
            mergedIdentifiers.push(identifierB);
        }
    }

    // Fusionne les organisations parentes sans doublons (optionnel, selon votre besoin)
    const mergedParentOrganizations = [...(orgA.parentOrganizations || []), ...(orgB.parentOrganizations || [])];

    return {
        "@type": "Organization",
        name: orgA.name,
        url: orgA.url || orgB.url,
        identifiers: mergedIdentifiers,
        parentOrganizations: mergedParentOrganizations
    };
};

export const mergeOrganizationArrays = (
    array1: SchemaOrganization[] | undefined,
    array2: SchemaOrganization[] | undefined
): SchemaOrganization[] => {
    // Si les deux tableaux sont vides ou undefined, retourne un tableau vide
    if (!array1?.length && !array2?.length) {
        return [];
    }
    // Si array1 est vide ou undefined, retourne une copie de array2
    if (!array1?.length) {
        return array2 ? array2 : [];
    }
    // Si array2 est vide ou undefined, retourne une copie de array1
    if (!array2?.length) {
        return array1;
    }

    const mergedArray = [...array1];
    for (const orgB of array2) {
        const existingIndex = mergedArray.findIndex(orgA => isSameOrganization(orgA, orgB));
        if (existingIndex !== -1) {
            mergedArray[existingIndex] = mergeOrganizations(mergedArray[existingIndex], orgB);
        } else {
            mergedArray.push(orgB);
        }
    }
    return mergedArray;
};

/* App deep merge options */
const appCustomeMerge = (key: string) => {
    if (key === "developers") {
        return mergePersonArrays;
    }
};

export const appDeepMergeOptions = { arrayMerge: mergeArrays, customMerge: appCustomeMerge };
