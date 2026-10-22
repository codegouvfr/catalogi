// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DbApiV2, SoftwareExtrinsicCreation, WithUserId } from "../ports/DbApiV2";
import type { ResolveRepository, ResolvedRepository } from "../ports/ResolveRepository";
import { SoftwareFormData, SoftwareProtections } from "./readWriteSillData";
import { makeEnsureForgeSource } from "./ensureForgeSource";
import type { DiscoverSourcesByRepository, DiscoveredSource } from "./discoverSourcesByRepository";
import { findSoftwareIdByRepository, getRepoUrlSpellings, getRepositoryKey } from "./resolveRepoUrl";
import { normalizeRepoUrl } from "../adapters/resolveRepository";
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

type ExistingSoftwareMatch = { softwareId: number; matchedBy: "name" | "externalId" | "repository" };

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

const toAlreadyExistsError = (match: ExistingSoftwareMatch, formData: SoftwareFormData): SoftwareAlreadyExistsError => {
    switch (match.matchedBy) {
        case "name":
            return new SoftwareAlreadyExistsError(`Software already exists with name : ${formData.name.trim()}`);
        case "externalId":
            return new SoftwareAlreadyExistsError(
                `Software already exists with external id ${formData.externalIdForSource} from source ${formData.sourceSlug}`
            );
        case "repository":
            return new SoftwareAlreadyExistsError(
                `Software already exists with repository ${formData.codeRepositoryUrl}`
            );
    }
};

export const makeCreateSofware: (params: {
    dbApi: DbApiV2;
    withUserInput: boolean;
    // Without them, `codeRepositoryUrl` is only kept as user input.
    resolveRepository?: ResolveRepository;
    discoverSourcesByRepository?: DiscoverSourcesByRepository;
}) => CreateSoftware = params => {
    const { dbApi, withUserInput, resolveRepository, discoverSourcesByRepository } = params;
    const ensureForgeSource = makeEnsureForgeSource({ dbApi });

    // A failing forge must not prevent the creation: the url stays in the user input.
    // `key` identifies the repository even when the forge doesn't answer, for the duplicate check.
    const resolveFormRepository = async (
        formData: SoftwareFormData,
        logTitle: string
    ): Promise<{ repository?: ResolvedRepository; key?: ReturnType<typeof getRepositoryKey> }> => {
        const normalizedUrl = formData.codeRepositoryUrl && normalizeRepoUrl(formData.codeRepositoryUrl);
        if (!resolveRepository || !normalizedUrl) return {};
        try {
            const sources = await dbApi.source.getAll();
            const resolution = await resolveRepository({ url: normalizedUrl, sources });
            return {
                repository: resolution.status === "found" ? resolution.repository : undefined,
                key: getRepositoryKey({ resolution, normalizedUrl })
            };
        } catch (error) {
            console.error(`${logTitle} repository ${formData.codeRepositoryUrl} not resolved`, error);
            return {};
        }
    };

    const discoverFormRepositorySources = async (
        formData: SoftwareFormData,
        repository: ResolvedRepository | undefined,
        logTitle: string
    ): Promise<DiscoveredSource[]> => {
        if (!discoverSourcesByRepository || !formData.codeRepositoryUrl) return [];
        try {
            return await discoverSourcesByRepository({
                repoUrls: getRepoUrlSpellings({ input: formData.codeRepositoryUrl, repository }),
                sources: await dbApi.source.getAll()
            });
        } catch (error) {
            console.error(`${logTitle} sources citing ${formData.codeRepositoryUrl} not discovered`, error);
            return [];
        }
    };

    const bindExternalData = async (params: {
        softwareId: number;
        sourceSlug: string;
        externalId: string;
        logTitle: string;
    }) => {
        const { softwareId, sourceSlug, externalId, logTitle } = params;

        const savedExternalData = await dbApi.softwareExternalData.get({ sourceSlug, externalId });

        const isSourceCategoryTaken =
            savedExternalData?.softwareId !== softwareId &&
            (await dbApi.softwareExternalData.hasSourceCategory({ softwareId, sourceSlug }));

        if (isSourceCategoryTaken) {
            console.log(
                `${logTitle} software #${softwareId} already has external data in the category of ${sourceSlug}, ${externalId} not bound`
            );
        } else if (savedExternalData && savedExternalData.softwareId === undefined) {
            await dbApi.softwareExternalData.update({
                sourceSlug,
                externalId,
                softwareId,
                lastDataFetchAt: savedExternalData?.lastDataFetchAt,
                softwareExternalData: savedExternalData
            });
            console.log(`${logTitle} 💾 ${externalId} now binded with this software`);
        } else if (!savedExternalData) {
            await dbApi.softwareExternalData.saveMany([{ externalId, sourceSlug, softwareId }]);
            console.log(`${logTitle} 💾 ${externalId} now saved and binded with this software`);
        }
    };

    return async ({ formData, userId, isAdmin = false }) => {
        const { name: softwareName, similarSoftwareExternalDataItems, externalIdForSource, sourceSlug } = formData;
        const logTitle = `[UC:${textUC}] (${softwareName} from ${sourceSlug}) -`;

        console.time(`${logTitle} 💾 Saved`);

        const { repository, key: repositoryKey } = await resolveFormRepository(formData, logTitle);
        const discoveredSources = await discoverFormRepositorySources(formData, repository, logTitle);

        const match: ExistingSoftwareMatch | undefined = await (async () => {
            const existing = await resolveExistingSoftware({ dbApi, formData });
            if (existing) return existing;

            const softwareId =
                (repositoryKey &&
                    (await findSoftwareIdByRepository({
                        dbApi,
                        sources: await dbApi.source.getAll(),
                        repository: repositoryKey
                    }))) ??
                discoveredSources.find(source => source.existingSoftwareId !== undefined)?.existingSoftwareId;
            return softwareId === undefined ? undefined : { softwareId, matchedBy: "repository" };
        })();

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
            await bindExternalData({ softwareId, sourceSlug, externalId: externalIdForSource, logTitle });
        }

        // The software exists at this point: a failing binding is left to the next refresh.
        try {
            if (repository) {
                const forgeSource = await ensureForgeSource({ kind: repository.forgeKind, url: repository.url });
                if (forgeSource) {
                    await bindExternalData({
                        softwareId,
                        sourceSlug: forgeSource.slug,
                        externalId: repository.externalId,
                        logTitle
                    });
                }
            }

            for (const discoveredSource of discoveredSources) {
                await bindExternalData({
                    softwareId,
                    sourceSlug: discoveredSource.sourceSlug,
                    externalId: discoveredSource.externalId,
                    logTitle
                });
            }
        } catch (error) {
            console.error(`${logTitle} sources of ${formData.codeRepositoryUrl} not bound`, error);
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
