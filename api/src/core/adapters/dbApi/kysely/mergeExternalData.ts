// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DatabaseDataType, PopulatedExternalData } from "../../../ports/DbApiV2";
import type { SchemaOrganization, SchemaPerson, SchemaIdentifier, ScholarlyArticle } from "./kysely.database";
import type { Os } from "../../../types";

type Merged = DatabaseDataType.SoftwareExternalDataRow;

/**
 * Merge rows from different sources describing the same software.
 *
 * Convention: **lower priority number = higher precedence** (wikidata=1 wins over cdl=2).
 * **Input must be sorted priority-ascending** (highest precedence first); callers get
 * that ordering from their SQL `ORDER BY s.priority ASC` clause.
 *
 * - Scalar fields pick the value from the highest-precedence row that has a non-null value.
 * - Array fields take the UNION across all sources with field-specific dedupe.
 * - `operatingSystems` is a `Record<Os, boolean>`, merged with OR semantics per OS.
 */
export const mergeExternalData = (rows: PopulatedExternalData[]): Merged | undefined => {
    if (rows.length === 0) return undefined;

    const pickScalar = <K extends keyof Merged>(key: K): Merged[K] => {
        for (const row of rows) {
            const v = (row as unknown as Record<string, unknown>)[key as string];
            if (v !== null && v !== undefined) return v as Merged[K];
        }
        return undefined as Merged[K];
    };

    const unionArrays = <T>(key: keyof Merged, dedupeKey: (item: T) => string): T[] => {
        const seen = new Map<string, T>();
        for (const row of rows) {
            const arr = ((row as unknown as Record<string, unknown>)[key as string] ?? []) as T[];
            for (const item of arr) {
                const k = dedupeKey(item);
                if (!seen.has(k)) seen.set(k, item);
            }
        }
        return Array.from(seen.values());
    };

    // Union of boolean maps: true if ANY source says true.
    const unionOperatingSystems = (): Partial<Record<Os, boolean>> | null => {
        const merged: Partial<Record<Os, boolean>> = {};
        let touched = false;
        for (const row of rows) {
            const os = row.operatingSystems as Partial<Record<Os, boolean>> | null | undefined;
            if (!os) continue;
            touched = true;
            for (const key of Object.keys(os) as Os[]) {
                merged[key] = merged[key] || !!os[key];
            }
        }
        return touched ? merged : null;
    };

    return {
        externalId: pickScalar("externalId"),
        sourceSlug: pickScalar("sourceSlug"),
        softwareId: pickScalar("softwareId"),
        name: pickScalar("name"),
        description: pickScalar("description"),
        isLibreSoftware: pickScalar("isLibreSoftware"),
        image: pickScalar("image"),
        url: pickScalar("url"),
        codeRepositoryUrl: pickScalar("codeRepositoryUrl"),
        softwareHelp: pickScalar("softwareHelp"),
        license: pickScalar("license"),
        latestVersion: pickScalar("latestVersion"),
        dateCreated: pickScalar("dateCreated"),
        lastDataFetchAt: pickScalar("lastDataFetchAt"),
        repoMetadata: pickScalar("repoMetadata"),

        authors: unionArrays<SchemaPerson | SchemaOrganization>(
            "authors",
            a => (a as { "@id"?: string })["@id"] ?? a.name?.toLowerCase() ?? ""
        ),
        keywords: unionArrays<string>("keywords", s => s.toLowerCase()),
        programmingLanguages: unionArrays<string>("programmingLanguages", s => s.toLowerCase()),
        applicationCategories: unionArrays<string>("applicationCategories", s => s.toLowerCase()),
        runtimePlatforms: unionArrays<string>("runtimePlatforms", s => s.toLowerCase()) as Merged["runtimePlatforms"],
        identifiers: unionArrays<SchemaIdentifier>("identifiers", i => `${i.name ?? ""}:${i.value}`),
        referencePublications: unionArrays<ScholarlyArticle>("referencePublications", p => p["@id"] ?? ""),
        providers: unionArrays<SchemaOrganization>("providers", p => p.url ?? p.name?.toLowerCase() ?? ""),
        operatingSystems: unionOperatingSystems() as Merged["operatingSystems"]
    };
};
