// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it, beforeAll } from "vitest";

import { getGitHubSoftwareExternalData } from "./getExternalData";
import { Source } from "../../usecases/readWriteSillData";
import { stubGitHubApi } from "../../../tools/test.helpers";
import catalogiGitHubResponses from "./fixtures/codegouvfr-catalogi.json";

const mockGitHubSource: Source = {
    slug: "GitHub",
    kind: "GitHub",
    url: "https://github.com/",
    category: "repository",
    description: { "en": "" },
    configuration: {
        auth: ""
    },
    lastImport: undefined,
    isLookupSource: false
};

describe("GitHub Adapter - Get external data", () => {
    beforeAll(() => stubGitHubApi(catalogiGitHubResponses));

    it("Get Catalogi", async () => {
        const catalogiData = await getGitHubSoftwareExternalData({
            source: mockGitHubSource,
            externalId: "codegouvfr/catalogi"
        });

        expect(catalogiData?.externalId).toBe("codegouvfr/catalogi");

        const identifiers = [
            {
                "@type": "PropertyValue",
                value: "codegouvfr/catalogi",
                url: "https://github.com/codegouvfr/catalogi",
                valueReference: "612979682",
                subjectOf: {
                    "@type": "WebSite",
                    "additionalType": "GitHub",
                    "name": "GitHub is a proprietary developer platform that allows developers to create, store, manage, and share their code.",
                    "url": new URL("https://github.com/")
                },
                additionalType: "Repo"
            }
        ];
        expect(catalogiData?.identifiers).toEqual(identifiers);
        expect(catalogiData?.identifiers[0].valueReference).toBe(identifiers[0].valueReference);

        expect(catalogiData).toMatchObject({
            name: { en: "codegouvfr/catalogi" },
            description: { en: "A Software Catalog application" },
            url: "https://codegouvfr.github.io/catalogi/",
            codeRepositoryUrl: "https://github.com/codegouvfr/catalogi",
            license: undefined,
            keywords: ["freesoftware", "opensource"],
            programmingLanguages: ["TypeScript", "JavaScript", "Shell", "Go Template", "HTML"],
            latestVersion: { version: "v1.55.21" }
        });

        // The bot is left out, a contributor without name is named after their login.
        expect(catalogiData?.authors).toMatchObject([
            {
                name: "Alice Example",
                url: "https://github.com/alice-example",
                affiliations: [{ "@type": "Organization", name: "@ExampleOrg" }]
            },
            { name: "Bob", url: "https://bob.example.org", affiliations: [{ name: "@OtherOrg" }] },
            { name: "carol-example", url: "https://github.com/carol-example", affiliations: [] }
        ]);

        // Repo Metadata
        expect(catalogiData?.repoMetadata).not.toBe(undefined);
        expect(catalogiData?.repoMetadata?.healthCheck).not.toBe(undefined);

        expect(catalogiData?.repoMetadata?.healthCheck?.lastCommit?.dateCreated).toBe("2026-11-12T09:25:58.000Z");
        expect(catalogiData?.repoMetadata?.healthCheck?.lastClosedIssue?.dateModified).not.toBe(undefined);
        expect(catalogiData?.repoMetadata?.healthCheck?.lastClosedIssue?.dateModified.includes("2026")).toBe(true);
        expect(catalogiData?.repoMetadata?.healthCheck?.lastClosedIssuePullRequest?.dateModified).toBe(
            "2026-11-05T11:51:08.000Z"
        );
    });
});
