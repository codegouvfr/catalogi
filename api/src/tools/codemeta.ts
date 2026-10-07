// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SoftwareDetail } from "../lib";
import { createResolveLocalizedString } from "i18nifty/LocalizedString/reactless";
import type { Language } from "../core/ports/GetSoftwareExternalData";
import {
    SoftwareApplication,
    SoftwareSourceCode,
    URL as URLSMA,
    Date as DateSMA,
    Text,
    Person,
    ScholarlyArticle,
    PropertyValue,
    PersonLeaf,
    OrganizationLeaf,
    WebPage
} from "schema-dts";
import { SchemaIdentifier, SchemaOrganization, SchemaPerson } from "../core/adapters/dbApi/kysely/kysely.database";

const { resolveLocalizedString } = createResolveLocalizedString<Language>({
    "currentLanguage": "fr",
    "fallbackLanguage": "en"
});

type CodeMetaLeaf<T> = T | T[] | undefined;

export type CodeMeta = SoftwareApplication &
    Pick<SoftwareSourceCode, "codeRepository" | "programmingLanguage" | "targetProduct"> &
    Pick<WebPage, "relatedLink"> & {
        "@context": typeof CODEMETA_CONTEXT;
        buildInstructions: CodeMetaLeaf<URLSMA>;
        contIntegration: CodeMetaLeaf<URLSMA>;
        continuousIntegration: CodeMetaLeaf<URLSMA>;
        developmentStatus: CodeMetaLeaf<URLSMA>;
        embargoDate: CodeMetaLeaf<DateSMA>;
        embargoEndDate: CodeMetaLeaf<DateSMA>;
        funding: CodeMetaLeaf<Text>;
        hasSourceCode: CodeMetaLeaf<SoftwareSourceCode>;
        isSourceCodeOf: CodeMetaLeaf<SoftwareApplication>;
        issueTracker: CodeMetaLeaf<URLSMA>;
        maintainer: CodeMetaLeaf<Person>;
        readme: CodeMetaLeaf<URLSMA>;
        referencePublication?: CodeMetaLeaf<ScholarlyArticle>;
        softwareSuggestions: CodeMetaLeaf<SoftwareSourceCode>;
    };

export const CODEMETA_CONTEXT = "CodeMeta V3";

// Tools to convert
const operatingSystemToReadable = (
    operatingSystem: Partial<Record<"windows" | "linux" | "mac" | "android" | "ios", boolean>>
): string | undefined => {
    const os = [];
    if (operatingSystem.windows) os.push("Windows");
    if (operatingSystem.linux) os.push("Linux");
    if (operatingSystem.mac) os.push("Mac");
    if (operatingSystem.android) os.push("Android");
    if (operatingSystem.ios) os.push("Ios");

    return os.length > 0 ? os.join(",") : undefined;
};

const authorToReadable = (
    authors: (SchemaPerson | SchemaOrganization)[] | undefined
): (OrganizationLeaf | PersonLeaf)[] => {
    if (!authors) return [];

    return authors.map(author => {
        return {
            ...author,
            identifier: author.identifiers,
            ...(author["@type"] == "Person" ? { affiliation: authorToReadable(author.affiliations) } : {}),
            ...(author["@type"] == "Organization"
                ? { parentOrganization: authorToReadable(author.parentOrganizations) }
                : {})
        };
    }) as (OrganizationLeaf | PersonLeaf)[];
};

const identifierToReadable = (identifer: SchemaIdentifier): PropertyValue | Text | URLSMA => {
    const test = {
        ...identifer,
        url: identifer.url?.toString(),
        ...(identifer.subjectOf
            ? {
                  subjectOf: {
                      ...identifer.subjectOf,
                      url: identifer.subjectOf.url.toString()
                  }
              }
            : {})
    };

    return test as PropertyValue;
};

export const softwareDetailsToCodeMeta = (softwareDetails: SoftwareDetail): CodeMeta => {
    const {
        applicationCategories,
        authors,
        latestVersion,
        description,
        identifiers,
        keywords,
        license,
        name,
        operatingSystems,
        similarSoftwares,
        url,
        codeRepositoryUrl,
        programmingLanguages,
        referencePublications,
        // softwareHelp,
        providers
    } = softwareDetails;

    return {
        "@context": CODEMETA_CONTEXT,
        "@type": "SoftwareApplication",
        applicationCategory: applicationCategories.join("; "),
        applicationSubCategory: undefined,
        author: authorToReadable(authors),
        citation: undefined, // TODO Check
        contributor: undefined,
        copyrightHolder: undefined,
        copyrightYear: undefined,
        dateCreated: undefined,
        dateModified: latestVersion?.releaseDate,
        datePublished: undefined,
        description: resolveLocalizedString(description),
        downloadUrl: undefined,
        editor: undefined,
        encoding: undefined,
        fileFormat: undefined,
        fileSize: undefined,
        funder: undefined,
        hasPart: undefined,
        identifier: identifiers?.map(identifierToReadable),
        installUrl: undefined,
        isAccessibleForFree: undefined, // TODO According Licence
        isPartOf: undefined,
        keywords: keywords,
        license: license,
        memoryRequirements: undefined,
        name: resolveLocalizedString(name),
        operatingSystem: operatingSystemToReadable(operatingSystems),
        permissions: undefined,
        position: undefined,
        processorRequirements: undefined,
        producer: undefined,
        provider: authorToReadable(providers),
        publisher: undefined,
        releaseNotes: undefined,
        review: undefined,
        runtimePlatform: undefined,
        sameAs: similarSoftwares.map(simi => resolveLocalizedString(simi.name)),
        softwareHelp: undefined, // TODO softwareHelp
        softwareRequirements: undefined,
        softwareVersion: undefined,
        sponsor: undefined,
        storageRequirements: undefined,
        supportingData: undefined,
        url: url,
        version: latestVersion?.version,
        // From WebPage
        relatedLink: undefined,
        // From SoftwareSourceCode
        codeRepository: codeRepositoryUrl,
        programmingLanguage: programmingLanguages,
        targetProduct: undefined,
        // New for code meta
        buildInstructions: undefined,
        contIntegration: undefined,
        continuousIntegration: undefined,
        developmentStatus: undefined,
        embargoDate: undefined,
        embargoEndDate: undefined,
        funding: undefined,
        hasSourceCode: undefined,
        isSourceCodeOf: undefined,
        issueTracker: undefined,
        maintainer: undefined,
        readme: undefined,
        referencePublication: referencePublications,
        softwareSuggestions: undefined
    };
};
