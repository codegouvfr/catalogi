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

/**
 * Legacy boundary mapper used by existing repository APIs.
 * Keep this mapper explicit even when fields are mostly aligned to avoid drift.
 */
export const toLegacySoftwareExternalData = (
    externalSoftwareRow: DatabaseDataType.SoftwareExternalDataRow
): LegacySoftwareExternalData => {
    if (externalSoftwareRow.repoMetadata?.healthCheck) {
        return {
            ...externalSoftwareRow,
            repoMetadata: {
                healthCheck: {
                    ...(externalSoftwareRow.repoMetadata.healthCheck?.lastCommit
                        ? { lastCommit: new Date(externalSoftwareRow.repoMetadata.healthCheck?.lastCommit) }
                        : {}),
                    ...(externalSoftwareRow.repoMetadata.healthCheck?.lastClosedIssue
                        ? { lastClosedIssue: new Date(externalSoftwareRow.repoMetadata.healthCheck?.lastClosedIssue) }
                        : {}),
                    ...(externalSoftwareRow.repoMetadata.healthCheck?.lastClosedIssuePullRequest
                        ? {
                              lastClosedIssuePullRequest: new Date(
                                  externalSoftwareRow.repoMetadata.healthCheck?.lastClosedIssuePullRequest
                              )
                          }
                        : {})
                }
            }
        };
    }

    return {
        ...externalSoftwareRow,
        repoMetadata: {}
    };
};

/**
 * Canonical mapper for Phase 2 migration.
 * This keeps conversions in one location; defaults are intentionally explicit.
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
