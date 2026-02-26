// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type {
    GetSoftwareExternalDataOptions,
    SoftwareExternalDataOption
} from "../../ports/GetSoftwareExternalDataOptions";
import { Language } from "../../ports/GetSoftwareExternalData";
import { Source } from "../../usecases/readWriteSillData";
import { comptoirDuLibreApi } from "../comptoirDuLibreApi";
import { ComptoirDuLibre } from "../../ports/ComptoirDuLibreApi";

export const rawCDLSoftwareToExternalOption =
    ({ source }: { language: Language; source: Source }) =>
    (cdlSoftware: ComptoirDuLibre.Software): SoftwareExternalDataOption => {
        return {
            externalId: cdlSoftware.id.toString(),
            name: cdlSoftware.name,
            description: "",
            isLibreSoftware: true,
            sourceSlug: source.slug
        };
    };

export const getCDLSoftwareOptions: GetSoftwareExternalDataOptions = async ({ queryString, language, source }) => {
    if (source.kind !== "ComptoirDuLibre") throw new Error(`Not a Comptoir Du Libre source, was : ${source.kind}`);

    const { softwares: cdlAllSoftwarePackages } = await comptoirDuLibreApi.getComptoirDuLibre();
    const comptoirSoftwarePackage = cdlAllSoftwarePackages.filter(softwareItem =>
        softwareItem.name.includes(queryString)
    );

    if (!comptoirSoftwarePackage) return [];

    return comptoirSoftwarePackage.map(rawCDLSoftwareToExternalOption({ language, source }));
};
