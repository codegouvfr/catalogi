// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { InstanceRepository } from "../../../ports/DbApiV2";
import { Instance } from "../../../usecases/readWriteSillData";
import { Database } from "./kysely.database";

export const createPgInstanceRepository = (db: Kysely<Database>): InstanceRepository => ({
    create: async ({ formData, userId }) => {
        const { mainSoftwareSillId, organization, targetAudience, instanceUrl, isPublic, ...rest } = formData;
        assert<Equals<typeof rest, {}>>();

        const now = new Date();
        const { instanceId } = await db
            .insertInto("instances")
            .values({
                addedByUserId: userId,
                updateTime: now,
                referencedSinceTime: now,
                mainSoftwareSillId,
                organization,
                targetAudience,
                instanceUrl,
                isPublic
            })
            .returning("id as instanceId")
            .executeTakeFirstOrThrow();
        return instanceId;
    },
    update: async ({ formData, instanceId }) => {
        const { mainSoftwareSillId, organization, targetAudience, instanceUrl, isPublic, ...rest } = formData;
        assert<Equals<typeof rest, {}>>();

        const now = new Date();
        await db
            .updateTable("instances")
            .set({
                updateTime: now,
                mainSoftwareSillId,
                organization,
                targetAudience,
                instanceUrl,
                isPublic
            })
            .where("id", "=", instanceId)
            .execute();
    },
    countAddedByUser: async ({ userId }) => {
        const { count } = await db
            .selectFrom("instances")
            .select(qb => qb.fn.countAll<string>().as("count"))
            .where("addedByUserId", "=", userId)
            .executeTakeFirstOrThrow();
        return parseInt(count);
    },
    getAll: async () =>
        db
            .selectFrom("instances as i")
            .groupBy(["i.id"])
            .select([
                "i.id",
                "i.mainSoftwareSillId",
                "i.organization",
                "i.targetAudience",
                "i.instanceUrl",
                "i.isPublic"
            ])
            .execute()
            .then(instances =>
                instances.map(
                    (instance): Instance => ({
                        ...instance,
                        instanceUrl: instance.instanceUrl ?? undefined,
                        isPublic: instance.isPublic
                    })
                )
            )
});
