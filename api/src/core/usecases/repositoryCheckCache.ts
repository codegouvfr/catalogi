// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ResolvedRepository } from "../ports/ResolveRepository";
import type { DiscoveredSource } from "./discoverSourcesByRepository";
import { toComparableRepoUrl } from "../adapters/resolveRepository";
import { makeTtlCache } from "../../tools/ttlCache";

// What the form showed after checking a repository url. The creation binds the same
// entries, even when a forge or a source stops answering in between, and doesn't spend
// the forge quotas again.
export type RepositoryCheck = {
    // Only a found repository: a forge not answering, or a repository missing or not
    // recognized, is asked again.
    repository: ResolvedRepository | undefined;
    discoveredSources: DiscoveredSource[];
};

export type RepositoryCheckCache = {
    get: (repoUrl: string) => RepositoryCheck | undefined;
    // Saved under every spelling of the repository: as typed and as given by the forge.
    set: (repoUrls: string[], check: RepositoryCheck) => void;
};

export const makeRepositoryCheckCache = (params?: { ttlMs?: number; maxEntries?: number }): RepositoryCheckCache => {
    const cache = makeTtlCache<RepositoryCheck>({
        ttlMs: params?.ttlMs ?? 6 * 60 * 60_000,
        maxEntries: params?.maxEntries ?? 1_000
    });

    return {
        get: repoUrl => {
            const key = toComparableRepoUrl(repoUrl);
            return key === undefined ? undefined : cache.get(key);
        },
        set: (repoUrls, check) => {
            const keys = new Set(repoUrls.map(toComparableRepoUrl).filter(key => key !== undefined));
            for (const key of keys) cache.set(key, check);
        }
    };
};
