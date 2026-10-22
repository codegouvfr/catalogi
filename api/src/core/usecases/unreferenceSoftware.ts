// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SoftwareCatalogueStatusNames, Status } from "../adapters/dbApi/kysely/kysely.database";
import { DbApiV2, WithUserId } from "../ports/DbApiV2";
import { SoftwareChangingStatusProtectedError, SoftwareNotFoundError } from "./softwareErrors";

export type ChangingCatalogueStatusSoftware = (
    params: {
        statusName: SoftwareCatalogueStatusNames;
        softwareId: number;
        reason: string;
        isAdmin?: boolean;
    } & WithUserId
) => Promise<Status>;

export const makeChangingCatalogueStatusSoftware: (dbApi: DbApiV2) => ChangingCatalogueStatusSoftware =
    (dbApi: DbApiV2) =>
    async ({ softwareId, reason, userId, isAdmin = false, statusName }) => {
        const existing = await dbApi.software.getBySoftwareId(softwareId);
        if (!existing) throw new SoftwareNotFoundError();

        if (existing.protections?.statusChanging?.isProtected === true && !isAdmin) {
            throw new SoftwareChangingStatusProtectedError();
        }

        return dbApi.software.changeCatalogStatus({
            statusName,
            softwareId,
            reason,
            time: new Date().toISOString(),
            changedByUserId: userId
        });
    };
