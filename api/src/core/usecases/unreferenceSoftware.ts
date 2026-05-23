// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DbApiV2, WithUserId } from "../ports/DbApiV2";
import { SoftwareDereferencingProtectedError, SoftwareNotFoundError } from "./softwareErrors";

export type UnreferenceSoftware = (
    params: {
        softwareId: number;
        reason: string;
        isAdmin?: boolean;
    } & WithUserId
) => Promise<void>;

export const makeUnreferenceSoftware: (dbApi: DbApiV2) => UnreferenceSoftware =
    (dbApi: DbApiV2) =>
    async ({ softwareId, reason, userId, isAdmin = false }) => {
        const existing = await dbApi.software.getBySoftwareId(softwareId);
        if (!existing) throw new SoftwareNotFoundError();

        if (existing.protections?.dereferencing?.isProtected === true && !isAdmin) {
            throw new SoftwareDereferencingProtectedError();
        }

        await dbApi.software.unreference({
            softwareId,
            reason,
            time: new Date().toISOString(),
            dereferencedByUserId: userId
        });
    };
