// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type {
    GetSoftwareExternalDataOptions,
    SoftwareExternalDataOption
} from "../../ports/GetSoftwareExternalDataOptions";
import type { Source, Language } from "shared";
import { HAL } from "./HalAPI/types/HAL";
import { halAPIGateway } from "./HalAPI";

const rawHalSoftwareToExternalOption =
    ({ language, source }: { language: Language; source: Source }) =>
    (halSoftware: HAL.API.Software): SoftwareExternalDataOption => {
        const enLabel = halSoftware?.en_title_s?.[0] ?? halSoftware?.title_s?.[0] ?? "-";
        const labelByLang = {
            "en": enLabel,
            "fr": halSoftware?.fr_title_s?.[0] ?? enLabel
        };

        const enDescription = halSoftware?.en_abstract_s?.[0] ?? halSoftware.abstract_s?.[0] ?? "-";
        const descriptionByLang = {
            "en": enDescription,
            "fr": halSoftware?.fr_abstract_s?.[0] ?? enDescription
        };

        return {
            externalId: halSoftware.docid,
            label: labelByLang[language],
            description: descriptionByLang[language],
            isLibreSoftware: halSoftware.openAccess_bool,
            sourceSlug: source.slug
        };
    };

// HAL documentation is here : https://api.archives-ouvertes.fr/docs/search

export const getHalSoftwareOptions: GetSoftwareExternalDataOptions = async ({ queryString, language, source }) => {
    if (source.kind !== "HAL") throw new Error(`Not a HAL source, was : ${source.kind}`);

    // todo make something so that we can give the source to the halApiGateway (so that it can be configured, with the correct url)
    const rawHalSoftwares = await halAPIGateway.software.getAll({ queryString });
    return rawHalSoftwares.map(rawHalSoftwareToExternalOption({ language, source }));
};
