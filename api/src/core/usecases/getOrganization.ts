// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { compareIdentifier, deduplicateIdentifierArray } from "../../tools/identifiersTools";
import { SchemaIdentifier, SchemaOrganization } from "../adapters/dbApi/kysely/kysely.database";
import { mergeOrganizations } from "../adapters/dbApi/kysely/mergeExternalData";
import { rorOrgApi } from "../adapters/ror.org";
import { makeWikidataAPIAgent } from "../adapters/wikidata/ApiAgent";
import type { DbApiV2, SearchOptions } from "../ports/DbApiV2";
import { UIOrganization } from "./readWriteSillData";

export type GetAndFetchSoftwareIdsByAuthorOrganization = (params: {
    search?: SearchOptions | undefined;
}) => Promise<Array<UIOrganization>>;

export const makeGetAndFetchSoftwareIdsByAuthorOrganization = (deps: { dbApi: DbApiV2 }) => {
    const { dbApi } = deps;
    return (params: { search?: SearchOptions }) => getSoftwareIdsByOrganisation({ search: params?.search, dbApi });
};

const fetchAndSaveOrganization = async (dbApi: DbApiV2, organization: SchemaOrganization): Promise<void> => {
    const sources = await dbApi.source.getByType({ type: "wikidata" });
    const source = sources.length > 0 ? sources[0] : undefined;
    const apiAgent = makeWikidataAPIAgent(source);

    const fetchWithIdentifer = (identifier: SchemaIdentifier) => {
        if (!identifier.subjectOf?.additionalType) return;

        switch (identifier.subjectOf.additionalType) {
            case "ROR":
                return rorOrgApi.organization.get(identifier.value);
            case "wikidata":
                return apiAgent.getOrganization(identifier.value);
            default:
                return;
        }
    };

    const batchCatcher = async (identifiers: SchemaIdentifier[]): Promise<SchemaOrganization | undefined> => {
        const deduplicatedIdentifiers = deduplicateIdentifierArray(identifiers);
        const organizationFetched = await Promise.all(deduplicatedIdentifiers.map(fetchWithIdentifer));

        if (organizationFetched.length > 0) {
            const childrenIdentifiers = organizationFetched
                .map(org => org?.identifiers)
                .filter(id => id !== undefined)
                .flat();

            // remove actual ids from children ids
            const filteredChildenIds = childrenIdentifiers.filter(
                identier =>
                    !deduplicatedIdentifiers.some(identierToRemove => compareIdentifier(identierToRemove, identier))
            );
            const moreInfo = filteredChildenIds.length > 0 ? await batchCatcher(filteredChildenIds) : undefined;
            organizationFetched.push(moreInfo);

            return organizationFetched.reduce((acc, org) => {
                if (!org) return acc;
                if (!acc) return org;
                return mergeOrganizations(org, acc);
            }, undefined);
        }

        return undefined;
    };

    const fetchRecursivelyOrganisation = async (organisation: SchemaOrganization): Promise<SchemaOrganization> => {
        if (organisation.identifiers && organisation.identifiers.length > 0) {
            const mergedFromSources = await batchCatcher(organisation.identifiers);
            if (mergedFromSources) {
                return mergeOrganizations(mergedFromSources, organisation);
            }
        }

        return {
            ...organisation,
            identifiers: organisation.identifiers ? deduplicateIdentifierArray(organisation.identifiers) : []
        };
    };

    return dbApi.authorOrganization.save({
        organization: await fetchRecursivelyOrganisation(organization)
    });
};

// Option 1 : SaveThenGet
export const saveAndgetSoftwareIdsByOrganisation = async (params: { dbApi: DbApiV2; search?: SearchOptions }) => {
    const { dbApi, search = {} } = params;
    const logIdentifer = "[UC:AuthorOrganization] Save&Get -";

    // 1. Request to make link between software and organization
    const softwareIdsByOrg = await dbApi.software.getSoftwareIdsByOrganisation({ search });
    console.debug(`${logIdentifer} found ${softwareIdsByOrg.length} organisations`);

    // 2. Complementary request on organization sources to get more info about the sources
    const resultIds = softwareIdsByOrg.map(org => org.name);
    const idsVerified = await dbApi.authorOrganization.checkIfSaved({ ids: resultIds });
    const idsToFetch = Object.entries(idsVerified)
        .filter(([_, value]) => value === false)
        .map(([key]) => key);
    console.debug(`${logIdentifer} Need to fetch ${idsToFetch.length} organisations`);

    // TODO : paralelle instead of series -> Timeout issues
    // orgsToFetch.filter(org => idsToFetch.includes(org.name)).forEach(org => fetchAndSaveOrganization(dbApi, org));
    const orgsToFetch = softwareIdsByOrg.filter(org => idsToFetch.includes(org.name));
    let index = 0;
    console.time(`${logIdentifer} 💾 Saved ${orgsToFetch.length} organisations 🏛️`);
    for (const org of orgsToFetch) {
        console.log(`${logIdentifer} 💾 Saving ${index}/${orgsToFetch.length} 🏛️ : ${org.name}`);
        await fetchAndSaveOrganization(dbApi, org);
        index++;
    }

    console.timeEnd(`${logIdentifer} 💾 Saved ${orgsToFetch.length} organisations 🏛️`);

    // 3. Return saved data
    const allOrgs = await dbApi.authorOrganization.getAll({ ids: resultIds });
    return allOrgs.filter(org => org.identifiers && org.identifiers.length > 0);
};

// Option 2 : Get = // getSoftwareIdsByOrganisation
export const getSoftwareIdsByOrganisation = async (params: { dbApi: DbApiV2; search?: SearchOptions }) => {
    const { dbApi, search = {} } = params;

    const softwareIdsByOrg = await dbApi.software.getSoftwareIdsByOrganisation({ search });
    const resultIds = softwareIdsByOrg.map(org => org.name);

    return (await dbApi.authorOrganization.getAll({ ids: resultIds })).filter(
        org => org.identifiers && org.identifiers.length > 0
    );
};

// Option 3 : Update = Delete -> Save
export const updateSoftwareIdsByOrganisation = async (params: { dbApi: DbApiV2 }) => {
    const { dbApi } = params;
    const logIdentifer = "[UC:AuthorOrganization] Update -";

    await dbApi.authorOrganization.flush();
    console.debug(`${logIdentifer} Flush table - Done`);

    const softwareIdsByOrg = await dbApi.software.getSoftwareIdsByOrganisation({});
    console.debug(`${logIdentifer} Regenerate the org tree with last updated data - Done`);

    // 3. Improve organization getting on API Endpoints
    let index = 0;
    console.time(`${logIdentifer} 💾 Saved organisations 🏛️`);
    for (const org of softwareIdsByOrg) {
        console.log(`${logIdentifer} 💾 Saving ${index}/${softwareIdsByOrg.length} 🏛️ : ${org.name}`);
        await fetchAndSaveOrganization(dbApi, org);
        index++;
    }

    console.timeEnd(`${logIdentifer} 💾 Saved organisations 🏛️`);
};
