// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { comptoirDuLibreApi } from "./adapters/comptoirDuLibreApi";
import { createKyselyPgDbApi } from "./adapters/dbApi/kysely/createPgDbApi";
import { Database } from "./adapters/dbApi/kysely/kysely.database";
import { makeFetchAndSaveExternalDataForAllSoftwares } from "./adapters/fetchExternalData";
import { getCnllPrestatairesSill } from "./adapters/getCnllPrestatairesSill";
import { getServiceProviders } from "./adapters/getServiceProviders";
import { wikidataSourceGateway } from "./adapters/wikidata";
import { halSourceGateway } from "./adapters/hal";
import type { ComptoirDuLibreApi } from "./ports/ComptoirDuLibreApi";
import { DbApiV2 } from "./ports/DbApiV2";
import type { ExternalDataOrigin, GetSoftwareExternalData } from "./ports/GetSoftwareExternalData";
import type { GetSoftwareExternalDataOptions } from "./ports/GetSoftwareExternalDataOptions";
import { UiConfig, uiConfigSchema } from "./uiConfigSchema";
import { UseCases } from "./usecases";
import { makeHandleAuthCallback, makeInitiateAuth, makeLogout } from "./usecases/auth";
import { makeGetUser } from "./usecases/getUser";
import { makeGetSoftwareFormAutoFillDataFromExternalAndOtherSources } from "./usecases/getSoftwareFormAutoFillDataFromExternalAndOtherSources";
import rawUiConfig from "../customization/ui-config.json";

type PgDbConfig = { dbKind: "kysely"; kyselyDb: Kysely<Database> };

type DbConfig = PgDbConfig;

type ParamsOfBootstrapCore = {
    dbConfig: DbConfig;
    externalSoftwareDataOrigin: ExternalDataOrigin;
    oidcParams: import("./usecases/auth").OidcParams;
};

export type Context = {
    paramsOfBootstrapCore: ParamsOfBootstrapCore;
    dbApi: DbApiV2;
    comptoirDuLibreApi: ComptoirDuLibreApi;
    getSoftwareExternalData: GetSoftwareExternalData;
};

const getDbApiAndInitializeCache = (dbConfig: DbConfig): { dbApi: DbApiV2 } => {
    if (dbConfig.dbKind === "kysely") {
        return {
            dbApi: createKyselyPgDbApi(dbConfig.kyselyDb)
        };
    }

    const shouldNotBeReached: never = dbConfig.dbKind;
    throw new Error(`Unsupported case: ${shouldNotBeReached}`);
};

export async function bootstrapCore(
    params: ParamsOfBootstrapCore
): Promise<{ dbApi: DbApiV2; context: Context; useCases: UseCases; uiConfig: UiConfig }> {
    const { dbConfig, externalSoftwareDataOrigin, oidcParams } = params;
    const uiConfig = uiConfigSchema.parse(rawUiConfig);

    const { getSoftwareExternalData } = getSoftwareExternalDataFunctions(externalSoftwareDataOrigin);

    const { dbApi } = getDbApiAndInitializeCache(dbConfig);

    const context: Context = {
        "paramsOfBootstrapCore": params,
        dbApi,
        comptoirDuLibreApi,
        getSoftwareExternalData
    };

    const wikidataSource = await dbApi.source.getWikidataSource();

    const useCases: UseCases = {
        getSoftwareFormAutoFillDataFromExternalAndOtherSources:
            makeGetSoftwareFormAutoFillDataFromExternalAndOtherSources(context, {}),
        fetchAndSaveExternalDataForAllSoftwares: await makeFetchAndSaveExternalDataForAllSoftwares({
            getSoftwareExternalData,
            getCnllPrestatairesSill,
            comptoirDuLibreApi,
            getServiceProviders,
            dbApi,
            wikidataSource
        }),
        getUser: makeGetUser({ userRepository: dbApi.user }),
        auth: {
            initiateAuth: await makeInitiateAuth({ sessionRepository: dbApi.session, oidcParams }),
            handleAuthCallback: await makeHandleAuthCallback({
                sessionRepository: dbApi.session,
                userRepository: dbApi.user,
                oidcParams
            }),
            logout: makeLogout({ sessionRepository: dbApi.session })
        }
    };

    return { dbApi, context, useCases, uiConfig };
}

function getSoftwareExternalDataFunctions(externalSoftwareDataOrigin: ExternalDataOrigin): {
    "getSoftwareExternalDataOptions": GetSoftwareExternalDataOptions;
    "getSoftwareExternalData": GetSoftwareExternalData;
} {
    switch (externalSoftwareDataOrigin) {
        case "wikidata":
            return {
                "getSoftwareExternalDataOptions": wikidataSourceGateway.softwareOptions.getById,
                "getSoftwareExternalData": wikidataSourceGateway.softwareExternalData.getById
            };
        case "HAL":
            return {
                "getSoftwareExternalDataOptions": halSourceGateway.softwareOptions.getById,
                "getSoftwareExternalData": halSourceGateway.softwareExternalData.getById
            };
        default:
            const unreachableCase: never = externalSoftwareDataOrigin;
            throw new Error(`Unreachable case: ${unreachableCase}`);
    }
}
