// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import { SoftwareFormData, Source } from "../../usecases/readWriteSillData";
import { makeHalAPIGateway } from "./HalAPI";
import { HAL } from "./HalAPI/types/HAL";
import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";
import { resolveOsAndPlatforms } from "../../utils";

export const halRawSoftwareToSoftwareForm = async (
    halSoftware: HAL.API.Software,
    source: Source
): Promise<SoftwareFormData> => {
    const formData: SoftwareFormData = {
        name: halSoftware.title_s[0],
        nameOverride: null,
        description: null,
        ...resolveOsAndPlatforms(halSoftware.softPlatform_s ?? []),
        externalIdForSource: halSoftware.docid,
        sourceSlug: source.slug,
        license: null,
        similarSoftwareExternalDataItems: [],
        image: null,
        keywords: halSoftware.keyword_s || [],
        customAttributes: undefined,
        isLibreSoftware: null,
        url: null,
        codeRepositoryUrl: null,
        softwareHelp: null,
        latestVersion: null
    };

    return formData;
};

export const getHalSoftwareForm: GetSoftwareFormData = memoize(
    async ({ externalId, source }): Promise<SoftwareFormData | undefined> => {
        const halAPIGateway = makeHalAPIGateway(source);
        const halRawSoftware = await halAPIGateway.software.getById(externalId).catch(error => {
            if (!(error instanceof HAL.API.FetchError)) throw error;
            if (error.status === 404 || error.status === undefined) return;
            throw error;
        });

        if (!halRawSoftware) {
            throw Error();
        }

        return halRawSoftwareToSoftwareForm(halRawSoftware, source);
    }
);
