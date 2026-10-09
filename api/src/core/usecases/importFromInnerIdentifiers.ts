// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Identifier } from "../../lib/ApiTypes";
import { mergeDepuplicateIdentifierArray } from "../../tools/identifiersTools";
import { DbApiV2 } from "../ports/DbApiV2";
import { isForgeKind, makeEnsureForgeSource } from "./ensureForgeSource";

type ParamsOfUAutoImportFromIdentifersUseCase = {
    dbApi: DbApiV2;
};

type SaveIds = { sourceSlug: string; externalId: string; softwareId: number };

export type ImportFromInnerIdentifers = () => Promise<boolean>;

const useCaseLogTitle = "[UC.Import cross saved identifers]";
const useCaseLogTimer = `${useCaseLogTitle} Finsihed fetching external data`;

export const makeImportFromInnerIdentifiers = (
    deps: ParamsOfUAutoImportFromIdentifersUseCase
): ImportFromInnerIdentifers => {
    const { dbApi } = deps;
    const ensureForgeSource = makeEnsureForgeSource({ dbApi });

    return async () => {
        console.time(useCaseLogTimer);

        const externalDataList = await dbApi.softwareExternalData.getAll();

        if (!externalDataList) return true;

        const index = externalDataList.reduce(
            (acc, item) => {
                const newAcc = acc;
                if (!item.softwareId || !item.identifiers) return newAcc;
                if (!acc[item.softwareId]) {
                    newAcc[item.softwareId] = item.identifiers;
                    return newAcc;
                }

                const merged = mergeDepuplicateIdentifierArray(acc[item.softwareId], item.identifiers);
                newAcc[item.softwareId] = merged;

                return newAcc;
            },
            {} as Record<number, Identifier[]>
        );

        const sources = await dbApi.source.getAll();
        // Sources are matched by origin: identifiers and sources don't agree on trailing slashes.
        const slugByOrigin = sources.reduce(
            (acc, source) => {
                // CNLL is keyed by SILL id, other sources cite its annuaire id (#520).
                if (source.kind === "CNLL") return acc;

                const origin = URL.parse(source.url)?.origin;
                if (origin && !acc[origin]) acc[origin] = source.slug;
                return acc;
            },
            {} as Record<string, string>
        );

        const categoryBySlug = Object.fromEntries(sources.map(source => [source.slug, source.category]));

        // A software has at most one external data per source category.
        const takenCategories = new Set(
            externalDataList.flatMap(item => (item.softwareId ? [`${item.softwareId}:${item.sourceCategory}`] : []))
        );

        // Repositories on a forge instance without source yet get one created on the fly.
        const resolveSourceSlug = async (identifier: Identifier): Promise<string | undefined> => {
            if (!identifier.subjectOf) return undefined;

            const url = identifier.subjectOf.url.toString();
            const origin = URL.parse(url)?.origin;
            if (!origin) return undefined;
            if (slugByOrigin[origin]) return slugByOrigin[origin];

            const kind = identifier.subjectOf.additionalType;
            if (identifier.additionalType !== "Repo" || !isForgeKind(kind)) return undefined;

            const source = await ensureForgeSource({ kind, url });
            if (!source) return undefined;

            slugByOrigin[origin] = source.slug;
            categoryBySlug[source.slug] = source.category;
            return source.slug;
        };

        const resolveRegisterable = async (
            identifier: Identifier,
            softwareId: number
        ): Promise<SaveIds | undefined> => {
            const sourceSlug = await resolveSourceSlug(identifier);

            if (!sourceSlug) return undefined;

            const registered = await dbApi.softwareExternalData.get({ externalId: identifier.value, sourceSlug });

            if (registered) return undefined;

            const softwareCategory = `${softwareId}:${categoryBySlug[sourceSlug]}`;
            if (takenCategories.has(softwareCategory)) return undefined;
            takenCategories.add(softwareCategory);

            return {
                sourceSlug: sourceSlug,
                externalId: identifier.value,
                softwareId: softwareId
            };
        };

        const instertions = await Promise.all(
            Object.keys(index).map(async softwareId => {
                // Is the source, registered ?
                const toInsert: { sourceSlug: string; externalId: string; softwareId: number }[] = [];

                for (const identifier of index[Number(softwareId)]) {
                    const isRegisterable = await resolveRegisterable(identifier, Number(softwareId));

                    if (isRegisterable) {
                        toInsert.push(isRegisterable);
                    }
                }

                return toInsert;
            })
        );

        const insertFlatten = instertions.flat();
        if (insertFlatten.length === 0) {
            console.info(`${useCaseLogTitle} Added 0 external data`);
            return true;
        }

        await dbApi.softwareExternalData.saveMany(insertFlatten);

        console.timeEnd(useCaseLogTimer);
        console.info(`${useCaseLogTitle} - Added ${insertFlatten.length} external data`);

        return true;
    };
};
