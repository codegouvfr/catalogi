// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type {
    FetchAndSaveExternalDataForAllSoftware,
    FetchAndSaveExternalDataForSoftware
} from "./refreshExternalData";
import type { GetUser } from "./getUser";
import type { GetSoftwareFormAutoFillDataFromExternalAndOtherSources } from "./getSoftwareFormAutoFillDataFromExternalAndOtherSources";
import type { CreateSoftware } from "./createSoftware";
import type { UpdateSoftware } from "./updateSoftware";
import { ImportFromSource } from "./importFromSource";
import { GetPopulatedSoftware } from "./getPopulatedSoftware";
import { InitiateAuth } from "./auth/initiateAuth";
import { HandleAuthCallback } from "./auth/handleAuthCallback";
import { InitiateLogout } from "./auth/logout";

export type UseCases = {
    getSoftwareFormAutoFillDataFromExternalAndOtherSources: GetSoftwareFormAutoFillDataFromExternalAndOtherSources;
    fetchAndSaveExternalDataForAllSoftware: FetchAndSaveExternalDataForAllSoftware;
    fetchAndSaveExternalDataForOneSoftwarePackage: FetchAndSaveExternalDataForSoftware;
    getUser: GetUser;
    auth: {
        initiateAuth: InitiateAuth;
        handleAuthCallback: HandleAuthCallback;
        initiateLogout: InitiateLogout;
    };
    importFromSource: ImportFromSource;
    createSoftware: CreateSoftware;
    updateSoftware: UpdateSoftware;
    getPopulateSoftware: GetPopulatedSoftware;
};
