// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { deduplicateIdentifierArray, diffIdentifierArray } from "../../tools/identifiersTools";
import { SchemaIdentifier, SchemaOrganization } from "../adapters/dbApi/kysely/kysely.database";
import { mergeOrganizations } from "../../tools/mergeAndCompare";
import type { DbApiV2, SearchOptions } from "../ports/DbApiV2";
import { Source, UIOrganization } from "./readWriteSillData";
import {
    filterSourceByFeature,
    getSupportedIdentifierType,
    resolveAdapterFromSourceType
} from "../adapters/resolveAdapter";
export type GetAndFetchSoftwareIdsByAuthorOrganization = (params: {
    search?: SearchOptions | undefined;
}) => Promise<Array<UIOrganization>>;

export const makeGetAndFetchSoftwareIdsByAuthorOrganization = (deps: { dbApi: DbApiV2 }) => {
    const { dbApi } = deps;
    return (params: { search?: SearchOptions }) => getSoftwareIdsByOrganisation({ search: params?.search, dbApi });
};

const logUsecase = "[UC:GetAuthorOrganization]";

const discoverOrgFromIdentifier = async (params: { identifiers: SchemaIdentifier[] | undefined; source: Source }) => {
    const { identifiers, source } = params;

    if (!identifiers || identifiers.length === 0) return;

    const sourceGateway = resolveAdapterFromSourceType(source.kind, "organization");
    const supportedIdentifierType = getSupportedIdentifierType(source);

    const filteredIdentifiers = identifiers.filter(
        identifier =>
            identifier.subjectOf?.additionalType &&
            supportedIdentifierType.includes(identifier.subjectOf.additionalType)
    );

    if (filteredIdentifiers.length === 0 || !sourceGateway?.organization) return;

    for (const identifier of filteredIdentifiers) {
        const res = await sourceGateway.organization?.getOrganization({
            organizationId: identifier.value,
            source
        });
        if (res) return res;
    }

    return;
};

const recursiveDiscovery = async (params: { identifiers: SchemaIdentifier[]; sources: Source[] }) => {
    const { identifiers, sources } = params;

    // Get data for each source
    const data = await Promise.all(sources.map(source => discoverOrgFromIdentifier({ source, identifiers })));

    const record: Record<string, SchemaOrganization | undefined> = Object.fromEntries(
        sources.map((source, i) => [source.slug, data[i]])
    );

    // Is there a source that don't have data ?
    const unresolvedSource = sources.filter((_source, index) => {
        return data[index] === undefined;
    });

    // Is there new identifiers ?
    const filtredData = data.filter(a => a !== undefined);
    const newIdentifers = filtredData
        .map(org => org.identifiers)
        .filter(a => a !== undefined)
        .flat();
    const newDeduplicatedIdentifers = deduplicateIdentifierArray(newIdentifers);
    const addedIentifers = diffIdentifierArray(newDeduplicatedIdentifers, identifiers);

    // Yes, New request with less data and less identifiers
    if (addedIentifers.length > 0 && unresolvedSource.length > 0) {
        const subRes = await recursiveDiscovery({ identifiers: addedIentifers, sources: unresolvedSource });
        if (subRes) {
            Object.keys(subRes).forEach(key => {
                record[key] = subRes[key];
            });
        }
    }

    return record;
};

const fetchAndSaveOrganization = async (dbApi: DbApiV2, organization: SchemaOrganization): Promise<void> => {
    if (!organization?.identifiers || !organization.identifiers?.length || organization.identifiers.length === 0)
        return;

    const sources = await dbApi.source.getAll();
    const sourcesIndex = filterSourceByFeature(sources, "organization").sort((a, b) => a.priority - b.priority);

    const res = await recursiveDiscovery({ identifiers: organization.identifiers, sources: sourcesIndex });
    const [main, ...rest] = sourcesIndex.map(source => res[source.slug]).filter(a => a !== undefined);

    const merged = rest.reduce((save, org) => {
        return mergeOrganizations(org, save);
    }, main);

    const withProd = {
        ...merged,
        producer: organization.producer,
        name: organization.name
    };

    return dbApi.authorOrganization.save({
        organization: withProd
    });
};

export const saveAndgetSoftwareIdsByOrganisation = async (params: { dbApi: DbApiV2; search?: SearchOptions }) => {
    const { dbApi, search = {} } = params;
    const logIdentifer = `${logUsecase} Build -`;

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

export const getSoftwareIdsByOrganisation = async (params: { dbApi: DbApiV2; search?: SearchOptions }) => {
    const { dbApi, search = {} } = params;

    const softwareIdsByOrg = await dbApi.software.getSoftwareIdsByOrganisation({ search });
    const resultIds = softwareIdsByOrg.map(org => org.name);

    return (await dbApi.authorOrganization.getAll({ ids: resultIds })).filter(
        org => org.identifiers && org.identifiers.length > 0
    );
};

export const rebuildSoftwareIdsByOrganisation = async (params: { dbApi: DbApiV2 }) => {
    const { dbApi } = params;
    const logIdentifer = `${logUsecase} Rebuild -`;

    await dbApi.authorOrganization.flush();
    console.debug(`${logIdentifer} Flush table - Done`);

    const softwareIdsByOrg = await dbApi.software.getSoftwareIdsByOrganisation({});
    console.debug(`${logIdentifer} Regenerate the org tree with last updated data - Done`);

    let index = 0;
    console.time(`${logIdentifer} 💾 Saved organisations 🏛️`);
    for (const org of softwareIdsByOrg) {
        console.log(`${logIdentifer} 💾 Saving ${index}/${softwareIdsByOrg.length} 🏛️ : ${org.name}`);
        await fetchAndSaveOrganization(dbApi, org);
        index++;
    }

    console.timeEnd(`${logIdentifer} 💾 Saved organisations 🏛️`);
};

export const pruneAuthorOrganization = async (params: { dbApi: DbApiV2 }) => {
    const { dbApi } = params;
    const logIdentifer = `${logUsecase} Flush table`;
    console.debug(`${logIdentifer} - Ongoing`);
    await dbApi.authorOrganization.flush();
    console.debug(`${logIdentifer} - Done`);
};
