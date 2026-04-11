// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DatabaseDataType, PopulatedExternalData } from "../../../ports/DbApiV2";
import type { SchemaOrganization, SchemaPerson, SchemaIdentifier, ScholarlyArticle } from "./kysely.database";
import type { Os } from "../../../types";

type Merged = DatabaseDataType.SoftwareExternalDataRow;

/**
 * Coerce a value into a lowercase string suitable for dedup. Handles raw
 * strings, numbers, and the localized-label objects that wikidata sometimes
 * stuffs into keyword/language arrays (e.g. `{ value: "Python", language: "en" }`
 * or `{ "@value": "Python" }`).
 */
const stringKey = (v: unknown): string => {
    if (typeof v === "string") return v.toLowerCase();
    if (typeof v === "number" || typeof v === "boolean") return String(v).toLowerCase();
    if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const candidate = o["value"] ?? o["@value"] ?? o["name"] ?? o["label"] ?? o["text"];
        if (typeof candidate === "string") return candidate.toLowerCase();
    }
    return "";
};

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
        // Real-world keyword/language/category arrays sometimes contain
        // objects (e.g. wikidata localized labels) instead of bare strings,
        // so coerce defensively before lowercasing.
        keywords: unionArrays<string>("keywords", stringKey),
        programmingLanguages: unionArrays<string>("programmingLanguages", stringKey),
        applicationCategories: unionArrays<string>("applicationCategories", stringKey),
        runtimePlatforms: unionArrays<string>("runtimePlatforms", stringKey) as Merged["runtimePlatforms"],
        identifiers: unionArrays<SchemaIdentifier>("identifiers", i => `${i.name ?? ""}:${i.value}`),
        referencePublications: unionArrays<ScholarlyArticle>("referencePublications", p => p["@id"] ?? ""),
        providers: unionArrays<SchemaOrganization>("providers", p => p.url ?? p.name?.toLowerCase() ?? ""),
        operatingSystems: unionOperatingSystems() as Merged["operatingSystems"]
    };
};
