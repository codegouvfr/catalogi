// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT
import merge from "deepmerge";
import { DatabaseDataType, PopulatedExternalData } from "../../../ports/DbApiV2";
import { SchemaIdentifier, SchemaOrganization } from "./kysely.database";
import { Person } from "../../../../lib/ApiTypes";
import { mergeArrays } from "../../../utils";

export const mergeExternalData = (
    externalData: PopulatedExternalData[]
): DatabaseDataType.SoftwareExternalDataRow | undefined => {
    if (externalData.length === 0) return undefined;
    if (externalData.length === 1) {
        const { slug, priority, kind, url, ...rest } = externalData[0];
        return rest;
    }
    externalData.sort((a, b) => b.priority - a.priority);

    const merged = merge.all<PopulatedExternalData>(externalData, appDeepMergeOptions);
    const { slug, priority, kind, url, ...rest } = merged;
    return rest;
};

// Helper function to check if an identifier is present in an array of identifiers
const isIdentifierInArray = (identifier: SchemaIdentifier, identifiersArray: SchemaIdentifier[]): boolean => {
    return identifiersArray.some(
        item =>
            item.subjectOf === identifier.subjectOf &&
            item.value === identifier.value &&
            identifier.additionalType === item.additionalType
    );
};

const isSamePerson = (personA: Person, personB: Person): boolean => {
    if (personA.name.toLowerCase() === personB.name.toLowerCase()) return true;

    // Is email an id?
    if (!personA.identifiers || !personB.identifiers) {
        return false;
    }

    // Check if at least one identifier of personA is present in personB's identifiers
    return personA.identifiers.some(identifierA => isIdentifierInArray(identifierA, personB.identifiers!));
};

// Function to merge two Person objects
function mergePersons(personA: Person, personB: Person): Person {
    // Merge identifiers without duplicates
    const mergedIdentifiers = [...(personA.identifiers || [])];
    for (const identifierB of personB.identifiers || []) {
        if (!isIdentifierInArray(identifierB, mergedIdentifiers)) {
            mergedIdentifiers.push(identifierB);
        }
    }

    // Merge affiliations
    const mergedAffiliations = mergeOrganizationArrays(personA.affiliations, personB.affiliations);

    // Return a new merged object
    return {
        "@type": "Person",
        name: personA.name, // Keep the name of personA (or personB, they are the same)
        identifiers: mergedIdentifiers,
        url: personA.url || personB.url, // Take the URL of whoever has one
        affiliations: mergedAffiliations
    };
}

export const mergePersonArrays = (personListA: Person[] | undefined, personListB: Person[] | undefined): Person[] => {
    // If both arrays are empty or undefined, return an empty array
    if (!personListA?.length && !personListB?.length) {
        return [];
    }
    // If array1 is empty or undefined, return a copy of array2
    if (!personListA?.length) {
        return personListB ? personListB : [];
    }
    // If array2 is empty or undefined, return a copy of array1
    if (!personListB?.length) {
        return personListA;
    }

    // Create a copy of the first array to avoid modifying it directly
    const mergedArray = [...personListA];

    for (const personB of personListB) {
        // Check if the person already exists in the merged array
        const existingIndex = mergedArray.findIndex(personA => isSamePerson(personA, personB));

        if (existingIndex !== -1) {
            // If the person exists, merge the two objects
            mergedArray[existingIndex] = mergePersons(mergedArray[existingIndex], personB);
        } else {
            // Otherwise, add the person to the array
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
    // Merge identifiers without duplicates
    const mergedIdentifiers = [...(orgA.identifiers || [])];
    for (const identifierB of orgB.identifiers || []) {
        if (!isIdentifierInArray(identifierB, mergedIdentifiers)) {
            mergedIdentifiers.push(identifierB);
        }
    }

    // Merge parent organizations without duplicates (optional, depending on your needs)
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
    // If both arrays are empty or undefined, return an empty array
    if (!array1?.length && !array2?.length) {
        return [];
    }
    // If array1 is empty or undefined, return a copy of array2
    if (!array1?.length) {
        return array2 ? array2 : [];
    }
    // If array2 is empty or undefined, return a copy of array1
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

export const appDeepMergeOptions = {
    arrayMerge: mergeArrays,
    customMerge: appCustomeMerge
};
