// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SchemaIdentifier, SchemaOrganization } from "../adapters/dbApi/kysely/kysely.database";
import { mergeOrganizations } from "../adapters/dbApi/kysely/mergeExternalData";
import { rorOrgApi } from "../adapters/ror.org";
import type { DbApiV2, SearchOptions } from "../ports/DbApiV2";
import { UIOrganization } from "./readWriteSillData";

export type GetAndFetchSoftwareIdsByAuthorOrganization = (params: {
    search?: SearchOptions | undefined;
}) => Promise<Array<UIOrganization>>;

export const makeGetAndFetchSoftwareIdsByAuthorOrganization = (deps: { dbApi: DbApiV2 }) => {
    const { dbApi } = deps;
    return (params: { search?: SearchOptions }) => getSoftwareIdsByOrganisation({ search: params?.search, dbApi });
};

// Get All Author Organization

// Search Oraganization
// byName and Ids

const fetchWithIdentifer = (identifier: SchemaIdentifier) => {
    if (!identifier.subjectOf?.additionalType) return;

    switch (identifier.subjectOf.additionalType) {
        case "ROR":
            return rorOrgApi.organization.get(identifier.value);
        case "wikidata":
        default:
            return;
    }
};

const batchCatcher = async (identifiers: SchemaIdentifier[]): Promise<SchemaOrganization | undefined> => {
    const organizationFetched = await Promise.all(identifiers.map(fetchWithIdentifer));
    return organizationFetched.reduce((acc, org) => {
        if (!org) return acc;
        if (!acc) return org;
        return mergeOrganizations(org, acc);
    }, undefined);
};

const fetchAndSaveOrganization = async (dbApi: DbApiV2, organization: SchemaOrganization): Promise<void> => {
    if (organization.identifiers) {
        const mergedFromSources = await batchCatcher(organization.identifiers);
        if (mergedFromSources) {
            return dbApi.authorOrganization.save({ organization: mergeOrganizations(mergedFromSources, organization) });
        }
    }

    return dbApi.authorOrganization.save({ organization });
};

// getSoftwareIdsByOrganisation
export const getSoftwareIdsByOrganisation = async (params: { dbApi: DbApiV2; search?: SearchOptions }) => {
    const { dbApi, search = {} } = params;

    // 1. Request to make link between software and organization
    const test = await dbApi.software.getSoftwareIdsByOrganisation({ search });

    // 2. Complementary request on organization sources to get more info about the sources
    const resultIds = test.map(org => org.name);
    const idsVerified = await dbApi.authorOrganization.checkIfSaved({ ids: resultIds });
    const idsToFetch = Object.entries(idsVerified)
        .filter(([_, value]) => value === false)
        .map(([key]) => key);

    test.filter(org => idsToFetch.includes(org.name)).forEach(org => fetchAndSaveOrganization(dbApi, org));

    // 3. Merge org from
    const allOrgs = await dbApi.authorOrganization.getAll({ ids: resultIds });
    return allOrgs;
};
