// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { DatabaseDataType } from "../ports/DbApiV2";
import type { GetSoftwareExternal } from "../ports/GetSoftwareExternal";
import type { SoftwareExternalData as LegacySoftwareExternalData } from "../ports/GetSoftwareExternalData";
import type { GetSoftwareExternalData as GetLegacySoftwareExternalData } from "../ports/GetSoftwareExternalData";
import type { SoftwareExternal } from "./SoftwareTypes";

const emptyOperatingSystems: SoftwareExternal["operatingSystems"] = {
    windows: false,
    linux: false,
    mac: false,
    android: false,
    ios: false
};

const mapRepoMetadataHealthCheck = (
    healthCheck: NonNullable<NonNullable<DatabaseDataType.SoftwareExternalDataRow["repoMetadata"]>["healthCheck"]>
) => ({
    ...(healthCheck.lastCommit ? { lastCommit: new Date(healthCheck.lastCommit) } : {}),
    ...(healthCheck.lastClosedIssue ? { lastClosedIssue: new Date(healthCheck.lastClosedIssue) } : {}),
    ...(healthCheck.lastClosedIssuePullRequest
        ? { lastClosedIssuePullRequest: new Date(healthCheck.lastClosedIssuePullRequest) }
        : {})
});

/**
 * Legacy boundary mapper: canonical DB row → legacy SoftwareExternalData shape.
 * Maps renamed columns back to legacy field names.
 */
export const toLegacySoftwareExternalData = (
    row: DatabaseDataType.SoftwareExternalDataRow
): LegacySoftwareExternalData => ({
    externalId: row.externalId,
    sourceSlug: row.sourceSlug,
    developers: row.authors,
    label: row.name,
    description: row.description,
    isLibreSoftware: row.isLibreSoftware,
    logoUrl: row.image,
    websiteUrl: row.url,
    sourceUrl: row.codeRepositoryUrl,
    documentationUrl: row.softwareHelp,
    license: row.license,
    softwareVersion: row.latestVersion?.version ?? undefined,
    keywords: row.keywords,
    programmingLanguages: row.programmingLanguages,
    applicationCategories: row.applicationCategories,
    publicationTime: row.dateCreated ? new Date(row.dateCreated) : undefined,
    referencePublications: row.referencePublications,
    identifiers: row.identifiers,
    providers: row.providers,
    repoMetadata: row.repoMetadata?.healthCheck
        ? { healthCheck: mapRepoMetadataHealthCheck(row.repoMetadata.healthCheck) }
        : {}
});

/**
 * Canonical mapper for Phase 2 migration.
 * Converts legacy SoftwareExternalData → canonical SoftwareExternal.
 */
export const toCanonicalSoftwareExternal = (params: {
    legacy: LegacySoftwareExternalData;
    softwareId?: number;
}): SoftwareExternal => {
    const { legacy, softwareId } = params;
    const publicationIso = legacy.publicationTime?.toISOString();
    const normalizedTime = publicationIso ?? new Date(0).toISOString();

    return {
        variant: "external",
        id: softwareId,
        externalId: legacy.externalId,
        sourceSlug: legacy.sourceSlug,
        name: legacy.label,
        description: legacy.description,
        image: legacy.logoUrl,
        url: legacy.websiteUrl,
        codeRepositoryUrl: legacy.sourceUrl,
        softwareHelp: legacy.documentationUrl,
        dateCreated: publicationIso,
        latestVersion: {
            version: legacy.softwareVersion,
            releaseDate: publicationIso
        },
        addedTime: normalizedTime,
        updateTime: normalizedTime,
        keywords: legacy.keywords ?? [],
        applicationCategories: legacy.applicationCategories ?? [],
        programmingLanguages: legacy.programmingLanguages ?? [],
        operatingSystems: emptyOperatingSystems,
        runtimePlatforms: [],
        authors: legacy.developers,
        providers: legacy.providers ?? [],
        license: legacy.license,
        isLibreSoftware: legacy.isLibreSoftware,
        referencePublications: legacy.referencePublications ?? [],
        identifiers: legacy.identifiers ?? [],
        sameAs: [],
        dereferencing: undefined,
        customAttributes: undefined,
        userAndReferentCountByOrganization: undefined,
        hasExpertReferent: undefined,
        instances: undefined
    };
};

export const toCanonicalSoftwareExternalGetter = (
    getLegacySoftwareExternalData: GetLegacySoftwareExternalData
): GetSoftwareExternal => {
    const getSoftwareExternal: GetSoftwareExternal = async params => {
        const legacy = await getLegacySoftwareExternalData(params);
        if (legacy === undefined) return undefined;
        return toCanonicalSoftwareExternal({ legacy });
    };

    getSoftwareExternal.clear = externalId => getLegacySoftwareExternalData.clear(externalId);

    return getSoftwareExternal;
};
