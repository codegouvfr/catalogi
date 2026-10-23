// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ForgeKind } from "../usecases/ensureForgeSource";
import type { Source } from "../usecases/readWriteSillData";

export type ResolvedRepository = {
    forgeKind: ForgeKind;
    // Canonical web url of the repository, as given by the forge.
    url: string;
    // Same value as the repository identifier: `owner/repo` on GitHub, project id on GitLab.
    externalId: string;
    name: string;
    description: string | undefined;
    license: string | undefined;
    image: string | undefined;
    keywords: string[];
};

export type RepositoryResolution =
    | { status: "found"; repository: ResolvedRepository }
    // Known forge, but the repository doesn't exist or can't be read.
    | { status: "notFound"; forgeKind: ForgeKind }
    // Known forge not answering (rate limit, timeout...): the repository may exist.
    | { status: "unreachable"; forgeKind: ForgeKind }
    // Forge we have no adapter for (Forgejo, SourceHut...).
    // `url` is the repository url without the forge sub-page, when it could be told apart.
    | { status: "unsupported"; url: string | undefined };

// `sources` provides the auth of already registered forge instances.
export type ResolveRepository = (params: { url: string; sources: Source[] }) => Promise<RepositoryResolution>;
