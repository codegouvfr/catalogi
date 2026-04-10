// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import rawUiConfig from "../../../../customization/ui-config.json";
import { DbApiV2 } from "../../../ports/DbApiV2";
import { createGetCompiledData } from "./createGetCompiledData";
import { createPgUserRepository } from "./createPgUserRepository";
import { createPgInstanceRepository } from "./createPgInstanceRepository";
import { createPgSessionRepository } from "./createPgSessionRepository";
import { createPgSoftwareExternalDataRepository } from "./createPgSoftwareExternalDataRepository";
import { createPgSoftwareRepository } from "./createPgSoftwareRepository";
import { createPgSourceRepository } from "./createPgSourceRepository";
import { createPgAttributeDefinitionRepository } from "./createPgAttributeDefinitionRepository";
import {
    createPgSoftwareReferentRepository,
    createPgSoftwareUserRepository
} from "./createPgUserAndReferentRepository";
import { Database } from "./kysely.database";

export type CreateKyselyPgDbApiOptions = {
    /**
     * When true, form-based create/update writes also upsert a `user_input` row into
     * `software_external_datas` so it participates in the unified merge. On reuser
     * deployments with forms disabled, set this to false — writes still touch the
     * legacy `softwares` columns but no user_input row is maintained.
     */
    userInputEnabled: boolean;
};

/**
 * Derives `userInputEnabled` from the deployment's ui-config. Mirrors the check the
 * add-user-input-source migration runs so that runtime and migration stay in sync.
 */
export const getUserInputEnabledFromUiConfig = (): boolean =>
    Boolean(
        rawUiConfig?.home?.usecases?.editSoftware?.enabled || rawUiConfig?.home?.usecases?.addSoftwareOrService?.enabled
    );

const defaultOptions = (): CreateKyselyPgDbApiOptions => ({
    userInputEnabled: getUserInputEnabledFromUiConfig()
});

export const createKyselyPgDbApi = (
    db: Kysely<Database>,
    options: CreateKyselyPgDbApiOptions = defaultOptions()
): DbApiV2 => {
    return {
        source: createPgSourceRepository(db),
        software: createPgSoftwareRepository(db, options),
        softwareExternalData: createPgSoftwareExternalDataRepository(db),
        instance: createPgInstanceRepository(db),
        user: createPgUserRepository(db),
        softwareReferent: createPgSoftwareReferentRepository(db),
        softwareUser: createPgSoftwareUserRepository(db),
        session: createPgSessionRepository(db),
        attributeDefinition: createPgAttributeDefinitionRepository(db),
        getCompiledDataPrivate: createGetCompiledData(db)
    };
};

type PgDbConfig = { dbKind: "kysely"; kyselyDb: Kysely<Database> };

export const getDbApiAndInitializeCache = (
    dbConfig: PgDbConfig,
    options?: CreateKyselyPgDbApiOptions
): { dbApi: DbApiV2 } => {
    if (dbConfig.dbKind === "kysely") {
        return {
            dbApi: createKyselyPgDbApi(dbConfig.kyselyDb, options)
        };
    }

    const shouldNotBeReached: never = dbConfig.dbKind;
    throw new Error(`Unsupported case: ${shouldNotBeReached}`);
};
