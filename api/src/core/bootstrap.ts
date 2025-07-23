// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { comptoirDuLibreApi } from "./adapters/comptoirDuLibreApi";
import { createKyselyPgDbApi } from "./adapters/dbApi/kysely/createPgDbApi";
import { Database } from "./adapters/dbApi/kysely/kysely.database";
import type { ComptoirDuLibreApi } from "./ports/ComptoirDuLibreApi";
import { DbApiV2 } from "./ports/DbApiV2";
import { UiConfig, uiConfigSchema } from "./uiConfigSchema";
import { UseCasesUsedOnRouter } from "../rpc/router";
import { makeHandleAuthCallback } from "./usecases/auth/handleAuthCallback";
import { makeInitiateAuth } from "./usecases/auth/initiateAuth";
import { makeInitiateLogout } from "./usecases/auth/logout";
import { HttpOidcClient, TestOidcClient, type OidcParams } from "./usecases/auth/oidcClient";
import { makeGetUser } from "./usecases/getUser";
import { makeGetSoftwareFormAutoFillDataFromExternalAndOtherSources } from "./usecases/getSoftwareFormAutoFillDataFromExternalAndOtherSources";
import rawUiConfig from "../customization/ui-config.json";
import { makeCreateSofware } from "./usecases/createSoftware";
import { makeUpdateSoftware } from "./usecases/updateSoftware";
import { makeRefreshExternalDataForSoftware } from "./usecases/refreshExternalData";
import { makeGetPopulatedSoftware } from "./usecases/getPopulatedSoftware";

type PgDbConfig = { dbKind: "kysely"; kyselyDb: Kysely<Database> };

type DbConfig = PgDbConfig;

type ParamsOfBootstrapCore = {
    dbConfig: DbConfig;
    oidcKind: "http" | "test";
    oidcParams: OidcParams;
};

export type Context = {
    paramsOfBootstrapCore: ParamsOfBootstrapCore;
    dbApi: DbApiV2;
    comptoirDuLibreApi: ComptoirDuLibreApi;
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
): Promise<{ dbApi: DbApiV2; context: Context; useCases: UseCasesUsedOnRouter; uiConfig: UiConfig }> {
    const { dbConfig, oidcParams } = params;
    const uiConfig = uiConfigSchema.parse(rawUiConfig);

    const { dbApi } = getDbApiAndInitializeCache(dbConfig);

    // clean up old sessions, where no user ended connecting (we do this on app start to avoid handling a cron job)
    await dbApi.session.deleteSessionsNotCompletedByUser();

    const context: Context = {
        "paramsOfBootstrapCore": params,
        dbApi,
        comptoirDuLibreApi
    };

    const oidcClient =
        params.oidcKind === "http" ? await HttpOidcClient.create(oidcParams) : new TestOidcClient(oidcParams);

    const useCases: UseCasesUsedOnRouter = {
        getSoftwareFormAutoFillDataFromExternalAndOtherSources:
            makeGetSoftwareFormAutoFillDataFromExternalAndOtherSources(context, {}),
        getUser: makeGetUser({ userRepository: dbApi.user }),
        fetchAndSaveExternalDataForOneSoftwarePackage: makeRefreshExternalDataForSoftware({ dbApi }),
        createSoftware: makeCreateSofware(dbApi),
        updateSoftware: makeUpdateSoftware(dbApi),
        getPopulateSoftware: makeGetPopulatedSoftware(dbApi),
        auth: {
            initiateAuth: makeInitiateAuth({ sessionRepository: dbApi.session, oidcClient }),
            handleAuthCallback: makeHandleAuthCallback({
                sessionRepository: dbApi.session,
                userRepository: dbApi.user,
                oidcClient
            }),
            initiateLogout: makeInitiateLogout({ sessionRepository: dbApi.session, oidcClient })
        }
    };

    return { dbApi, context, useCases, uiConfig };
}
