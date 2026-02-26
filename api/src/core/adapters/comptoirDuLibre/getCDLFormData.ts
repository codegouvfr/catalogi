// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";
import { SoftwareFormData, Source } from "../../usecases/readWriteSillData";
import { comptoirDuLibreApi } from "../comptoirDuLibreApi";
import { ComptoirDuLibre } from "../../ports/ComptoirDuLibreApi";

const formatCDLSoftwareToExternalData = async (
    comptoirSoftware: ComptoirDuLibre.Software,
    source: Source
): Promise<SoftwareFormData> => {
    const keywords = await comptoirDuLibreApi.getKeywords({ comptoirDuLibreId: comptoirSoftware.id });
    const logoUrl = await comptoirDuLibreApi.getIconUrl({ comptoirDuLibreId: comptoirSoftware.id });

    return {
        name: comptoirSoftware.name,
        description: "",
        operatingSystems: { "linux": false, "windows": false, "android": false, "ios": false, "mac": false },
        runtimePlatforms: ["desktop"], // TODO Check Mandatory, Incorrect data
        externalIdForSource: comptoirSoftware.id.toString(),
        sourceSlug: source.slug,
        license: comptoirSoftware.licence,
        similarSoftwareExternalDataItems: [],
        image: logoUrl,
        keywords: keywords,
        customAttributes: undefined
    };
};

export const getCDLFormData: GetSoftwareFormData = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareFormData | undefined> => {
        const comptoirAPi = await comptoirDuLibreApi.getComptoirDuLibre();

        const comptoirSoftware = comptoirAPi.softwares.find(softwareItem => softwareItem.id.toString() === externalId);

        if (!comptoirSoftware) return undefined;

        return formatCDLSoftwareToExternalData(comptoirSoftware, source);
    }
);
