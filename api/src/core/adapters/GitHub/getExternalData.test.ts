// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { beforeAll, describe, expect, it } from "vitest";

import { getGitHubSoftwareExternalData } from "./getExternalData";
import { Source } from "../../usecases/readWriteSillData";
import { stubGitHubApi } from "../../../tools/test.helpers";
import catalogiGitHubResponses from "./fixtures/codegouvfr-catalogi.json";

const gitHubSource: Source = {
    slug: "GitHub",
    kind: "GitHub",
    url: "https://github.com/",
    category: "repository",
    description: { "en": "" },
    configuration: { auth: "" },
    lastImport: undefined,
    isLookupSource: false
};

describe("GitHub Adapter - Get external data", () => {
    beforeAll(() => stubGitHubApi(catalogiGitHubResponses));

    it("gets live repository data and checks the latest release time", async () => {
        const catalogiData = await getGitHubSoftwareExternalData({
            source: gitHubSource,
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

        const releaseDate = catalogiData?.latestVersion?.releaseDate;
        expect(catalogiData?.latestVersion?.version).toBeTruthy();
        expect(releaseDate).toBeTruthy();
        expect(Number.isNaN(Date.parse(releaseDate ?? ""))).toBe(false);
        expect(Date.parse(releaseDate ?? "")).toBeLessThanOrEqual(Date.now());
        expect(catalogiData?.dateCreated).toBe(releaseDate);
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

        const healthCheck = catalogiData?.repoMetadata?.healthCheck;
        expect(healthCheck?.lastCommit?.dateCreated).toBeTruthy();
        expect(Number.isNaN(Date.parse(healthCheck?.lastCommit?.dateCreated ?? ""))).toBe(false);
        expect(healthCheck?.lastClosedIssue?.dateModified).toBeTruthy();
        expect(Number.isNaN(Date.parse(healthCheck?.lastClosedIssue?.dateModified ?? ""))).toBe(false);
        expect(healthCheck?.lastClosedIssuePullRequest?.dateModified).toBeTruthy();
        expect(Number.isNaN(Date.parse(healthCheck?.lastClosedIssuePullRequest?.dateModified ?? ""))).toBe(false);
    }, 60_000);
});
