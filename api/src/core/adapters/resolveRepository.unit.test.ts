// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { normalizeRepoUrl } from "./resolveRepository";

describe("normalizeRepoUrl", () => {
    it.each([
        ["https://github.com/keycloakify/keycloakify", "https://github.com/keycloakify/keycloakify"],
        ["https://github.com/keycloakify/keycloakify/", "https://github.com/keycloakify/keycloakify"],
        ["https://github.com/keycloakify/keycloakify.git", "https://github.com/keycloakify/keycloakify"],
        ["git+https://github.com/keycloakify/keycloakify.git", "https://github.com/keycloakify/keycloakify"],
        ["git@github.com:keycloakify/keycloakify.git", "https://github.com/keycloakify/keycloakify"],
        ["https://github.com/keycloakify/keycloakify/tree/main/src", "https://github.com/keycloakify/keycloakify"],
        ["  https://github.com/keycloakify/keycloakify?tab=readme  ", "https://github.com/keycloakify/keycloakify"],
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
