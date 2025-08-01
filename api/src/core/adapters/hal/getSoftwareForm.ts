// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import { SoftwareFormData, Source } from "../../usecases/readWriteSillData";
import { halAPIGateway } from "./HalAPI";
import { HAL } from "./HalAPI/types/HAL";
import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";
import { resolveSoftwareType } from "../../utils";

export const halRawSoftwareToSoftwareForm = async (
    halSoftware: HAL.API.Software,
    source: Source
): Promise<SoftwareFormData> => {
    const codemetaSoftware = await halAPIGateway.software.getCodemetaByUrl(halSoftware.uri_s);

    const formData: SoftwareFormData = {
        softwareName: halSoftware.title_s[0],
        softwareDescription: halSoftware.abstract_s ? halSoftware.abstract_s[0] : "",
        softwareType: resolveSoftwareType(halSoftware.softPlatform_s ?? []),
        externalIdForSource: halSoftware.docid,
        sourceSlug: source.slug,
        softwareLicense: codemetaSoftware?.license?.[0] ?? "undefined", // TODO 1 case to copyright
        similarSoftwareExternalDataItems: [],
        softwareLogoUrl: undefined,
        softwareKeywords: halSoftware.keyword_s || [],
        customAttributes: undefined
    };

    return formData;
};

export const getHalSoftwareForm: GetSoftwareFormData = memoize(
    async ({ externalId, source }): Promise<SoftwareFormData | undefined> => {
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
