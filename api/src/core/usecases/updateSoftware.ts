// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

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
        const { similarSoftwareExternalDataItems, ...formFields } = formData;

        await dbApi.software.update({
            software: {
                name: formFields.name,
                description: { fr: formFields.description },
                license: formFields.license,
                logoUrl: formFields.image,
                dereferencing: undefined,
                isStillInObservation: false,
                customAttributes: formFields.customAttributes,
                operatingSystems: formFields.operatingSystems,
                runtimePlatforms: formFields.runtimePlatforms,
                applicationCategories: [],
                addedByUserId: userId,
                keywords: formFields.keywords
            },
            softwareId
        });

        await dbApi.software.saveSimilarSoftwares([
            {
                softwareId,
                softwareExternalDataItems: similarSoftwareExternalDataItems.map(similarSoftwareExternalData => ({
                    ...similarSoftwareExternalData
                }))
            }
        ]);

        console.log(`software correctly updated, softwareId is : ${softwareId} (${formFields.name})`);
    };
