// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { CompiledData } from "../../../ports/CompileData";
import { Db } from "../../../ports/DbApi";
import { PopulatedExternalData } from "../../../ports/DbApiV2";
import type { Os, RuntimePlatform } from "../../../types";
import { Database } from "./kysely.database";
import { isNotNull, transformNullToUndefined } from "./kysely.utils";
import { mergeExternalData } from "./mergeExternalData";

export const createGetCompiledData = (db: Kysely<Database>) => async (): Promise<CompiledData<"private">> => {
    console.time("agentById query");
    const agentById: Record<number, Db.AgentRow> = await db
        .selectFrom("users")
        .selectAll()
        .execute()
        .then(users => users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}));
    console.timeEnd("agentById query");

    console.time("externalData query");
    const externalDataRows = await db
        .selectFrom("software_external_datas as ext")
        .selectAll("ext")
        .innerJoin("sources as src", "src.slug", "ext.sourceSlug")
        .select(["src.kind", "src.priority", "src.url as sourceUrl", "src.slug"])
        .where("ext.softwareId", "is not", null)
        .orderBy("ext.softwareId", "asc")
        .orderBy("src.priority", "desc")
        .execute();

    const externalDataBySoftwareId = externalDataRows.reduce(
        (acc, row) => ({
            ...acc,
            [row.softwareId!]: [...(acc[row.softwareId!] ?? []), transformNullToUndefined(row)]
        }),
        {} as Record<number, PopulatedExternalData[]>
    );
    console.timeEnd("externalData query");

    console.time("softwares query");
    const compliedSoftwares = await db
        .selectFrom("softwares as s")
        .leftJoin("software_referents as referents", "s.id", "referents.softwareId")
        .leftJoin("software_users", "s.id", "software_users.softwareId")
        .leftJoin("instances", "s.id", "instances.mainSoftwareSillId")
        .leftJoin(
            "softwares__similar_software_external_datas",
            "softwares__similar_software_external_datas.softwareId",
            "s.id"
        )
        .leftJoin(
            "software_external_datas as similarExt",
            "softwares__similar_software_external_datas.similarExternalId",
            "similarExt.externalId"
        )
        .groupBy(["s.id"])
        .select([
            "s.id",
            "s.addedByUserId",
            "s.applicationCategories",
            "s.dereferencing",
            "s.description",
            "s.customAttributes",
            "s.isStillInObservation",
            "s.keywords",
            "s.license",
            "s.image",
            "s.name",
            "s.addedTime",
            "s.operatingSystems",
            "s.runtimePlatforms",
            "s.updateTime",
            ({ fn }) => fn.jsonAgg("similarExt").distinct().as("similarExternalSoftwares"),
            ({ fn }) => fn.jsonAgg("software_users").distinct().as("users"),
            ({ fn }) => fn.jsonAgg("referents").distinct().as("referents"),
            ({ fn }) => fn.jsonAgg("instances").distinct().as("instances")
        ])
        .execute()
        .then(results => {
            console.timeEnd("softwares query");
            console.time("software processing");
            const processedSoftwares = results.map(
                ({
                    id,
                    addedByUserId,
                    similarExternalSoftwares,
                    dereferencing,
                    customAttributes,
                    users,
                    referents,
                    instances,
                    updateTime,
                    addedTime,
                    applicationCategories,
                    operatingSystems,
                    runtimePlatforms,
                    description,
                    name,
                    isStillInObservation,
                    keywords,
                    license,
                    image
                }): CompiledData.Software<"private"> => {
                    const softwareExternalData = mergeExternalData(externalDataBySoftwareId[id] ?? []);
                    const version =
                        softwareExternalData?.latestVersion?.version && softwareExternalData?.dateCreated
                            ? {
                                  semVer: softwareExternalData.latestVersion.version,
                                  publicationTime: softwareExternalData.dateCreated.valueOf()
                              }
                            : undefined;

                    return {
                        id,
                        name,
                        description:
                            typeof description === "string"
                                ? description
                                : ((description as Record<string, string>)?.fr ?? ""),
                        referencedSinceTime: new Date(addedTime).getTime(),
                        updateTime: new Date(updateTime).getTime(),
                        isStillInObservation,
                        license,
                        image: image ?? undefined,
                        keywords: keywords ?? [],
                        categories: applicationCategories ?? [],
                        operatingSystems: (operatingSystems ?? {}) as Partial<Record<Os, boolean>>,
                        runtimePlatforms: (runtimePlatforms ?? []) as RuntimePlatform[],
                        customAttributes,
                        addedByUserEmail: agentById[addedByUserId].email,
                        softwareExternalData: softwareExternalData ?? undefined,
                        latestVersion: version,
                        dereferencing: dereferencing ?? undefined,
                        serviceProviders: softwareExternalData?.providers ?? [],
                        similarExternalSoftwares: (similarExternalSoftwares ?? [])
                            .filter(isNotNull)
                            .map(similar => ({
                                "externalId": similar.externalId!,
                                "sourceSlug": similar.sourceSlug!,
                                "name": similar.name!,
                                "description": similar.description!,
                                "isLibreSoftware": similar.isLibreSoftware!
                            }))
                            .sort((a, b) => a.externalId.localeCompare(b.externalId)),
                        users: users.filter(isNotNull).map(user => ({
                            ...(user as any),
                            organization: agentById[user.userId!]?.organization
                        })),
                        referents: referents.filter(isNotNull).map(referent => ({
                            ...(referent as any),
                            organization: agentById[referent.userId!]?.organization
                        })),
                        instances: (instances ?? []).filter(isNotNull).map(instance => ({
                            id: instance.id!,
                            organization: instance.organization!,
                            targetAudience: instance.targetAudience!,
                            publicUrl: instance.instanceUrl ?? undefined,
                            addedByUserEmail: agentById[instance.addedByUserId!].email,
                            otherWikidataSoftwares: []
                        }))
                    };
                }
            );
            console.timeEnd("software processing");
            return processedSoftwares;
        });

    console.log("numberOfCompiledSoftwares : ", compliedSoftwares.length);
    return compliedSoftwares;
};
