// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createResolveLocalizedString } from "i18nifty/LocalizedString/reactless";
import { assert } from "tsafe/assert";
import type { Context } from "../bootstrap";
import type { Language } from "../ports/GetSoftwareExternalData";
import { resolveAdapterFromSource } from "../adapters/resolveAdapter";

type AutoFillData = {
    name: string | undefined;
    description: string | undefined;
    license: string | undefined;
    image: string | undefined;
    keywords: string[];
};

type AutoFillDataCache = Partial<Record<string, AutoFillData>>;

export type GetSoftwareFormAutoFillDataFromExternalAndOtherSources = ReturnType<
    typeof makeGetSoftwareFormAutoFillDataFromExternalAndOtherSources
>;
export const makeGetSoftwareFormAutoFillDataFromExternalAndOtherSources =
    (context: Context, autoFillDataCache: AutoFillDataCache) =>
    async ({ externalId }: { externalId: string }): Promise<AutoFillData> => {
        const cachedAutoFillData = autoFillDataCache[externalId];
        if (cachedAutoFillData !== undefined) return cachedAutoFillData;

        const { comptoirDuLibreApi } = context;

        const mainSource = await context.dbApi.source.getMainSource();

        const [softwareExternal, comptoirDuLibre] = await Promise.all([
            resolveAdapterFromSource(mainSource).softwareExternal.getById({ externalId, source: mainSource }),
            comptoirDuLibreApi.getComptoirDuLibre()
        ]);

        assert(softwareExternal !== undefined);

        const { name: externalSoftwareName } = softwareExternal;

        const comptoirDuLibreSoftware = comptoirDuLibre.softwares.find(software => {
            const format = (name: string) =>
                name
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/ g/, "");

            const { resolveLocalizedString } = createResolveLocalizedString<Language>({
                "currentLanguage": "en",
                "fallbackLanguage": "en"
            });

            return format(software.name).includes(format(resolveLocalizedString(externalSoftwareName)).substring(0, 8));
        });

        const [comptoirDuLibreLogoUrl, comptoirDuLibreKeywords] =
            comptoirDuLibreSoftware === undefined
                ? [undefined, undefined]
                : await Promise.all([
                      comptoirDuLibreApi.getIconUrl({ "comptoirDuLibreId": comptoirDuLibreSoftware.id }),
                      comptoirDuLibreApi.getKeywords({ "comptoirDuLibreId": comptoirDuLibreSoftware.id })
                  ]);

        const { resolveLocalizedString } = createResolveLocalizedString<Language>({
            "currentLanguage": "fr",
            "fallbackLanguage": "en"
        });

        const autoFillData: AutoFillData = {
            "name": resolveLocalizedString(externalSoftwareName),
            "description":
                softwareExternal.description === undefined
                    ? undefined
                    : resolveLocalizedString(softwareExternal.description),
            "license": softwareExternal.license ?? comptoirDuLibreSoftware?.licence,
            "image": softwareExternal.image ?? comptoirDuLibreLogoUrl,
            "keywords": comptoirDuLibreKeywords ?? []
        };

        autoFillDataCache[externalId] = autoFillData;

        setTimeout(
            () => {
                delete autoFillDataCache[externalId];
            },
            3 * 60 * 1000 /* 3 hours */
        );

        return autoFillData;
    };
