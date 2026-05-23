// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DbApiV2, WithUserId } from "../ports/DbApiV2";
import { SoftwareFormData } from "./readWriteSillData";
import { resolveSoftwareFormDataProtections } from "./resolveSoftwareFormDataProtection";
import { SoftwareEditionProtectedError, SoftwareNotFoundError } from "./softwareErrors";

export type UpdateSoftware = (
    params: {
        formData: SoftwareFormData;
        softwareId: number;
        isAdmin?: boolean;
    } & WithUserId
) => Promise<void>;

export const makeUpdateSoftware: (dbApi: DbApiV2) => UpdateSoftware =
    (dbApi: DbApiV2) =>
    async ({ formData, userId, softwareId, isAdmin = false }) => {
        const existing = await dbApi.software.getBySoftwareId(softwareId);
        if (!existing) throw new SoftwareNotFoundError();

        // Edition protection freezes the software's own form data; satellite data
        // (instances, user/referent declarations) intentionally stays editable.
        if (existing.protections?.edition?.isProtected === true && !isAdmin) {
            throw new SoftwareEditionProtectedError();
        }

        const protections = resolveSoftwareFormDataProtections({
            formDataProtections: formData.protections,
            existingProtections: existing.protections,
            currentUser: { id: userId, role: isAdmin ? "admin" : "user" },
            now: new Date().toISOString()
        });

        const { similarSoftwareExternalDataItems, ...formFields } = formData;

        await dbApi.software.update({
            software: {
                name: formFields.name.trim(),
                nameOverride: formFields.nameOverride,
                description: formFields.description === null ? null : { fr: formFields.description },
                license: formFields.license,
                image: formFields.image,
                dereferencing: undefined,
                isStillInObservation: false,
                customAttributes: formFields.customAttributes,
                protections,
                operatingSystems: formFields.operatingSystems,
                runtimePlatforms: formFields.runtimePlatforms,
                applicationCategories: [],
                addedByUserId: userId,
                keywords: formFields.keywords,
                isLibreSoftware: formFields.isLibreSoftware,
                url: formFields.url,
                codeRepositoryUrl: formFields.codeRepositoryUrl,
                softwareHelp: formFields.softwareHelp,
                latestVersion: formFields.latestVersion
                    ? {
                          version: formFields.latestVersion.version,
                          releaseDate: formFields.latestVersion.releaseDate
                      }
                    : null,
                programmingLanguages: formFields.programmingLanguages
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
