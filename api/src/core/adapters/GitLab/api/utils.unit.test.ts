// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import type { Gitlab, ProjectSchema } from "@gitbeaker/core";
import { GitbeakerRequestError } from "@gitbeaker/requester-utils";
import { resolveExternalReferenceToProject } from "./utils";

const makeGitLabApi = (statusByPath: Record<string, number>) => {
    const askedPaths: string[] = [];
    const show = async (path: string) => {
        askedPaths.push(path);
        const status = statusByPath[path] ?? 404;
        if (status !== 200)
            throw new GitbeakerRequestError(`${status}`, {
                cause: {
                    description: "",
                    request: new Request("https://gitlab.com"),
                    response: new Response(null, { status })
                }
            });
        return { id: 1, path_with_namespace: path } as ProjectSchema;
    };
    // Gitbeaker's url for a source whose url is "https://gitlab.com/"
    const gitLabApi = { url: "https://gitlab.com//api/v4/", Projects: { show } } as unknown as Gitlab<false>;
    return { gitLabApi, askedPaths };
};

describe("resolveExternalReferenceToProject", () => {
    it("asks a numeric id or an owner/repo path as is", async () => {
        // Arrange
        const { gitLabApi, askedPaths } = makeGitLabApi({ "7153509": 200, "Remmina/Remmina": 200 });

        // Act
        await resolveExternalReferenceToProject({ externalId: "7153509", gitLabApi });
        await resolveExternalReferenceToProject({ externalId: "Remmina/Remmina", gitLabApi });

        // Assert
        expect(askedPaths).toEqual(["7153509", "Remmina/Remmina"]);
    });

    it("reads the project path of a url on the instance", async () => {
        // Arrange
        const { gitLabApi, askedPaths } = makeGitLabApi({ "kicad/code/kicad": 200, "wireshark/wireshark": 200 });

        // Act
        await resolveExternalReferenceToProject({
            externalId: "https://gitlab.com/kicad/code/kicad/-/tree/master",
            gitLabApi
        });
        await resolveExternalReferenceToProject({
            externalId: "https://gitlab.com/wireshark/wireshark.git/",
            gitLabApi
        });

        // Assert
        expect(askedPaths).toEqual(["kicad/code/kicad", "wireshark/wireshark"]);
    });

    it("finds a project in a subgroup by its full path", async () => {
        // Arrange
        const { gitLabApi } = makeGitLabApi({ "sane-project/frontend/xsane": 200 });

        // Act
        const project = await resolveExternalReferenceToProject({
            externalId: "sane-project/frontend/xsane",
            gitLabApi
        });

        // Assert
        expect(project?.path_with_namespace).toBe("sane-project/frontend/xsane");
    });

    it("falls back to owner/repo when the full path is not found", async () => {
        // Arrange
        const { gitLabApi, askedPaths } = makeGitLabApi({ "GNOME/gimp": 200 });

        // Act
        const project = await resolveExternalReferenceToProject({ externalId: "GNOME/gimp/tree/master", gitLabApi });

        // Assert
        expect(project?.path_with_namespace).toBe("GNOME/gimp");
        expect(askedPaths).toEqual(["GNOME/gimp/tree/master", "GNOME/gimp"]);
    });

    it("reports not found when no path is a project", async () => {
        // Arrange
        const { gitLabApi } = makeGitLabApi({});

        // Act
        const resolution = resolveExternalReferenceToProject({ externalId: "henix/open-source/squash-tm", gitLabApi });

        // Assert
        await expect(resolution).rejects.toThrow(GitbeakerRequestError);
    });

    it("stops at the first failure other than not found", async () => {
        // Arrange
        const { gitLabApi, askedPaths } = makeGitLabApi({ "mallette/scribe/python": 500 });

        // Act
        const resolution = resolveExternalReferenceToProject({ externalId: "mallette/scribe/python", gitLabApi });

        // Assert
        await expect(resolution).rejects.toThrow(GitbeakerRequestError);
        expect(askedPaths).toEqual(["mallette/scribe/python"]);
    });
});
