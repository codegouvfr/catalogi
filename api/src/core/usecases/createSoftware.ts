// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DbApiV2, SoftwareExtrinsicCreation, WithUserId } from "../ports/DbApiV2";
import { SoftwareFormData, SoftwareProtections } from "./readWriteSillData";
import { resolveSoftwareFormDataProtections } from "./resolveSoftwareFormDataProtection";
import { SoftwareAlreadyExistsError } from "./softwareErrors";

export type CreateSoftware = (
    params: {
        formData: SoftwareFormData;
        isAdmin?: boolean;
    } & WithUserId
) => Promise<number>;

export const formDataToSoftwareRow = (
    softwareForm: SoftwareFormData,
    userId: number,
    protections: SoftwareProtections | undefined
): SoftwareExtrinsicCreation => {
    return {
        name: softwareForm.name.trim(),
        nameOverride: softwareForm.nameOverride,
        description: softwareForm.description === null ? null : { fr: softwareForm.description },
        license: softwareForm.license,
        image: softwareForm.image,
        addedTime: new Date().toISOString(),
        dereferencing: undefined,
        isStillInObservation: false,
        operatingSystems: softwareForm.operatingSystems,
        runtimePlatforms: softwareForm.runtimePlatforms,
        applicationCategories: [],
        addedByUserId: userId,
        keywords: softwareForm.keywords,
        customAttributes: softwareForm.customAttributes,
        protections,
        isLibreSoftware: softwareForm.isLibreSoftware,
        url: softwareForm.url,
        codeRepositoryUrl: softwareForm.codeRepositoryUrl,
        softwareHelp: softwareForm.softwareHelp,
        latestVersion: softwareForm.latestVersion
            ? {
                  version: softwareForm.latestVersion.version,
                  releaseDate: softwareForm.latestVersion.releaseDate
              }
            : null,
        programmingLanguages: softwareForm.programmingLanguages
    };
};

const textUC = "CreateSoftware";

type ExistingSoftwareMatch = { softwareId: number; matchedBy: "name" | "externalId" };

const resolveExistingSoftware = async ({
    dbApi,
    formData
}: {
    dbApi: DbApiV2;
    formData: SoftwareFormData;
}): Promise<ExistingSoftwareMatch | undefined> => {
    const { name: softwareName, externalIdForSource, sourceSlug } = formData;
    const logTitle = `[UC:${textUC}] (${softwareName} from ${sourceSlug}) -`;

    const source = await dbApi.source.getByName({ name: sourceSlug });
    if (!source) throw new Error("Source slug is unknown");

    const named = await dbApi.software.getByName({ softwareName: softwareName.trim() });

    if (named) {
        console.log(logTitle, "Name already present, let's take this one");
        return { softwareId: named.id, matchedBy: "name" };
    }

    if (externalIdForSource) {
        const savedSoftwareId = await dbApi.software.getSoftwareIdByExternalIdAndSlug({
            sourceSlug,
            externalId: externalIdForSource
        });
        if (savedSoftwareId) {
            console.log(logTitle, `External Id from ${sourceSlug} already present`);
            return { softwareId: savedSoftwareId, matchedBy: "externalId" };
        }
    }

    if (!externalIdForSource) return undefined;

    // Scans every other-source external-data row — only worth it when we have an id to match.
    const savedIdentifers = await dbApi.softwareExternalData.getOtherIdentifierIdsBySourceURL({
        sourceURL: source.url
    });
    if (savedIdentifers && Object.hasOwn(savedIdentifers, externalIdForSource)) {
        console.info(
            logTitle,
            ` ${softwareName}(${externalIdForSource}) from ${source.slug}: known as an other identifier of software #${savedIdentifers[externalIdForSource]}`
        );
        return { softwareId: savedIdentifers[externalIdForSource], matchedBy: "externalId" };
    }

    return undefined;
};

const toAlreadyExistsError = (match: ExistingSoftwareMatch, formData: SoftwareFormData): SoftwareAlreadyExistsError =>
    new SoftwareAlreadyExistsError(
        match.matchedBy === "name"
            ? `Software already exists with name : ${formData.name.trim()}`
            : `Software already exists with external id ${formData.externalIdForSource} from source ${formData.sourceSlug}`
    );

export const makeCreateSofware: (params: { dbApi: DbApiV2; withUserInput: boolean }) => CreateSoftware = params => {
    const { dbApi, withUserInput } = params;
    return async ({ formData, userId, isAdmin = false }) => {
        const { name: softwareName, similarSoftwareExternalDataItems, externalIdForSource, sourceSlug } = formData;
        const logTitle = `[UC:${textUC}] (${softwareName} from ${sourceSlug}) -`;

        console.time(`${logTitle} 💾 Saved`);

        const match = await resolveExistingSoftware({ dbApi, formData });

        // Users must go through updateSoftware (which enforces edition protection);
        // silently merging here would also discard any admin-requested protections.
        if (match && withUserInput) throw toAlreadyExistsError(match, formData);

        let softwareId: number;
        if (match) {
            softwareId = match.softwareId;
        } else {
            const resolvedProtections = resolveSoftwareFormDataProtections({
                formDataProtections: formData.protections,
                existingProtections: undefined,
                currentUser: { id: userId, role: isAdmin ? "admin" : "user" },
                now: new Date().toISOString()
            });

            console.log(logTitle, `The software package isn't save yet, let's create it`);
            softwareId = await dbApi.software.create({
                software: formDataToSoftwareRow(formData, userId, resolvedProtections),
                ...(!withUserInput
                    ? {
                          sourceSlug: formData.sourceSlug,
                          externalId: formData.externalIdForSource
                      }
                    : {})
            });
        }

        if (externalIdForSource) {
            const savedExternalData = await dbApi.softwareExternalData.get({
                sourceSlug,
                externalId: externalIdForSource
            });

            if (savedExternalData && savedExternalData.softwareId === undefined) {
                await dbApi.softwareExternalData.update({
                    sourceSlug,
                    externalId: externalIdForSource,
                    softwareId,
                    lastDataFetchAt: savedExternalData?.lastDataFetchAt,
                    softwareExternalData: savedExternalData
                });
                console.log(`${logTitle} 💾 ${externalIdForSource} now binded with this software`);
            }

            if (!savedExternalData) {
                await dbApi.softwareExternalData.saveMany([
                    {
                        externalId: externalIdForSource,
                        sourceSlug,
                        softwareId: softwareId
                    }
                ]);
                console.log(`${logTitle} 💾 ${externalIdForSource} now saved and binded with this software`);
            }
        }

        if (similarSoftwareExternalDataItems && similarSoftwareExternalDataItems.length > 0) {
            await dbApi.software.saveSimilarSoftwares([
                {
                    softwareId,
                    softwareExternalDataItems: similarSoftwareExternalDataItems.map(similarSoftwareExternalData => ({
                        externalId: similarSoftwareExternalData.externalId,
                        sourceSlug: sourceSlug,
                        name: similarSoftwareExternalData.name,
                        description: similarSoftwareExternalData.description,
                        isLibreSoftware: similarSoftwareExternalData.isLibreSoftware
                    }))
                }
            ]);
            console.log(`${logTitle} 💾 Saved externalDataIds [${similarSoftwareExternalDataItems}]`);
        }

        console.timeEnd(`${logTitle} 💾 Saved`);
        return softwareId;
    };
};
