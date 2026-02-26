// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { DatabaseDataType } from "../ports/DbApiV2";
import type { SoftwareExternalData as LegacySoftwareExternalData } from "../ports/GetSoftwareExternalData";

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
 * Still used by castToSoftwareExternalData for rebinding in refreshExternalData.
 */
export const toLegacySoftwareExternalData = (
    row: DatabaseDataType.SoftwareExternalDataRow
): LegacySoftwareExternalData => ({
    externalId: row.externalId,
    sourceSlug: row.sourceSlug,
    developers: row.authors,
    name: row.name,
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
