// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { convertSourceConfigToRequestInit } from "../../../../tools/sourceConfig";
import { Source } from "../../../usecases/readWriteSillData";
import { HAL } from "./types/HAL";

const HAL_API_TIMEOUT = 60000;

export const makeHalAPIGateway = (source: Source) => {
    const overLoadedConfig = {
        ...source.configuration,
        rateLimitRetryDuration: source.configuration?.rateLimitRetryDuration ?? HAL_API_TIMEOUT
    };

    const halArticleFieldsToReturn: (keyof HAL.API.Article)[] = ["en_title_s", "fr_title_s", "docid", "title_s"];
    const halSoftwareFieldsToReturn: (keyof HAL.API.Software)[] = [
        "en_abstract_s",
        "en_title_s",
        "fr_abstract_s",
        "fr_title_s",
        "docid",
        "uri_s",
        "openAccess_bool",
        "label_bibtex",
        "title_s",
        "abstract_s",
        "docType_s",
        "keyword_s",
        "softVersion_s",
        "softPlatform_s",
        "softCodeRepository_s",
        "authFullName_s",
        "authIdHal_s",
        "releasedDate_tdate",
        "softProgrammingLanguage_s",
        "softVersion_s",
        "authIdForm_i",
        "relatedData_s",
        "relatedPublication_s",
        "relatedSoftware_s",
        "domainAllCode_s",
        "label_xml"
    ];
    const halSoftwareFieldsToReturnAsString = halSoftwareFieldsToReturn.join(",");

    const getHalRequest = async <T>(url: string): Promise<T | undefined> => {
        const res = await fetch(url, convertSourceConfigToRequestInit(overLoadedConfig)).catch(err => {
            console.error(err);
            throw new HAL.API.FetchError(undefined);
        });

        if (res.status === 429) {
            await new Promise(resolve => setTimeout(resolve, overLoadedConfig.rateLimitRetryDuration));
            return getHalRequest(url);
        }

        if (res.status === 404) {
            throw new HAL.API.FetchError(res.status);
        }

        const json = await res.json();

        if (json.error) {
            throw new HAL.API.FetchError(json.error);
        }

        return json as T;
    };
    const getHalApiRequest = <T>(url: string) => getHalRequest<HAL.APIReponse<T>>(url);

    return {
        software: {
            getById: async (halDocid: string) => {
                const url = `https://api.archives-ouvertes.fr/search/?q=docid:${halDocid}&wt=json&fl=${halSoftwareFieldsToReturnAsString}&sort=docid%20asc`;
                const json = await getHalApiRequest<HAL.API.Software>(url);
                return json?.response.numFound === 1 ? json.response.docs?.[0] : undefined;
            },
            getAll: async (params: { queryString?: string; SWHFilter?: boolean }) => {
                const { queryString, SWHFilter } = params;
                let url = `https://api.archives-ouvertes.fr/search/?fq=docType_s:SOFTWARE&rows=10000&fl=${halSoftwareFieldsToReturnAsString}`;

                if (queryString) {
                    url = url + `&q=${encodeURIComponent(queryString)}`;
                }

                // Filter only software who have an swhidId to filter clean data on https://hal.science, TODO remove and set it as an option to be generic
                if (SWHFilter) {
                    url = url + `&fq=swhidId_s:["" TO *]`;
                }

                const json = await getHalApiRequest<HAL.API.Software>(url);
                return json?.response.docs;
            },
            getCodemetaByUrl: (urlSoftwareDoc: string) => {
                const url = `${urlSoftwareDoc}/codemeta`;
                return getHalRequest<HAL.SoftwareApplication>(url);
            }
        },
        domain: {
            getByCode: async (code: string) => {
                const url = `http://api.archives-ouvertes.fr/ref/domain/?q=code_s:${code}&fl=*`;
                const json = await getHalApiRequest<HAL.API.Domain>(url);
                return json?.response.numFound === 1 ? json.response.docs?.[0] : undefined;
            },
            gelAll: () => async () => {
                const url = "http://api.archives-ouvertes.fr/ref/domain/?fl=*";
                const json = await getHalApiRequest<HAL.API.Domain>(url);
                return json?.response?.docs ?? [];
            }
        },
        structure: {
            getById: async (docid: number) => {
                const url = `http://api.archives-ouvertes.fr/ref/structure/?fl=*&q=docid:${docid}`;
                const json = await getHalApiRequest<HAL.API.Structure>(url);
                return json?.response.numFound === 1 ? json.response.docs?.[0] : undefined;
            },
            getByAcronym: async (structureAcronym: string) => {
                const url = `http://api.archives-ouvertes.fr/ref/structure/?fl=*&q=acronym_s:"${encodeURIComponent(
                    structureAcronym
                )}"`;

                const json = await getHalApiRequest<HAL.API.Structure>(url);

                // What do to when multiple for one acronym while in code meta only reference to acronym => LIDILEM, EPFL
                return json?.response.docs?.[0]; // json.response.numFound === 1 ? : undefined;
            }
        },
        article: {
            getById: async (articleHalId: string) => {
                // CURATED - FIX HAL
                // When doing a research with HAL id with ***v* -> Don't work
                const idForAPI =
                    articleHalId.substring(articleHalId.length - 2, articleHalId.length - 1) === "v"
                        ? articleHalId.substring(0, articleHalId.length - 2)
                        : articleHalId;
                // END OF CURATED - FIX HAL

                // Get domain using code
                const url = `https://api.archives-ouvertes.fr/search/?q=halId_id:${idForAPI}&fl=${halArticleFieldsToReturn.join(",")}`;

                const json = await getHalApiRequest<HAL.API.Article>(url);

                if (json && json.response.docs.length > 1)
                    console.warn(`HAL getArticleById multiples article for id : ${articleHalId}`);

                return json?.response.docs[0];
            }
        }
    };
};
