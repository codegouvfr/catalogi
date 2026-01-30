// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import merge from "deepmerge";
import { DatabaseDataType, PopulatedExternalData } from "../../../ports/DbApiV2";
import { mergeArrays } from "../../../utils";
import { SoftwareExternalData } from "../../../ports/GetSoftwareExternalData";

export const mergeExternalData = (
    externalData: PopulatedExternalData[]
): DatabaseDataType.SoftwareExternalDataRow | undefined => {
    if (externalData.length === 0) return undefined;
    if (externalData.length === 1) {
        const { slug, priority, kind, url, ...rest } = externalData[0];
        return rest;
    }
    externalData.sort((a, b) => b.priority - a.priority);
    const merged = merge.all<PopulatedExternalData>(externalData, { arrayMerge: mergeArrays });
    const { slug, priority, kind, url, ...rest } = merged;
    return rest;
};

export const castToSoftwareExternalData = (
    externalSoftwareRow: DatabaseDataType.SoftwareExternalDataRow
): SoftwareExternalData => {
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
