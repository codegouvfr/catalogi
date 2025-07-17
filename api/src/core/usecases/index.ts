// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { FetchAndSaveExternalDataForAllSoftwares } from "../adapters/fetchExternalData";
import { GetUser } from "./getUser";
import type { GetSoftwareFormAutoFillDataFromExternalAndOtherSources } from "./getSoftwareFormAutoFillDataFromExternalAndOtherSources";
import { InitiateAuth } from "./auth/initiateAuth";
import { HandleAuthCallback } from "./auth/handleAuthCallback";
import { Logout } from "./auth/logout";

export type UseCases = {
    getSoftwareFormAutoFillDataFromExternalAndOtherSources: GetSoftwareFormAutoFillDataFromExternalAndOtherSources;
    fetchAndSaveExternalDataForAllSoftwares: FetchAndSaveExternalDataForAllSoftwares;
    getUser: GetUser;
    auth: {
        initiateAuth: InitiateAuth;
        handleAuthCallback: HandleAuthCallback;
        logout: Logout;
    };
};
