// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { DbApiV2 } from "../ports/DbApiV2";
import type { ResolveRepository, ResolvedRepository } from "../ports/ResolveRepository";
import type { ForgeKind } from "./ensureForgeSource";
import type { Source } from "./readWriteSillData";
import { normalizeRepoUrl } from "../adapters/resolveRepository";

export type RepoUrlResolution =
    | { status: "invalid" }
    | { status: "unsupported"; codeRepositoryUrl: string }
    | { status: "notFound"; codeRepositoryUrl: string; forgeKind: ForgeKind }
    | {
          status: "found";
          codeRepositoryUrl: string;
          forgeKind: ForgeKind;
          externalId: string;
          name: string;
          description: string | undefined;
          license: string | undefined;
          image: string | undefined;
          keywords: string[];
          existingSoftwareId: number | undefined;
      };

export type ResolveRepoUrl = (params: { url: string }) => Promise<RepoUrlResolution>;

// A repository is already known when it is bound as forge external data, or when
// another source (Wikidata, HAL...) cites it as identifier of a software.
export const findSoftwareIdByRepository = async (params: {
    dbApi: DbApiV2;
    sources: Source[];
    repository: ResolvedRepository;
}): Promise<number | undefined> => {
    const { dbApi, sources, repository } = params;
    const { origin } = new URL(repository.url);

    const forgeSource = sources.find(
        source => source.kind === repository.forgeKind && source.url !== "" && URL.parse(source.url)?.origin === origin
    );

    if (forgeSource) {
        const softwareId = await dbApi.software.getSoftwareIdByExternalIdAndSlug({
            sourceSlug: forgeSource.slug,
            externalId: repository.externalId
        });
        if (softwareId !== undefined) return softwareId;
    }

    const softwareIdByIdentifier = await dbApi.softwareExternalData.getOtherIdentifierIdsBySourceURL({
        sourceURL: forgeSource?.url ?? origin
    });
    if (!softwareIdByIdentifier) return undefined;

    // Identifiers keep the case of the url they were built from.
    const externalId = repository.externalId.toLowerCase();
    const match = Object.entries(softwareIdByIdentifier).find(([value]) => value.toLowerCase() === externalId);
    return match?.[1];
};

export const makeResolveRepoUrl =
    (deps: { dbApi: DbApiV2; resolveRepository: ResolveRepository }): ResolveRepoUrl =>
    async ({ url }) => {
        const { dbApi, resolveRepository } = deps;

        const codeRepositoryUrl = normalizeRepoUrl(url);
        if (!codeRepositoryUrl) return { status: "invalid" };

        const sources = await dbApi.source.getAll();
        const resolution = await resolveRepository({ url: codeRepositoryUrl, sources });

        switch (resolution.status) {
            case "unsupported":
                return { status: "unsupported", codeRepositoryUrl };
            case "notFound":
                return { status: "notFound", codeRepositoryUrl, forgeKind: resolution.forgeKind };
            case "found": {
                const { repository } = resolution;
                return {
                    status: "found",
                    codeRepositoryUrl: repository.url,
                    forgeKind: repository.forgeKind,
                    externalId: repository.externalId,
                    name: repository.name,
                    description: repository.description,
                    license: repository.license,
                    image: repository.image,
                    keywords: repository.keywords,
                    existingSoftwareId: await findSoftwareIdByRepository({ dbApi, sources, repository })
                };
            }
        }
    };
