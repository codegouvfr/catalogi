// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { DbApiV2 } from "../ports/DbApiV2";
import type { SourceConnectionCheck } from "../ports/SourceGateway";
import {
    isLookupSourceKind,
    USER_INPUT_SOURCE_SLUG,
    type SourceCategory
} from "../adapters/dbApi/kysely/kysely.database";
import { resolveAdapterFromSource } from "../adapters/resolveAdapter";
import { isForgeKind } from "./ensureForgeSource";
import type { Source } from "./readWriteSillData";
import {
    applySourceConfigurationPatch,
    sourceConfigurationFieldsByKind,
    toSourceConfigurationView,
    type SourceConfigurationFields,
    type SourceConfigurationPatch,
    type SourceConfigurationView
} from "./sourceConfiguration";
import {
    InvalidCategoryOrderError,
    NotALookupSourceCandidateError,
    SourceNotEditableError,
    SourceNotFoundError
} from "./sourceErrors";

// What the admin tab shows of a source: its credential is reduced to "set or not".
export type AdminSource = Pick<Source, "slug" | "kind" | "category" | "url" | "lastImport"> & {
    isLookupSource: boolean;
    canBeLookupSource: boolean;
    isEditable: boolean;
    // A forge is identified by the origin of its url (see ensureForgeSource).
    isUrlEditable: boolean;
    // Catalog softwares linked to the source, similar softwares left out.
    softwareCount: number;
    configurationFields: SourceConfigurationFields;
    configuration: SourceConfigurationView;
};

export type AdminSourceCategory = {
    category: SourceCategory;
    priority: number;
    // UserInput always comes first.
    isLocked: boolean;
    sources: AdminSource[];
};

export type UpdateSourceParams = {
    slug: string;
    url?: string;
    configuration?: SourceConfigurationPatch;
};

export type SourceConnectionCheckResult = SourceConnectionCheck | { status: "notApplicable" };

const defaultConnectionCheckTimeout = 10_000;

const getSourceOrThrow = async (dbApi: DbApiV2, slug: string) => {
    const source = await dbApi.source.getByName({ name: slug });
    if (!source) throw new SourceNotFoundError(slug);
    return source;
};

const toAdminSource = (source: Source, softwareCount: number): AdminSource => {
    const isEditable = source.kind !== USER_INPUT_SOURCE_SLUG;
    return {
        slug: source.slug,
        kind: source.kind,
        category: source.category,
        url: source.url,
        lastImport: source.lastImport,
        isLookupSource: source.isLookupSource,
        canBeLookupSource: isLookupSourceKind(source.kind),
        isEditable,
        isUrlEditable: isEditable && !isForgeKind(source.kind),
        softwareCount,
        configurationFields: sourceConfigurationFieldsByKind[source.kind],
        configuration: toSourceConfigurationView({ kind: source.kind, configuration: source.configuration })
    };
};

export const makeGetAdminSources = (deps: { dbApi: DbApiV2 }) => async (): Promise<AdminSourceCategory[]> => {
    const { dbApi } = deps;
    const [sources, priorities, softwareCounts] = await Promise.all([
        dbApi.source.getAll({ all: true }),
        dbApi.source.getCategoryPriorities(),
        dbApi.source.countSoftwaresBySlug()
    ]);

    return Object.entries(priorities)
        .map(([category, priority]) => ({ category: category as SourceCategory, priority: priority! }))
        .sort((a, b) => a.priority - b.priority)
        .map(({ category, priority }) => ({
            category,
            priority,
            isLocked: category === USER_INPUT_SOURCE_SLUG,
            sources: sources
                .filter(source => source.category === category)
                .sort((a, b) => a.slug.localeCompare(b.slug))
                .map(source => toAdminSource(source, softwareCounts[source.slug] ?? 0))
        }));
};

export const makeUpdateSource =
    (deps: { dbApi: DbApiV2 }) =>
    async (params: UpdateSourceParams): Promise<void> => {
        const { dbApi } = deps;
        const { slug, url, configuration } = params;
        const source = await getSourceOrThrow(dbApi, slug);

        if (source.kind === USER_INPUT_SOURCE_SLUG)
            throw new SourceNotEditableError("The user input source cannot be edited");

        if (url !== undefined && url !== source.url) {
            if (isForgeKind(source.kind))
                throw new SourceNotEditableError("The url of a forge identifies it and cannot be changed");
            if (URL.parse(url)?.protocol !== "https:")
                throw new SourceNotEditableError("The url must be an absolute HTTPS url");
            // The credential is sent to the url: moving it elsewhere must not carry the token along.
            if (source.configuration?.auth && configuration?.credential === undefined)
                throw new SourceNotEditableError(
                    "Changing the url requires entering the credential again or clearing it"
                );
        }

        await dbApi.source.update({
            slug,
            url: url === undefined || url === source.url ? undefined : url,
            configuration:
                configuration === undefined
                    ? undefined
                    : applySourceConfigurationPatch({
                          kind: source.kind,
                          configuration: source.configuration,
                          patch: configuration
                      })
        });
    };

export const makeSetLookupSource =
    (deps: { dbApi: DbApiV2 }) =>
    async ({ slug }: { slug: string }): Promise<void> => {
        const { dbApi } = deps;
        const source = await getSourceOrThrow(dbApi, slug);
        if (!isLookupSourceKind(source.kind)) throw new NotALookupSourceCandidateError(slug);
        await dbApi.source.setLookupSource({ slug });
    };

export const makeReorderSourceCategories =
    (deps: { dbApi: DbApiV2 }) =>
    async ({ categories }: { categories: SourceCategory[] }): Promise<void> => {
        const { dbApi } = deps;
        const current = Object.keys(await dbApi.source.getCategoryPriorities());

        const isPermutation =
            categories.length === current.length &&
            new Set(categories).size === categories.length &&
            categories.every(category => current.includes(category));
        if (!isPermutation) throw new InvalidCategoryOrderError("The order must list every source category once");
        if (categories[0] !== USER_INPUT_SOURCE_SLUG)
            throw new InvalidCategoryOrderError("The user input category must stay first");

        await dbApi.source.reorderCategories({ categories });
    };

export const makeCheckSourceConnection =
    (deps: { dbApi: DbApiV2 }) =>
    async ({ slug }: { slug: string }): Promise<SourceConnectionCheckResult> => {
        const { dbApi } = deps;
        const source = await getSourceOrThrow(dbApi, slug);
        const { checkConnection } = resolveAdapterFromSource(source);
        if (!checkConnection) return { status: "notApplicable" };

        return checkConnection({
            source,
            signal: AbortSignal.timeout(source.configuration?.queryTimeout ?? defaultConnectionCheckTimeout)
        });
    };

export type AdminSourcesUseCases = {
    getAll: ReturnType<typeof makeGetAdminSources>;
    update: ReturnType<typeof makeUpdateSource>;
    setLookupSource: ReturnType<typeof makeSetLookupSource>;
    reorderCategories: ReturnType<typeof makeReorderSourceCategories>;
    checkConnection: ReturnType<typeof makeCheckSourceConnection>;
};

export const makeAdminSources = (deps: { dbApi: DbApiV2 }): AdminSourcesUseCases => ({
    getAll: makeGetAdminSources(deps),
    update: makeUpdateSource(deps),
    setLookupSource: makeSetLookupSource(deps),
    reorderCategories: makeReorderSourceCategories(deps),
    checkConnection: makeCheckSourceConnection(deps)
});
