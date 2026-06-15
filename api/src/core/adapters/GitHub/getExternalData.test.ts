// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it, beforeAll } from "vitest";

import { getGitHubSoftwareExternalData } from "./getExternalData";
import { Source } from "../../usecases/readWriteSillData";

const mockGitHubSource: Source = {
    slug: "GitHub",
    kind: "GitHub",
    url: "https://github.com/",
    priority: 2,
    description: { "en": "" },
    configuration: {
        auth: ""
    }
};

describe("GitHub Adapter - Get external data", () => {
    beforeAll(async () => {});

    it("Get Catalogi", async () => {
        const catalogiData = await getGitHubSoftwareExternalData({
            source: mockGitHubSource,
            externalId: "https://github.com/codegouvfr/catalogi"
        });

        expect(catalogiData?.externalId).toBe("codegouvfr/catalogi");

        const identifiers = [
            {
                "@type": "PropertyValue",
                value: "https://github.com/codegouvfr/catalogi",
                url: "https://github.com/codegouvfr/catalogi",
                valueReference: "612979682",
                subjectOf: {
                    "@type": "Website",
                    "additionalType": "GitHub",
                    "name": "GitHub is a proprietary developer platform that allows developers to create, store, manage, and share their code.",
                    "url": new URL("https://github.com/")
                },
                additionalType: "Repo"
            }
        ];
        expect(catalogiData?.identifiers).toEqual(identifiers);
        expect(catalogiData?.identifiers[0].valueReference).toBe(identifiers[0].valueReference);

        // Repo Metadata
        expect(catalogiData?.repoMetadata).not.toBe(undefined);
        expect(catalogiData?.repoMetadata?.healthCheck).not.toBe(undefined);

        expect(catalogiData?.repoMetadata?.healthCheck?.lastCommit?.dateCreated).not.toBe(undefined);
        expect(catalogiData?.repoMetadata?.healthCheck?.lastCommit?.dateCreated.includes("2026")).toBe(true);
        expect(catalogiData?.repoMetadata?.healthCheck?.lastClosedIssue?.dateModified).not.toBe(undefined);
        expect(catalogiData?.repoMetadata?.healthCheck?.lastClosedIssue?.dateModified.includes("2026")).toBe(true);
        expect(catalogiData?.repoMetadata?.healthCheck?.lastClosedIssuePullRequest?.dateModified).not.toBe(undefined);
        expect(catalogiData?.repoMetadata?.healthCheck?.lastClosedIssuePullRequest?.dateModified.includes("2026")).toBe(
            true
        );
    });
});
