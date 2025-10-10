// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import { SoftwareFormData, SoftwareType, Source } from "../../usecases/readWriteSillData";
import { halAPIGateway } from "./HalAPI";
import { HAL } from "./HalAPI/types/HAL";
import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";

const stringOfArrayIncluded = (stringArray: Array<string>, text: string): boolean => {
    return stringArray.some((arg: string) => {
        return text.includes(arg);
    });
};

const textToSoftwareType = (text: string): SoftwareType => {
    if (text.includes("docker")) {
        return {
            type: "cloud"
        };
    }

    const linux = stringOfArrayIncluded(["linux", "ubuntu", "unix", "multiplatform", "all"], text);
    const windows = stringOfArrayIncluded(["windows", "multiplatform", "all"], text);
    const mac = stringOfArrayIncluded(["mac", "unix", "multiplatform", "all"], text);

    const android = text.includes("android");
    const ios = stringOfArrayIncluded(["ios", "os x", "unix", "Multiplatform", "all"], text);

    return {
        type: "desktop/mobile",
        os: { "linux": linux, "windows": windows, "android": android, "ios": ios, "mac": mac }
    };
};

export const halRawSoftwareToSoftwareForm = async (
    halSoftware: HAL.API.Software,
    source: Source
): Promise<SoftwareFormData> => {
    const codemetaSoftware = await halAPIGateway.software.getCodemetaByUrl(halSoftware.uri_s);

    const formData: SoftwareFormData = {
        softwareName: halSoftware.title_s[0],
        softwareDescription: halSoftware.abstract_s ? halSoftware.abstract_s[0] : "",
        softwareType: textToSoftwareType(
            halSoftware.softPlatform_s ? halSoftware.softPlatform_s.join("").toLocaleLowerCase() : ""
        ),
        externalIdForSource: halSoftware.docid,
        sourceSlug: source.slug,
        softwareLicense: codemetaSoftware?.license?.[0] ?? "undefined", // TODO 1 case to copyright
        softwareMinimalVersion: undefined,
        similarSoftwareExternalDataIds: [],
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
