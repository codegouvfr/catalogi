// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { makeResolveRepository, normalizeRepoUrl, stripForgeSubPage, toComparableRepoUrl } from "./resolveRepository";

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

describe("toComparableRepoUrl", () => {
    it("gives the same value for every spelling of a repository", () => {
        const spellings = [
            "https://codeberg.org/Org/Repo",
            " http://codeberg.org/org/repo/ ",
            "https://codeberg.org/org/repo.git",
            "git@codeberg.org:org/repo.git"
        ];
        expect(new Set(spellings.map(toComparableRepoUrl))).toEqual(new Set(["https://codeberg.org/org/repo"]));
    });
});

describe("resolveRepository", () => {
    const makeResolve = () => {
        const probedUrls: string[] = [];
        const resolve = makeResolveRepository({
            detectForge: async url => {
                probedUrls.push(url);
                return undefined;
            }
        });
        return { resolve, probedUrls };
    };

    it("doesn't probe an unknown host for a user", async () => {
        const { resolve, probedUrls } = makeResolve();

        const resolution = await resolve({
            url: "https://forge.example.org/group/project",
            sources: [],
            canDetectForge: false
        });

        expect(resolution).toEqual({ status: "unsupported", url: "https://forge.example.org/group/project" });
        expect(probedUrls).toEqual([]);
    });

    it("probes an unknown host for an admin", async () => {
        const { resolve, probedUrls } = makeResolve();

        const resolution = await resolve({
            url: "https://forge.example.org/group/project/-/tree/main",
            sources: [],
            canDetectForge: true
        });

        expect(resolution).toEqual({ status: "unsupported", url: "https://forge.example.org/group/project" });
        expect(probedUrls).toEqual(["https://forge.example.org/group/project"]);
    });

    it("never calls a plain http host, even for an admin", async () => {
        const { resolve, probedUrls } = makeResolve();

        const resolution = await resolve({
            url: "http://10.0.0.5/group/project",
            sources: [],
            canDetectForge: true
        });

        expect(resolution).toEqual({ status: "unsupported", url: "http://10.0.0.5/group/project" });
        expect(probedUrls).toEqual([]);
    });
});
