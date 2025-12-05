// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { assert } from "tsafe/assert";
import type { Equals } from "tsafe";

import { DbApiV2, WithUserId } from "../ports/DbApiV2";
import { SoftwareFormData } from "./readWriteSillData";

export type UpdateSoftware = (
    params: {
        formData: SoftwareFormData;
        softwareId: number;
    } & WithUserId
) => Promise<void>;

export const makeUpdateSoftware: (dbApi: DbApiV2) => UpdateSoftware =
    (dbApi: DbApiV2) =>
    async ({ formData, userId, softwareId }) => {
        // Push in software
        const {
            softwareName,
            softwareDescription,
            softwareLicense,
            softwareLogoUrl,
            softwareMinimalVersion,
            customAttributes,
            similarSoftwareExternalDataItems,
            softwareType,
            externalIdForSource,
            sourceSlug,
            softwareKeywords,
            ...rest
        } = formData;

        assert<Equals<typeof rest, {}>>();

        await dbApi.software.update({
            software: {
                name: softwareName,
                description: softwareDescription,
                license: softwareLicense,
                logoUrl: softwareLogoUrl,
                versionMin: softwareMinimalVersion,
                dereferencing: undefined,
                isStillInObservation: false,
                customAttributes,
                softwareType: softwareType,
                workshopUrls: [],
                categories: [],
                generalInfoMd: undefined,
                addedByUserId: userId,
                keywords: softwareKeywords
            },
            softwareId: softwareId
        });

        await dbApi.software.saveSimilarSoftwares([
            {
                softwareId,
                softwareExternalDataItems: similarSoftwareExternalDataItems.map(similarSoftwareExternalData => ({
                    ...similarSoftwareExternalData
                }))
            }
        ]);

        console.log(`software correctly updated, softwareId is : ${softwareId} (${softwareName})`);
    };
