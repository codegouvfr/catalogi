// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { DatabaseDataType, SoftwareExternalDataRepository } from "../../../ports/DbApiV2";
import { Database, DatabaseRowOutput } from "./kysely.database";
import { stripNullOrUndefinedValues, transformNullToUndefined } from "./kysely.utils";
import { SoftwareExternalData } from "../../../ports/GetSoftwareExternalData";
import type { SoftwareExternal } from "../../../types/SoftwareTypes";
import { toLegacySoftwareExternalData } from "../../../types/softwareExternalMappers";

const cleanDataForExternalData = (row: DatabaseRowOutput.SoftwareExternalData) => transformNullToUndefined(row);

export const castToSoftwareExternalData = (
    externalSoftwareRow: DatabaseDataType.SoftwareExternalDataRow
): SoftwareExternalData => toLegacySoftwareExternalData(externalSoftwareRow);

const isCanonical = (data: SoftwareExternalData | SoftwareExternal): data is SoftwareExternal =>
    "variant" in data && data.variant === "external";

const toDbValues = (data: SoftwareExternalData | SoftwareExternal) => {
    if (isCanonical(data)) {
        return {
            authors: JSON.stringify(data.authors),
            name: JSON.stringify(data.name),
            description: JSON.stringify(data.description),
            isLibreSoftware: data.isLibreSoftware ?? null,
            image: data.image ?? null,
            url: data.url ?? null,
            codeRepositoryUrl: data.codeRepositoryUrl ?? null,
            softwareHelp: data.softwareHelp ?? null,
            license: data.license ?? null,
            latestVersion: data.latestVersion ? JSON.stringify(data.latestVersion) : null,
            keywords: JSON.stringify(data.keywords),
            applicationCategories: JSON.stringify(data.applicationCategories),
            programmingLanguages: JSON.stringify(data.programmingLanguages),
            referencePublications: JSON.stringify(data.referencePublications),
            dateCreated: data.dateCreated ? new Date(data.dateCreated) : null,
            identifiers: JSON.stringify(data.identifiers),
            providers: JSON.stringify(data.providers)
        };
    }

    return {
        authors: JSON.stringify(data.developers),
        name: JSON.stringify(data.name),
        description: JSON.stringify(data.description),
        isLibreSoftware: data.isLibreSoftware ?? null,
        image: data.logoUrl ?? null,
        url: data.websiteUrl ?? null,
        codeRepositoryUrl: data.sourceUrl ?? null,
        softwareHelp: data.documentationUrl ?? null,
        license: data.license ?? null,
        latestVersion: data.softwareVersion
            ? JSON.stringify({ version: data.softwareVersion, releaseDate: null })
            : null,
        keywords: JSON.stringify(data.keywords),
        applicationCategories: JSON.stringify(data.applicationCategories),
        programmingLanguages: JSON.stringify(data.programmingLanguages),
        referencePublications: JSON.stringify(data.referencePublications),
        dateCreated: data.publicationTime ?? null,
        identifiers: JSON.stringify(data.identifiers),
        repoMetadata: JSON.stringify(data.repoMetadata),
        providers: JSON.stringify(data.providers)
    };
};

export const createPgSoftwareExternalDataRepository = (db: Kysely<Database>): SoftwareExternalDataRepository => ({
    saveMany: async externalDataItems => {
        await db
            .insertInto("software_external_datas")
            .values(
                externalDataItems.map(
                    ({ externalId, sourceSlug, softwareId = null, name = "", description = "", isLibreSoftware }) => ({
                        externalId,
                        sourceSlug,
                        softwareId,
                        authors: JSON.stringify([]),
                        name: JSON.stringify(name),
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

        if (externalId !== softwareExternalData.externalId)
            console.info(
                `Attention : need to update or cure data [${externalId} !== ${softwareExternalData.externalId}]`
            );

        await db
            .updateTable("software_external_datas")
            .where("externalId", "=", externalId)
            .where("sourceSlug", "=", sourceSlug)
            .set({
                externalId,
                softwareId,
                lastDataFetchAt,
                ...toDbValues(softwareExternalData)
            })
            .executeTakeFirst();
    },
    save: async ({ softwareExternalData, softwareId }) => {
        const pgValues = {
            externalId: softwareExternalData.externalId,
            sourceSlug: softwareExternalData.sourceSlug,
            softwareId,
            ...toDbValues(softwareExternalData)
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
    getBySoftwareId: async ({ softwareId }) => {
        return db
            .selectFrom("software_external_datas")
            .selectAll()
            .where("softwareId", "=", softwareId)
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
    }
});
