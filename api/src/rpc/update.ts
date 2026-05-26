// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { makeRefreshExternalData } from "../core/usecases/refreshExternalData";
import { updateSoftwareIdsByOrganisation } from "../core/usecases/getAuthorOrganization";
import { createKyselyPgDbApi } from "../core/adapters/dbApi/kysely/createPgDbApi";
import { DbApiV2 } from "../core/ports/DbApiV2";
import { Source } from "../lib/ApiTypes";
import { uiConfigSchema } from "../core/uiConfigSchema";
import rawUiConfig from "../customization/ui-config.json";

type PgDbConfig = { dbKind: "kysely"; kyselyDb: Kysely<Database> };

type DbConfig = PgDbConfig;

const getDbApiAndInitializeCache = (dbConfig: DbConfig): { dbApi: DbApiV2 } => {
    if (dbConfig.dbKind === "kysely") {
        return {
            dbApi: createKyselyPgDbApi(dbConfig.kyselyDb)
        };
    }

    const shouldNotBeReached: never = dbConfig.dbKind;
    throw new Error(`Unsupported case: ${shouldNotBeReached}`);
};

export async function startUpdateService(params: {
    env: {
        isDevEnvironnement: boolean;
        databaseUrl: string;
        updateSkipTimingInMinutes?: number;
        updateSoftwareIds?: number[];
        sources?: string[];
    };
    args: { sourceSlugs?: string[]; updateSkipTimingInMinutes?: number; updateSoftwareIds?: number[] };
}) {
    console.log("[RPC:Update] Starting fetching of external data on remote sources");
    console.time("[RPC:Update] Fetching of external data on remote sources: Done");
    const {
        isDevEnvironnement,
        databaseUrl,
        updateSkipTimingInMinutes: timeUpEnv,
        updateSoftwareIds,
        sources: sourceEnv,
        ...rest
    } = params.env;
    const {
        sourceSlugs: argSourceSlugs,
        updateSkipTimingInMinutes: argTimeUp,
        updateSoftwareIds: argUpdateSoftwareIds
    } = params.args;
    const uiConfig = uiConfigSchema.parse(rawUiConfig);

    assert<Equals<typeof rest, {}>>();

    console.log({ isDevEnvironnement });

    const kyselyDb = new Kysely<Database>({ dialect: createPgDialect(databaseUrl) });

    const { dbApi } = getDbApiAndInitializeCache({
        "dbKind": "kysely",
        "kyselyDb": kyselyDb
    });

    const updateSkipTimingInMinutes = argTimeUp ?? timeUpEnv ?? 180;
    const sources = argSourceSlugs ? argSourceSlugs : sourceEnv;
    const softwareIdsToRefresh = argUpdateSoftwareIds ?? updateSoftwareIds;

    const sourcesToUpdate = await sourceValidators({ dbApi, sourcesSlugs: sources });

    const resolveUpdate = sourcesToUpdate.map(source => {
        const refreshExternalData = makeRefreshExternalData({
            dbApi
        });

        return refreshExternalData({
            minuteSkipSince: updateSkipTimingInMinutes,
            source,
            softwareIdsToRefresh
        });
    });

    await Promise.all(resolveUpdate);

    if (uiConfig.header.menu.devOrganizations.enabled) {
        await updateSoftwareIdsByOrganisation({ dbApi });
    }

    console.timeEnd("[RPC:Update] Fetching of external data on remote sources: Done");
}

const sourceValidators = async (params: { dbApi: DbApiV2; sourcesSlugs: string[] | undefined }): Promise<Source[]> => {
    const { dbApi, sourcesSlugs } = params;
    if (Array.isArray(sourcesSlugs)) {
        if (sourcesSlugs.length === 0) throw RangeError("Source can't be empty");
        const sources = await Promise.all(
            sourcesSlugs.map(async (slug: string) => {
                const res = await dbApi.source.getByName({ name: slug });
                if (res) return res;
                else {
                    console.error(`${slug} is not found - skipping this setting`);
                    return undefined;
                }
            })
        );

        return sources.filter(source => !!source) as Source[];
    }

    return dbApi.source.getAll();
};
