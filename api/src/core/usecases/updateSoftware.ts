// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DbApiV2, WithUserId } from "../ports/DbApiV2";
import { softwareTypeToCanonical } from "./createSoftware";
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

        const { operatingSystems, runtimePlatforms } = softwareTypeToCanonical(formFields.softwareType);

        await dbApi.software.update({
            software: {
                name: formFields.softwareName,
                description: { fr: formFields.softwareDescription },
                license: formFields.softwareLicense,
                logoUrl: formFields.softwareLogoUrl,
                dereferencing: undefined,
                isStillInObservation: false,
                customAttributes: formFields.customAttributes,
                operatingSystems,
                runtimePlatforms,
                applicationCategories: [],
                addedByUserId: userId,
                keywords: formFields.softwareKeywords
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

        console.log(`software correctly updated, softwareId is : ${softwareId} (${formFields.softwareName})`);
    };
