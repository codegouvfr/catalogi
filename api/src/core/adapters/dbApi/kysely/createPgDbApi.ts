// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { DbApiV2 } from "../../../ports/DbApiV2";
import { createGetCompiledData } from "./createGetCompiledData";
import { createPgAgentRepository } from "./createPgUserRepository";
import { createPgInstanceRepository } from "./createPgInstanceRepository";
import { createPgOtherSoftwareExtraDataRepository } from "./createPgOtherSoftwareExtraDataRepositiory";
import { createPgSoftwareExternalDataRepository } from "./createPgSoftwareExternalDataRepository";
import { createPgSoftwareRepository } from "./createPgSoftwareRepository";
import { createPgSourceRepository } from "./createPgSourceRepository";
import { createPgReferentRepository, createPgUserRepository } from "./createPgUserAndReferentRepository";
import { Database } from "./kysely.database";

export const createKyselyPgDbApi = (db: Kysely<Database>): DbApiV2 => {
    return {
        source: createPgSourceRepository(db),
        software: createPgSoftwareRepository(db),
        softwareExternalData: createPgSoftwareExternalDataRepository(db),
        otherSoftwareExtraData: createPgOtherSoftwareExtraDataRepository(db),
        instance: createPgInstanceRepository(db),
        agent: createPgAgentRepository(db),
        softwareReferent: createPgReferentRepository(db),
        softwareUser: createPgUserRepository(db),
        getCompiledDataPrivate: createGetCompiledData(db)
    };
};
