// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { DatabaseDataType, PopulatedExternalData, SoftwareExternalDataRepository } from "../../../ports/DbApiV2";
import { Database, DatabaseRowOutput } from "./kysely.database";
import { stripNullOrUndefinedValues, transformNullToUndefined } from "./kysely.utils";
import { mergeArrays } from "../../../utils";
import merge from "deepmerge";

const cleanDataForExternalData = (row: DatabaseRowOutput.SoftwareExternalData) => transformNullToUndefined(row);

const mergeExternalData = (externalData: PopulatedExternalData[]) => {
    if (externalData.length === 0) return undefined;
    if (externalData.length === 1) return stripExternalDataFromSource(externalData[0]);

    externalData.sort((firstItem, secondItem) => secondItem.priority - firstItem.priority);

    const mergedItem = merge.all<PopulatedExternalData>(externalData, { arrayMerge: mergeArrays });

    return stripExternalDataFromSource(mergedItem);
};

const stripExternalDataFromSource = (
    populatedExternalDataItem: PopulatedExternalData
): DatabaseDataType.SoftwareExternalDataRow => {
    const { slug, priority, kind, url, ...externalDataItem } = populatedExternalDataItem;

    return externalDataItem;
};

export const createPgSoftwareExternalDataRepository = (db: Kysely<Database>): SoftwareExternalDataRepository => ({
    getSimilarSoftwareId: async ({ externalId, sourceSlug }) => {
        return db
            .selectFrom("softwares__similar_software_external_datas")
            .select("softwareId")
            .where("similarExternalId", "=", externalId)
            .where("sourceSlug", "=", sourceSlug)
            .execute();
    },
    saveMany: async externalDataItems => {
        await db
            .insertInto("software_external_datas")
            .values(
                externalDataItems.map(
                    ({ externalId, sourceSlug, softwareId = null, label = "", description = "", isLibreSoftware }) => ({
                        externalId,
                        sourceSlug,
                        softwareId,
                        developers: JSON.stringify([]),
                        label: JSON.stringify(label),
                        description: JSON.stringify(description),
                        isLibreSoftware: isLibreSoftware ?? null
                    })
                )
            )
            .onConflict(oc => oc.columns(["sourceSlug", "externalId"]).doNothing())
            .executeTakeFirst();
    },
    update: async params => {
        const { externalId, sourceSlug, softwareExternalData, softwareId = null, lastDataFetchAt = null } = params;

        await db
            .updateTable("software_external_datas")
            .where("externalId", "=", externalId)
            .where("sourceSlug", "=", sourceSlug)
            .set({
                ...softwareExternalData,
                softwareId,
                lastDataFetchAt,
                developers: JSON.stringify(softwareExternalData.developers),
                label: JSON.stringify(softwareExternalData.label),
                keywords: JSON.stringify(softwareExternalData.keywords),
                applicationCategories: JSON.stringify(softwareExternalData.applicationCategories),
                programmingLanguages: JSON.stringify(softwareExternalData.programmingLanguages),
                referencePublications: JSON.stringify(softwareExternalData.referencePublications),
                identifiers: JSON.stringify(softwareExternalData.identifiers),
                description: JSON.stringify(softwareExternalData.description),
                providers: JSON.stringify(softwareExternalData.providers)
            })
            .executeTakeFirst();
    },
    save: async ({ softwareExternalData, softwareId }) => {
        const pgValues = {
            ...softwareExternalData,
            softwareId,
            developers: JSON.stringify(softwareExternalData.developers),
            label: JSON.stringify(softwareExternalData.label),
            keywords: JSON.stringify(softwareExternalData.keywords),
            applicationCategories: JSON.stringify(softwareExternalData.applicationCategories),
            programmingLanguages: JSON.stringify(softwareExternalData.programmingLanguages),
            referencePublications: JSON.stringify(softwareExternalData.referencePublications),
            identifiers: JSON.stringify(softwareExternalData.identifiers),
            description: JSON.stringify(softwareExternalData.description),
            providers: JSON.stringify(softwareExternalData.providers)
        };

        await db
            .insertInto("software_external_datas")
            .values(pgValues)
            .onConflict(oc => oc.column("externalId").doUpdateSet(pgValues))
            .executeTakeFirst();
    },
    get: async ({ sourceSlug, externalId }) => {
        return db
            .selectFrom("software_external_datas")
            .selectAll()
            .where("externalId", "=", externalId)
            .where("sourceSlug", "=", sourceSlug)
            .executeTakeFirst()
            .then(row => (row ? cleanDataForExternalData(row) : undefined));
    },
    getIds: async ({ minuteSkipSince }) => {
        let request = db.selectFrom("software_external_datas").select(["externalId", "sourceSlug"]);

        if (minuteSkipSince) {
            const thresholdDate = new Date(Date.now() - minuteSkipSince * 1000 * 60);
            request = request.where(eb =>
                eb.or([eb("lastDataFetchAt", "is", null), eb("lastDataFetchAt", "<", thresholdDate)])
            );
        }

        return request.execute().then(rows => rows.map(row => stripNullOrUndefinedValues(row)));
    },
    getBySoftwareIdAndSource: async ({ softwareId, sourceSlug }) => {
        return db
            .selectFrom("software_external_datas")
            .selectAll()
            .where("softwareId", "=", softwareId)
            .where("sourceSlug", "=", sourceSlug)
            .executeTakeFirst()
            .then(row => (row ? cleanDataForExternalData(row) : undefined));
    },
    getBySoftwareId: async ({ softwareId }) => {
        return db
            .selectFrom("software_external_datas")
            .selectAll()
            .where("softwareId", "=", softwareId)
            .execute()
            .then(rows => rows.map(cleanDataForExternalData));
    },
    getIdsBySource: async ({ sourceSlug }) => {
        return db
            .selectFrom("software_external_datas")
            .select("externalId")
            .where("sourceSlug", "=", sourceSlug)
            .execute()
            .then(rows => rows.map(row => row.externalId));
    },
    getBySource: async ({ sourceSlug }) => {
        return db
            .selectFrom("software_external_datas")
            .selectAll()
            .where("sourceSlug", "=", sourceSlug)
            .execute()
            .then(rows => rows.map(cleanDataForExternalData));
    },
    getAll: async () => {
        return db
            .selectFrom("software_external_datas")
            .selectAll()
            .orderBy("softwareId", "asc")
            .execute()
            .then(rows => rows.map(cleanDataForExternalData));
    },
    delete: async ({ externalId, sourceSlug }) => {
        return db
            .deleteFrom("software_external_datas")
            .where("externalId", "=", externalId)
            .where("sourceSlug", "=", sourceSlug)
            .execute()
            .then(rows => rows.length > 0);
    },
    getOtherIdentifierIdsBySourceURL: async ({ sourceURL }) => {
        const request = db
            .selectFrom("software_external_datas")
            .leftJoin("sources", "sources.slug", "software_external_datas.sourceSlug")
            .select(["softwareId", "identifiers"])
            .where("sources.url", "!=", sourceURL);

        const externalData = await request.execute();

        if (!externalData) return undefined;

        return externalData.reduce(
            (acc, externalDataItem) => {
                if (
                    !externalDataItem.identifiers ||
                    externalDataItem.identifiers.length === 0 ||
                    !externalDataItem.softwareId
                )
                    return acc;

                const formatedUrl = new URL(sourceURL).toString();

                const foundIdentiers = externalDataItem.identifiers.filter(
                    identifer => identifer.subjectOf?.url.toString() === formatedUrl
                );

                if (foundIdentiers.length === 0) return acc;

                if (foundIdentiers.length > 2)
                    throw Error("Database corrupted, shouldn't have same source on this object");

                acc[foundIdentiers[0].value] = externalDataItem.softwareId;
                return acc;
            },
            {} as Record<string, number>
        );
    },
    getMergedBySoftwareId: async ({ softwareId }) => {
        const result = await db
            .selectFrom("software_external_datas as ext")
            .selectAll("ext")
            .innerJoin("sources as s", "s.slug", "ext.sourceSlug")
            .select(["s.kind", "s.priority", "s.url", "s.slug"])
            .where("softwareId", "=", softwareId)
            .execute();
        const cleanResult = result.map(row => transformNullToUndefined(row));

        if (!cleanResult) return undefined;

        return mergeExternalData(cleanResult);
    },
    getMergedForAllSoftwares: async () => {
        const rows = await db
            .selectFrom("software_external_datas as ext")
            .selectAll("ext")
            .innerJoin("sources as s", "s.slug", "ext.sourceSlug")
            .select(["s.kind", "s.priority", "s.url", "s.slug"])
            .where("ext.softwareId", "is not", null)
            .orderBy("ext.softwareId", "asc")
            .orderBy("s.priority", "desc")
            .execute();

        const bySoftwareId = rows.reduce(
            (acc, row) => ({
                ...acc,
                [row.softwareId!]: [...(acc[row.softwareId!] ?? []), transformNullToUndefined(row)]
            }),
            {} as Record<number, PopulatedExternalData[]>
        );

        return Object.entries(bySoftwareId).reduce(
            (acc, [softwareId, items]) => {
                const merged = mergeExternalData(items);
                return merged ? { ...acc, [softwareId]: merged } : acc;
            },
            {} as Record<number, DatabaseDataType.SoftwareExternalDataRow>
        );
    }
});
