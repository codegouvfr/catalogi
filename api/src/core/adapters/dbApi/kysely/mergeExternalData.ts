// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import merge from "deepmerge";
import { DatabaseDataType, PopulatedExternalData } from "../../../ports/DbApiV2";
import { mergeArrays } from "../../../utils";

export const mergeExternalData = (
    externalData: PopulatedExternalData[]
): DatabaseDataType.SoftwareExternalDataRow | undefined => {
    if (externalData.length === 0) return undefined;
    if (externalData.length === 1) {
        const { slug: _slug, priority: _priority, kind: _kind, sourceUrl: _sourceUrl, ...rest } = externalData[0];
        return rest;
    }
    externalData.sort((a, b) => b.priority - a.priority);
    const merged = merge.all<PopulatedExternalData>(externalData, { arrayMerge: mergeArrays });
    const { slug: _slug, priority: _priority, kind: _kind, sourceUrl: _sourceUrl, ...rest } = merged;
    return rest;
};
