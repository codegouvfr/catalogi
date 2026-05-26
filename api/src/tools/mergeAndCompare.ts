// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

// ============================================
// Person Functions
// ============================================

import { SchemaOrganization, SchemaPerson } from "../core/adapters/dbApi/kysely/kysely.database";
import { isIdentifierInArray, mergeDepuplicateIdentifierArray } from "./identifiersTools";

export const isSamePerson = (personA: SchemaPerson, personB: SchemaPerson): boolean => {
    if (personA.name.toLowerCase() === personB.name.toLowerCase()) return true;

    // Is email an id?
    if (!personA.identifiers || !personB.identifiers) {
        return false;
    }

    // Check if at least one identifier of personA is present in personB's identifiers
    return personA.identifiers.some(identifierA => isIdentifierInArray(identifierA, personB.identifiers!));
};

// Function to merge two Person objects
export const mergePersons = (personA: SchemaPerson, personB: SchemaPerson): SchemaPerson => {
    return {
        ...personA,
        ...personB,
        identifiers: mergeDepuplicateIdentifierArray(personA.identifiers, personB.identifiers),
        affiliations: mergeOrganizationArrays(personA.affiliations, personB.affiliations)
    };
};

export const mergePersonArrays = (
    personListA: SchemaPerson[] | undefined,
    personListB: SchemaPerson[] | undefined
): SchemaPerson[] => {
    if (!personListA?.length && !personListB?.length) return [];
    if (!personListA?.length) return personListB ? [...personListB] : [];
    if (!personListB?.length) return [...personListA];

    const merged = [...personListA];
    for (const personB of personListB) {
        const index = merged.findIndex(personA => isSamePerson(personA, personB));
        if (index !== -1) {
            merged[index] = mergePersons(merged[index], personB);
        } else {
            merged.push(personB);
        }
    }
    return merged;
};

// ============================================
// Organization Functions
// ============================================
export const isSameOrganization = (orgA: SchemaOrganization, orgB: SchemaOrganization): boolean => {
    if (orgA.name === orgB.name) {
        return true;
    }
    if (!orgA.identifiers || !orgB.identifiers) {
        return false;
    }
    return orgA.identifiers.some(identifierA => isIdentifierInArray(identifierA, orgB.identifiers!));
};

export const mergeOrganizations = (orgA: SchemaOrganization, orgB: SchemaOrganization): SchemaOrganization => {
    return {
        ...orgA,
        ...orgB,
        identifiers: mergeDepuplicateIdentifierArray(orgA.identifiers, orgB.identifiers),
        parentOrganizations: mergeOrganizationArrays(orgA.parentOrganizations, orgB.parentOrganizations)
    };
};

export const mergeOrganizationArrays = (
    array1: SchemaOrganization[] | undefined,
    array2: SchemaOrganization[] | undefined
): SchemaOrganization[] => {
    if (!array1?.length && !array2?.length) return [];
    if (!array1?.length) return array2 ? [...array2] : [];
    if (!array2?.length) return [...array1];

    const merged = [...array1];
    for (const orgB of array2) {
        const index = merged.findIndex(orgA => isSameOrganization(orgA, orgB));
        if (index !== -1) {
            merged[index] = mergeOrganizations(merged[index], orgB);
        } else {
            merged.push(orgB);
        }
    }
    return merged;
};
