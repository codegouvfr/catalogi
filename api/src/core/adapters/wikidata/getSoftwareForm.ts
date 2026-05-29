// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";
import { SoftwareFormData } from "../../usecases/readWriteSillData";
import { makeWikidataAPIAgent } from "./ApiAgent";
import { WikidataFetchError } from "./ApiAgent/entity";

export const getWikidataForm: GetSoftwareFormData = async ({
    externalId,
    source
}): Promise<SoftwareFormData | undefined> => {
    try {
        console.info(`   -> fetching wiki soft : ${externalId}`);
        const wikidataAgent = makeWikidataAPIAgent(source);

        const { entity } =
            (await wikidataAgent.fetchEntity(externalId).catch(error => {
                if (error instanceof WikidataFetchError) {
                    if (error.status === 404 || error.status === undefined) {
                        return undefined;
                    }
                    throw error;
                }
            })) ?? {};

        if (entity === undefined) {
            return undefined;
        }

        const name =
            entity.labels?.en?.value ?? entity.labels?.fr?.value ?? entity.labels[Object.keys(entity.labels)[0]].value;

        return {
            name,
            nameOverride: null,
            description: null,
            operatingSystems: { "linux": true, "windows": true, "android": false, "ios": false, "mac": false },
            runtimePlatforms: ["desktop"],
            externalIdForSource: externalId,
            sourceSlug: source.slug,
            license: null,
            similarSoftwareExternalDataItems: [],
            image: null,
            keywords: [],
            customAttributes: undefined,
            isLibreSoftware: null,
            url: null,
            codeRepositoryUrl: null,
            softwareHelp: null,
            latestVersion: null
        };
    } catch (error) {
        console.error(`Error for ${externalId} : `, error);
        // Expected output: ReferenceError: nonExistentFunction is not defined
        // (Note: the exact output may be browser-dependent)
    }
};
