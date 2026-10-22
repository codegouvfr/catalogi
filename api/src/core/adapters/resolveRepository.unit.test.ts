// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import type { RepositoryResolution } from "../ports/ResolveRepository";
import { makeCachedResolveRepository, normalizeRepoUrl, stripForgeSubPage } from "./resolveRepository";

describe("normalizeRepoUrl", () => {
    it.each([
        ["https://github.com/keycloakify/keycloakify", "https://github.com/keycloakify/keycloakify"],
        ["https://github.com/keycloakify/keycloakify/", "https://github.com/keycloakify/keycloakify"],
        ["https://github.com/keycloakify/keycloakify.git", "https://github.com/keycloakify/keycloakify"],
        ["git+https://github.com/keycloakify/keycloakify.git", "https://github.com/keycloakify/keycloakify"],
        ["git@github.com:keycloakify/keycloakify.git", "https://github.com/keycloakify/keycloakify"],
        ["https://github.com/keycloakify/keycloakify/tree/main/src", "https://github.com/keycloakify/keycloakify"],
        ["  https://github.com/keycloakify/keycloakify?tab=readme  ", "https://github.com/keycloakify/keycloakify"],
        ["https://www.github.com/keycloakify/keycloakify/issues", "https://github.com/keycloakify/keycloakify"],
        ["http://github.com/keycloakify/keycloakify", "https://github.com/keycloakify/keycloakify"],
        ["https://gitlab.adullact.net/group/sub/project", "https://gitlab.adullact.net/group/sub/project"],
        ["https://gitlab.adullact.net/group/sub/project/-/tree/main", "https://gitlab.adullact.net/group/sub/project"]
    ])("%s -> %s", (input, expected) => {
        expect(normalizeRepoUrl(input)).toBe(expected);
    });

    it.each(["", "not an url", "ftp://example.org/repo", "https://github.com/", "https://framagit.org"])(
        "rejects %s",
        input => {
            expect(normalizeRepoUrl(input)).toBeUndefined();
        }
    );
});

describe("stripForgeSubPage", () => {
    it.each([
        ["https://codeberg.org/forgejo/forgejo", "https://codeberg.org/forgejo/forgejo"],
        ["https://codeberg.org/forgejo/forgejo/src/branch/forgejo/docs", "https://codeberg.org/forgejo/forgejo"],
        ["https://codeberg.org/forgejo/forgejo/issues/42", "https://codeberg.org/forgejo/forgejo"],
        ["https://bitbucket.org/workspace/repo/src/main", "https://bitbucket.org/workspace/repo"],
        ["https://git.sr.ht/~user/repo/tree/master/item/README.md", "https://git.sr.ht/~user/repo"],
        ["https://example.org/group/sub/project", "https://example.org/group/sub/project"]
    ])("%s -> %s", (input, expected) => {
        expect(stripForgeSubPage(input)).toBe(expected);
    });
});

describe("makeCachedResolveRepository", () => {
    it("resolves each repository once, but asks again a forge not answering", async () => {
        const resolved: string[] = [];
        const resolutions: Record<string, RepositoryResolution> = {
            "https://github.com/org/repo": { status: "unsupported", url: "https://github.com/org/repo" },
            "https://gitlab.com/org/repo": { status: "unreachable", forgeKind: "GitLab" }
        };
        const resolveRepository = makeCachedResolveRepository({
            resolveRepository: async ({ url }) => {
                resolved.push(url);
                return resolutions[url];
            }
        });

        for (const url of [
            "https://github.com/org/repo",
            "https://github.com/org/repo.git",
            "https://gitlab.com/org/repo",
            "https://gitlab.com/org/repo"
        ]) {
            await resolveRepository({ url, sources: [] });
        }

        expect(resolved).toEqual([
            "https://github.com/org/repo",
            "https://gitlab.com/org/repo",
            "https://gitlab.com/org/repo"
        ]);
    });
});
