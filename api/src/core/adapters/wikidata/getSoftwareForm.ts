// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";
import { SoftwareFormData } from "../../usecases/readWriteSillData";
import { createGetClaimDataValue, fetchEntity, WikidataFetchError } from "./getWikidataSoftware";

export const getWikidataForm: GetSoftwareFormData = async ({
    externalId,
    source
}): Promise<SoftwareFormData | undefined> => {
    try {
        console.info(`   -> fetching wiki soft : ${externalId}`);
        const { entity } =
            (await fetchEntity(externalId).catch(error => {
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

        const { getClaimDataValue } = createGetClaimDataValue({ entity });

        const logoName = getClaimDataValue<"string">("P154")[0];

        const license = await (async () => {
            const licenseId = getClaimDataValue<"wikibase-entityid">("P275")[0]?.id;

            if (licenseId === undefined) {
                return undefined;
            }

            console.info(`I   -> fetching wiki license : ${licenseId}`);
            const { entity } = await fetchEntity(licenseId).catch(() => ({ "entity": undefined }));

            if (entity === undefined) {
                return undefined;
            }

            return { "label": entity.aliases.en?.[0]?.value, "id": licenseId };
        })();

        const name =
            entity.labels?.en?.value ?? entity.labels?.fr?.value ?? entity.labels[Object.keys(entity.labels)[0]].value;
        const description =
            entity.descriptions?.en?.value ??
            entity.descriptions?.fr?.value ??
            entity.descriptions?.[Object.keys(entity.descriptions)[0]]?.value ??
            "";

        return {
            name,
            description,
            operatingSystems: { "linux": true, "windows": true, "android": false, "ios": false, "mac": false },
            runtimePlatforms: ["desktop"],
            externalIdForSource: externalId,
            sourceSlug: source.slug,
            license: license?.label ?? "Copyright",
            similarSoftwareExternalDataItems: [],
            image: `https://upload.wikimedia.org/wikipedia/commons/6/69/${logoName?.replace(" ", "_") ?? ""}`,
            keywords: [],
            customAttributes: undefined
        };
    } catch (error) {
        console.error(`Error for ${externalId} : `, error);
        // Expected output: ReferenceError: nonExistentFunction is not defined
        // (Note: the exact output may be browser-dependent)
    }
};
