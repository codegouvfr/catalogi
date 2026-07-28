// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DbApiV2 } from "../ports/DbApiV2";
import { makeHalAPIGateway } from "../adapters/hal/HalAPI";
import { makeCreateSofware } from "./createSoftware";
import { Source } from "./readWriteSillData";
import { GetSoftwareFormData } from "../ports/GetSoftwareFormData";
import { resolveAdapterFromSource } from "../adapters/resolveAdapter";
import { makeZenodoApi } from "../adapters/zenodo/zenodoAPI";
import { USER_INPUT_SOURCE_SLUG } from "../adapters/dbApi/kysely/kysely.database";
import { formatRecordToSoftwareFormData } from "../adapters/zenodo/getZenodoSoftwareForm";
import { saveExternalData } from "./refreshExternalData";
import { formatRecordToExternalData } from "../adapters/zenodo/getZenodoExternalData";

export type ImportFromSource = (params: {
    userEmail: string;
    source: Source;
    softwareIdOnSource?: string[];
}) => Promise<number[]>;

export const importFromSource: (dbApi: DbApiV2) => ImportFromSource = (dbApi: DbApiV2) => {
    return async ({ userEmail, source, softwareIdOnSource }) => {
        const sourceGateway = resolveAdapterFromSource(source);

        if (!sourceGateway?.software?.getSoftwareForm)
            throw new Error("[UC:Import] Import if not possible from a secondary source");

        const user = await dbApi.user.getByEmail(userEmail);
        const userId = user
            ? user.id
            : await dbApi.user.add({
                  email: userEmail,
                  "isPublic": false,
                  organization: "",
                  about: "This is a bot user created to import data.",
                  sub: null,
                  role: "user"
              });

        let result: Array<number | undefined> = [];

        if ((softwareIdOnSource && softwareIdOnSource.length > 0) || ["HAL"].includes(source.kind)) {
            const softwareIds =
                softwareIdOnSource && softwareIdOnSource.length > 0 && softwareIdOnSource[0] !== ""
                    ? softwareIdOnSource
                    : await resolveAllIdsAccordingToSource(source);

            console.info(`[UC:Import] Importing  ${softwareIds.length} software packages from ${source.slug}`);

            for (const externalId of softwareIds) {
                const newId = await checkSoftware(
                    dbApi,
                    source,
                    externalId,
                    sourceGateway.software.getSoftwareForm,
                    userId
                );
                result.push(newId);
            }
        } else if (["Zenodo"].includes(source.kind)) {
            // Direct import
            result = await directImportFromSource({ dbApi, source, userId });
        }

        return result.filter(val => val != undefined);
    };
};

const resolveAllIdsAccordingToSource = async (source: Source): Promise<string[]> => {
    switch (source.kind) {
        case "HAL":
            const halAPIGateway = makeHalAPIGateway(source);
            return (await halAPIGateway.software.getAllIds({ SWHFilter: true })).map(doc => doc.docid);
        case "Zenodo":
        case "ComptoirDuLibre":
        case "wikidata":
        case "GitHub":
        case "GitLab":
            throw new Error("[UC:Import] Not Implemented, but you can specify the list of ids you want to import");
        // Secondary Sources
        case "CNLL":
        case "RNSR":
        case "ROR":
            throw new Error("[UC:Import] Import if not possible from a secondary or non software source");
        case USER_INPUT_SOURCE_SLUG:
            throw new Error("[UC:Import] UserInput is not importable: it has no gateway");
        default:
            const shouldNotBeReached: never = source.kind;
            throw new Error("[UC:Import] Not Implemented", shouldNotBeReached);
    }
};

const checkSoftware = async (
    dbApi: DbApiV2,
    source: Source,
    externalId: string,
    getSoftwareForm: GetSoftwareFormData,
    userId: number
) => {
    // Get software form from source
    const softwareForm = await getSoftwareForm({ externalId, source });
    if (!softwareForm || !softwareForm.name) {
        return undefined;
    }

    console.info(
        `[UC:Import] Importing ${softwareForm.name}(${externalId}) from ${source.slug} : Adding software and externalData `
    );
    const createSoftware = makeCreateSofware({ dbApi, withUserInput: false });
    return createSoftware({ formData: softwareForm, userId });
};

const directImportFromSource = async (params: { dbApi: DbApiV2; source: Source; userId: number }) => {
    const { source, dbApi, userId } = params;
    const createSoftware = makeCreateSofware({ dbApi, withUserInput: false });

    switch (source.kind) {
        case "HAL":
            throw new Error("[UC:Import] Massive import is not implement using direct data, use ids instead");
        case "Zenodo":
            const zenodoAPI = makeZenodoApi(source);
            let end = true;
            let page = 1;
            const saved: number[] = [];

            const sources = await dbApi.source.getAll();

            // 401 limit page Zenodo API
            while (end && page < 401) {
                const softwareRecords = await zenodoAPI.records.getAllSoftware({
                    page,
                    date: source.lastImport ?? new Date("1968")
                });

                if (softwareRecords.hits.hits.length === 0) {
                    end = false;
                    continue;
                }

                // Save soft
                for (const softwareRecord of softwareRecords.hits.hits) {
                    const result = await createSoftware({
                        formData: formatRecordToSoftwareFormData(softwareRecord, source),
                        userId
                    });

                    await saveExternalData({
                        dbApi,
                        sourceSlug: source.slug,
                        sources,
                        externalData: formatRecordToExternalData(softwareRecord, [], source),
                        externalId: softwareRecord.id.toString()
                    });

                    saved.push(result);
                }

                dbApi.source.updateLastImport({
                    name: source.slug,
                    date: softwareRecords.hits.hits[softwareRecords.hits.hits.length - 1].created
                });

                page++;
            }

            return saved;
        case "ComptoirDuLibre":
        case "wikidata":
        case "GitHub":
        case "GitLab":
            throw new Error("[UC:Import] Not Implemented, but you can specify the list of ids you want to import");
        // Secondary Sources
        case "CNLL":
        case "RNSR":
        case "ROR":
            throw new Error("[UC:Import] Import if not possible from a secondary or non software source");
        case USER_INPUT_SOURCE_SLUG:
            throw new Error("[UC:Import] UserInput is not importable: it has no gateway");
        default:
            const shouldNotBeReached: never = source.kind;
            throw new Error("[UC:Import] Not Implemented", shouldNotBeReached);
    }
};
