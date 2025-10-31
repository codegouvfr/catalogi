// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import "minimal-polyfills/Object.fromEntries";
import { createCompareFn } from "core/tools/compareFn";
import type { State as RootState } from "core/bootstrap";
import { createSelector } from "redux-clean-architecture";
import { objectKeys } from "tsafe/objectKeys";
import memoize from "memoizee";
import { id } from "tsafe/id";
import { assert } from "tsafe/assert";
import type { Equals } from "tsafe";
import { exclude } from "tsafe/exclude";
import type { ApiTypes } from "api";
import { createResolveLocalizedString } from "i18nifty";
import { LocalizedString } from "../../../ui/i18n";
import { name, type State } from "./state";
import { selectors as uiConfigSelectors } from "../uiConfig.slice";

const internalSoftwares = (rootState: RootState) => {
    return rootState[name].softwares;
};
const searchResults = (rootState: RootState) => rootState[name].searchResults;
const sort = (rootState: RootState) => rootState[name].sort;
const organization = (rootState: RootState) => rootState[name].organization;
const category = (rootState: RootState) => rootState[name].category;
const programmingLanguage = (rootState: RootState) => rootState[name].programmingLanguage;
const environment = (rootState: RootState) => rootState[name].environment;
const filteredAttributeNames = (rootState: RootState) =>
    rootState[name].filteredAttributeNames;
const userEmail = (rootState: RootState) => rootState[name].userEmail;

const sortOptions = createSelector(
    searchResults,
    sort,
    userEmail,
    uiConfigSelectors.main,
    (searchResults, sort, userEmail, ui): State.Sort[] => {
        const uiConfig = ui?.uiConfig;
        const sorts: State.Sort[] = [
            ...(searchResults !== undefined || sort === "best_match"
                ? ["best_match" as const]
                : []),
            ...(userEmail === undefined ? [] : ["my_software" as const]),
            ...(uiConfig?.catalog.sortOptions.referent_count
                ? ["referent_count" as const]
                : []),
            ...(uiConfig?.catalog.sortOptions.user_count ? ["user_count" as const] : []),
            ...(uiConfig?.catalog.sortOptions.added_time ? ["added_time" as const] : []),
            ...(uiConfig?.catalog.sortOptions.update_time
                ? ["update_time" as const]
                : []),
            ...(uiConfig?.catalog.sortOptions.latest_version_publication_date
                ? ["latest_version_publication_date" as const]
                : []),
            ...(uiConfig?.catalog.sortOptions.user_count_ASC
                ? ["user_count_ASC" as const]
                : []),
            ...(uiConfig?.catalog.sortOptions.referent_count_ASC
                ? ["referent_count_ASC" as const]
                : [])
        ];

        assert<Equals<(typeof sorts)[number], State.Sort>>();

        return sorts;
    }
);

const softwares = createSelector(
    internalSoftwares,
    searchResults,
    sort,
    organization,
    category,
    programmingLanguage,
    environment,
    filteredAttributeNames,
    (
        internalSoftwares,
        searchResults,
        sort,
        organization,
        category,
        programmingLanguage,
        environment,
        filteredAttributeNames
    ) => {
        let tmpSoftwares = internalSoftwares;

        let positionsBySoftwareName: Map<string, Set<number>> | undefined = undefined;

        if (searchResults !== undefined) {
            const filterResults = filterAndSortBySearch({
                searchResults,
                softwares: tmpSoftwares
            });

            tmpSoftwares = filterResults.map(({ software, positions }) => {
                (positionsBySoftwareName ??= new Map()).set(
                    software.softwareName,
                    positions
                );
                return software;
            });
        }

        if (organization !== undefined) {
            tmpSoftwares = filterByOrganization({
                softwares: tmpSoftwares,
                organization: organization
            });
        }

        if (category !== undefined) {
            tmpSoftwares = filterByCategory({
                softwares: tmpSoftwares,
                category: category
            });
        }

        if (programmingLanguage) {
            tmpSoftwares = filterByProgrammingLanguage({
                softwares: tmpSoftwares,
                programmingLanguage: programmingLanguage
            });
        }

        if (environment !== undefined) {
            tmpSoftwares = filterByEnvironnement({
                softwares: tmpSoftwares,
                environment: environment
            });
        }

        for (const attributeName of filteredAttributeNames) {
            tmpSoftwares = filterByAttributeName({
                softwares: tmpSoftwares,
                attributeName
            });
        }

        if (sort !== "best_match") {
            tmpSoftwares = [...tmpSoftwares].sort(
                (() => {
                    switch (sort) {
                        case "added_time":
                            return createCompareFn<State.Software.Internal>({
                                getWeight: software => software.addedTime,
                                order: "descending"
                            });
                        case "update_time":
                            return createCompareFn<State.Software.Internal>({
                                getWeight: software => software.updateTime,
                                order: "descending"
                            });
                        case "latest_version_publication_date":
                            return createCompareFn<State.Software.Internal>({
                                getWeight: software =>
                                    software.latestVersion?.publicationTime ?? 0,
                                order: "descending",
                                tieBreaker: createCompareFn({
                                    getWeight: software => software.updateTime,
                                    order: "descending"
                                })
                            });
                        case "referent_count":
                            return createCompareFn<State.Software.Internal>({
                                getWeight: software => software.referentCount,
                                order: "descending"
                            });
                        case "referent_count_ASC":
                            return createCompareFn<State.Software.Internal>({
                                getWeight: software => software.referentCount,
                                order: "ascending"
                            });
                        case "user_count":
                            return createCompareFn<State.Software.Internal>({
                                getWeight: software => software.userCount,
                                order: "descending"
                            });
                        case "user_count_ASC":
                            return createCompareFn<State.Software.Internal>({
                                getWeight: software => software.userCount,
                                order: "ascending"
                            });
                        case "my_software":
                            return createCompareFn<State.Software.Internal>({
                                getWeight: software =>
                                    software.userDeclaration === undefined
                                        ? 0
                                        : software.userDeclaration.isReferent
                                          ? 2
                                          : software.userDeclaration.isUser
                                            ? 1
                                            : 0,
                                order: "descending"
                            });
                    }

                    assert<Equals<typeof sort, never>>(false);
                })()
            );
        }

        return tmpSoftwares.map(software =>
            internalSoftwareToExternalSoftware({
                internalSoftware: software,
                positions: (() => {
                    if (positionsBySoftwareName === undefined) {
                        return undefined;
                    }
                    const positions = positionsBySoftwareName.get(software.softwareName);

                    assert(positions !== undefined);

                    return positions;
                })()
            })
        );
    }
);

const organizationOptions = createSelector(
    internalSoftwares,
    searchResults,
    category,
    programmingLanguage,
    environment,
    filteredAttributeNames,
    (
        internalSoftwares,
        searchResults,
        category,
        programmingLanguage,
        environment,
        filteredAttributeNames
    ): { organization: string; softwareCount: number }[] => {
        const softwareCountInCurrentFilterByOrganization = Object.fromEntries(
            Array.from(
                new Set(
                    internalSoftwares
                        .map(({ organizations }) => organizations)
                        .reduce((prev, curr) => [...prev, ...curr], [])
                )
            ).map(organization => [organization, 0])
        );

        let tmpSoftwares = internalSoftwares;

        if (searchResults !== undefined) {
            tmpSoftwares = filterAndSortBySearch({
                searchResults,
                softwares: tmpSoftwares
            }).map(({ software }) => software);
        }

        if (category !== undefined) {
            tmpSoftwares = filterByCategory({
                softwares: tmpSoftwares,
                category: category
            });
        }

        if (programmingLanguage) {
            tmpSoftwares = filterByProgrammingLanguage({
                softwares: tmpSoftwares,
                programmingLanguage: programmingLanguage
            });
        }

        if (environment !== undefined) {
            tmpSoftwares = filterByEnvironnement({
                softwares: tmpSoftwares,
                environment: environment
            });
        }

        for (const attributeName of filteredAttributeNames) {
            tmpSoftwares = filterByAttributeName({
                softwares: tmpSoftwares,
                attributeName
            });
        }

        tmpSoftwares.forEach(({ organizations }) =>
            organizations.forEach(
                organization => softwareCountInCurrentFilterByOrganization[organization]++
            )
        );

        return Object.entries(softwareCountInCurrentFilterByOrganization)
            .map(([organization, softwareCount]) => ({
                organization,
                softwareCount
            }))
            .sort((a, b) => {
                if (a.organization === "other" && b.organization !== "other") {
                    return 1; // Move "other" to the end
                } else if (a.organization !== "other" && b.organization === "other") {
                    return -1; // Move "other" to the end
                } else {
                    return b.softwareCount - a.softwareCount; // Otherwise, sort by softwareCount
                }
            });
    }
);

const categoryOptions = createSelector(
    internalSoftwares,
    searchResults,
    organization,
    programmingLanguage,
    environment,
    filteredAttributeNames,
    (
        internalSoftwares,
        searchResults,
        organization,
        programmingLanguage,
        environment,
        filteredAttributeNames
    ): { category: string; softwareCount: number }[] => {
        const softwareCountInCurrentFilterByCategory = Object.fromEntries(
            Array.from(
                new Set(
                    internalSoftwares
                        .map(({ applicationCategories }) => applicationCategories)
                        .reduce((prev, curr) => [...prev, ...curr], [])
                )
            ).map(category => [category, 0])
        );

        let tmpSoftwares = internalSoftwares;

        if (searchResults !== undefined) {
            tmpSoftwares = filterAndSortBySearch({
                searchResults,
                softwares: tmpSoftwares
            }).map(({ software }) => software);
        }

        if (organization !== undefined) {
            tmpSoftwares = filterByOrganization({
                softwares: tmpSoftwares,
                organization: organization
            });
        }

        if (programmingLanguage) {
            tmpSoftwares = filterByProgrammingLanguage({
                softwares: tmpSoftwares,
                programmingLanguage: programmingLanguage
            });
        }

        if (environment !== undefined) {
            tmpSoftwares = filterByEnvironnement({
                softwares: tmpSoftwares,
                environment: environment
            });
        }

        for (const attributeName of filteredAttributeNames) {
            tmpSoftwares = filterByAttributeName({
                softwares: tmpSoftwares,
                attributeName
            });
        }

        tmpSoftwares.forEach(({ applicationCategories }) =>
            applicationCategories.forEach(
                category => softwareCountInCurrentFilterByCategory[category]++
            )
        );

        return Object.entries(softwareCountInCurrentFilterByCategory)
            .map(([category, softwareCount]) => ({
                category,
                softwareCount
            }))
            .filter(({ softwareCount }) => softwareCount !== 0)
            .sort((a, b) => b.softwareCount - a.softwareCount);
    }
);

const environmentOptions = createSelector(
    internalSoftwares,
    searchResults,
    organization,
    category,
    programmingLanguage,
    filteredAttributeNames,
    (
        internalSoftwares,
        searchResults,
        organization,
        category,
        programmingLanguage,
        filteredAttributeNames
    ): { environment: State.Environment; softwareCount: number }[] => {
        const softwareCountInCurrentFilterByEnvironment = new Map(
            Array.from(
                new Set(
                    internalSoftwares
                        // eslint-disable-next-line array-callback-return
                        .map(({ softwareType }): State.Environment[] => {
                            switch (softwareType.type) {
                                case "cloud":
                                    return ["browser"];
                                case "stack":
                                    return ["stack" as const];
                                case "desktop/mobile":
                                    return objectKeys(softwareType.os).filter(
                                        os => softwareType.os[os]
                                    );
                            }
                            assert(
                                false,
                                `Unrecognized software type: ${JSON.stringify(
                                    softwareType
                                )}`
                            );
                        })
                        .reduce((prev, curr) => [...prev, ...curr], [])
                )
            ).map(environment => [environment, id<number>(0)] as const)
        );

        let tmpSoftwares = internalSoftwares;

        if (searchResults !== undefined) {
            tmpSoftwares = filterAndSortBySearch({
                softwares: tmpSoftwares,
                searchResults
            }).map(({ software }) => software);
        }

        if (organization !== undefined) {
            tmpSoftwares = filterByOrganization({
                softwares: tmpSoftwares,
                organization: organization
            });
        }

        if (programmingLanguage) {
            tmpSoftwares = filterByProgrammingLanguage({
                softwares: tmpSoftwares,
                programmingLanguage: programmingLanguage
            });
        }

        if (category !== undefined) {
            tmpSoftwares = filterByCategory({
                softwares: tmpSoftwares,
                category: category
            });
        }

        for (const attributeName of filteredAttributeNames) {
            tmpSoftwares = filterByAttributeName({
                softwares: tmpSoftwares,
                attributeName
            });
        }

        tmpSoftwares.forEach(({ softwareType }) => {
            switch (softwareType.type) {
                case "cloud":
                    softwareCountInCurrentFilterByEnvironment.set(
                        "browser",
                        softwareCountInCurrentFilterByEnvironment.get("browser")! + 1
                    );
                    break;
                case "stack":
                    softwareCountInCurrentFilterByEnvironment.set(
                        "stack",
                        softwareCountInCurrentFilterByEnvironment.get("stack")! + 1
                    );
                    break;
                case "desktop/mobile":
                    objectKeys(softwareType.os)
                        .filter(os => softwareType.os[os])
                        .forEach(os =>
                            softwareCountInCurrentFilterByEnvironment.set(
                                os,
                                softwareCountInCurrentFilterByEnvironment.get(os)! + 1
                            )
                        );
                    break;
            }
        });

        return Array.from(softwareCountInCurrentFilterByEnvironment.entries())
            .map(([environment, softwareCount]) => ({
                environment,
                softwareCount
            }))
            .sort((a, b) => b.softwareCount - a.softwareCount);
    }
);

const attributeNameFilterOptions = createSelector(
    internalSoftwares,
    searchResults,
    organization,
    category,
    programmingLanguage,
    environment,
    filteredAttributeNames,
    uiConfigSelectors.main,
    (
        internalSoftwares,
        searchResults,
        organization,
        category,
        programmingLanguage,
        environment,
        filteredAttributeNames,
        ui
    ): {
        attributeName: State.AttributeName;
        attributeLabel: LocalizedString;
        softwareCount: number;
    }[] => {
        const softwareCountInCurrentFilterByAttributeName = new Map(
            [
                ...Array.from(
                    new Set(
                        internalSoftwares
                            .map(({ customAttributes }) => {
                                if (!customAttributes) return [];
                                return objectKeys(customAttributes).filter(
                                    attributeName => customAttributes[attributeName]
                                );
                            })
                            .reduce((prev, curr) => [...prev, ...curr], [])
                    )
                ),
                "isInstallableOnUserComputer" as const
            ].map(attributeName => [attributeName, id<number>(0)] as const)
        );

        let tmpSoftwares = internalSoftwares;

        if (searchResults !== undefined) {
            tmpSoftwares = filterAndSortBySearch({
                softwares: tmpSoftwares,
                searchResults
            }).map(({ software }) => software);
        }

        if (organization !== undefined) {
            tmpSoftwares = filterByOrganization({
                softwares: tmpSoftwares,
                organization: organization
            });
        }

        if (category !== undefined) {
            tmpSoftwares = filterByCategory({
                softwares: tmpSoftwares,
                category: category
            });
        }

        if (programmingLanguage) {
            tmpSoftwares = filterByProgrammingLanguage({
                softwares: tmpSoftwares,
                programmingLanguage: programmingLanguage
            });
        }

        if (environment !== undefined) {
            tmpSoftwares = filterByEnvironnement({
                softwares: tmpSoftwares,
                environment: environment
            });
        }

        for (const attributeName of filteredAttributeNames) {
            tmpSoftwares = filterByAttributeName({
                softwares: tmpSoftwares,
                attributeName
            });
        }

        tmpSoftwares.forEach(({ customAttributes, softwareType }) => {
            if (!customAttributes) return;
            objectKeys(customAttributes)
                .filter(attributeName => customAttributes[attributeName])
                .forEach(attributeName => {
                    const currentCount =
                        softwareCountInCurrentFilterByAttributeName.get(attributeName);

                    assert(currentCount !== undefined);

                    softwareCountInCurrentFilterByAttributeName.set(
                        attributeName,
                        currentCount + 1
                    );
                });

            (["isInstallableOnUserComputer"] as const).forEach(attributeName => {
                switch (attributeName) {
                    case "isInstallableOnUserComputer":
                        if (softwareType.type !== "desktop/mobile") {
                            return;
                        }
                        break;
                }

                const currentCount =
                    softwareCountInCurrentFilterByAttributeName.get(attributeName);

                assert(currentCount !== undefined);

                softwareCountInCurrentFilterByAttributeName.set(
                    attributeName,
                    currentCount + 1
                );
            });
        });

        const getLabel = (attributeName: string) =>
            ui?.attributeDefinitions.find(({ name }) => attributeName === name)?.label;

        /** prettier-ignore */
        return Array.from(softwareCountInCurrentFilterByAttributeName.entries())
            .filter(([attributeName]) => getLabel(attributeName) !== undefined)
            .map(([attributeName, softwareCount]) => ({
                attributeName,
                attributeLabel: getLabel(attributeName)!,
                softwareCount
            }));
    }
);

const programmingLanguageOptions = createSelector(
    internalSoftwares,
    searchResults,
    organization,
    category,
    environment,
    filteredAttributeNames,
    (
        internalSoftwares,
        searchResults,
        organization,
        category,
        environment,
        filteredAttributeNames
    ): { programmingLanguage: string; softwareCount: number }[] => {
        const softwareCountInCurrentFilterByProgrammingLanguage = Object.fromEntries(
            Array.from(
                new Set(
                    internalSoftwares
                        .map(({ programmingLanguages }) => programmingLanguages)
                        .reduce((prev, curr) => [...prev, ...curr], [])
                )
            ).map(category => [category, 0])
        );

        let tmpSoftwares = internalSoftwares;

        if (searchResults !== undefined) {
            tmpSoftwares = filterAndSortBySearch({
                softwares: tmpSoftwares,
                searchResults
            }).map(({ software }) => software);
        }

        if (organization !== undefined) {
            tmpSoftwares = filterByOrganization({
                softwares: tmpSoftwares,
                organization: organization
            });
        }

        if (category !== undefined) {
            tmpSoftwares = filterByCategory({
                softwares: tmpSoftwares,
                category: category
            });
        }

        if (environment !== undefined) {
            tmpSoftwares = filterByEnvironnement({
                softwares: tmpSoftwares,
                environment: environment
            });
        }

        for (const attributeName of filteredAttributeNames) {
            tmpSoftwares = filterByAttributeName({
                softwares: tmpSoftwares,
                attributeName
            });
        }

        tmpSoftwares.forEach(({ programmingLanguages }) =>
            programmingLanguages.forEach(
                programmingLanguages =>
                    softwareCountInCurrentFilterByProgrammingLanguage[
                        programmingLanguages
                    ]++
            )
        );

        return Object.entries(softwareCountInCurrentFilterByProgrammingLanguage)
            .map(([programmingLanguage, softwareCount]) => ({
                programmingLanguage,
                softwareCount
            }))
            .filter(({ softwareCount }) => softwareCount !== 0)
            .sort((a, b) => b.softwareCount - a.softwareCount);
    }
);

const main = createSelector(
    softwares,
    sortOptions,
    organizationOptions,
    categoryOptions,
    environmentOptions,
    programmingLanguageOptions,
    attributeNameFilterOptions,
    (
        softwares,
        sortOptions,
        organizationOptions,
        categoryOptions,
        environmentOptions,
        programmingLanguageOptions,
        attributeNameFilterOptions
    ) => ({
        softwares,
        sortOptions,
        organizationOptions,
        categoryOptions,
        environmentOptions,
        programmingLanguageOptions,
        attributeNameFilterOptions
    })
);

export const selectors = { main };

const { filterAndSortBySearch } = (() => {
    const getIndexBySoftwareName = memoize(
        (softwares: State.Software.Internal[]) =>
            Object.fromEntries(softwares.map(({ softwareName }, i) => [softwareName, i])),
        { max: 1 }
    );

    function filterAndSortBySearch(params: {
        searchResults: {
            softwareName: string;
            positions: number[];
        }[];
        softwares: State.Software.Internal[];
    }) {
        const { searchResults, softwares } = params;

        const indexBySoftwareName = getIndexBySoftwareName(softwares);

        return searchResults
            .map(({ softwareName }) => softwareName)
            .map((softwareName, i) => ({
                software: softwares[indexBySoftwareName[softwareName]],
                positions: new Set(searchResults[i].positions)
            }));
    }

    return { filterAndSortBySearch };
})();

function filterByOrganization(params: {
    softwares: State.Software.Internal[];
    organization: string;
}) {
    const { softwares, organization } = params;

    return softwares.filter(({ organizations }) => organizations.includes(organization));
}

function filterByCategory(params: {
    softwares: State.Software.Internal[];
    category: string;
}) {
    const { softwares, category } = params;

    return softwares.filter(({ applicationCategories }) =>
        applicationCategories.includes(category)
    );
}

function filterByProgrammingLanguage(params: {
    softwares: State.Software.Internal[];
    programmingLanguage: string;
}) {
    const { softwares, programmingLanguage } = params;
    return softwares.filter(({ programmingLanguages }) =>
        programmingLanguages.includes(programmingLanguage)
    );
}

function filterByEnvironnement(params: {
    softwares: State.Software.Internal[];
    environment: State.Environment;
}) {
    const { softwares, environment } = params;

    // eslint-disable-next-line array-callback-return
    return softwares.filter(({ softwareType }) => {
        switch (environment) {
            case "linux":
            case "mac":
            case "windows":
            case "android":
            case "ios":
                return (
                    softwareType.type === "desktop/mobile" && softwareType.os[environment]
                );
            case "browser":
                return softwareType.type === "cloud";
            case "stack":
                return softwareType.type === "stack";
        }
    });
}

function filterByAttributeName(params: {
    softwares: State.Software.Internal[];
    attributeName: State.AttributeName;
}) {
    const { softwares, attributeName } = params;

    return softwares.filter(
        software =>
            ({
                ...internalSoftwareToExternalSoftware({
                    internalSoftware: software,
                    positions: undefined
                }).customAttributes,
                ...software.customAttributes
            })[attributeName]
    );
}

function apiSoftwareToInternalSoftware(params: {
    apiSoftwares: ApiTypes.Software[];
    softwareRef: SoftwareRef;
    userDeclaration:
        | {
              isUser: boolean;
              isReferent: boolean;
          }
        | undefined;
}): State.Software.Internal | undefined {
    const { apiSoftwares, softwareRef, userDeclaration } = params;

    // eslint-disable-next-line array-callback-return
    const apiSoftware = apiSoftwares.find(apiSoftware => {
        switch (softwareRef.type) {
            case "name":
                return apiSoftware.softwareName === softwareRef.softwareName;
            case "externalId":
                return apiSoftware.externalId === softwareRef.externalId;
        }
    });

    if (apiSoftware === undefined) {
        return undefined;
    }

    const {
        softwareName,
        logoUrl,
        softwareDescription,
        latestVersion,
        addedTime,
        updateTime,
        applicationCategories,
        customAttributes,
        softwareType,
        userAndReferentCountByOrganization,
        similarSoftwares,
        keywords,
        programmingLanguages,
        referencePublications,
        authors
    } = apiSoftware;

    assert<
        Equals<
            ApiTypes.Software["customAttributes"],
            State.Software.Internal["customAttributes"]
        >
    >();

    const { resolveLocalizedString } = createResolveLocalizedString({
        currentLanguage: "fr",
        fallbackLanguage: "en"
    });

    return {
        logoUrl,
        softwareName,
        softwareDescription,
        latestVersion: {
            semVer: latestVersion?.semVer ?? "",
            publicationTime: latestVersion?.publicationTime
        },
        referentCount: Object.values(userAndReferentCountByOrganization)
            .map(({ referentCount }) => referentCount)
            .reduce((prev, curr) => prev + curr, 0),
        userCount: Object.values(userAndReferentCountByOrganization)
            .map(({ userCount }) => userCount)
            .reduce((prev, curr) => prev + curr, 0),
        addedTime,
        updateTime,
        applicationCategories,
        organizations: objectKeys(userAndReferentCountByOrganization),
        softwareType,
        customAttributes,
        search: (() => {
            const search =
                softwareName +
                " (" +
                [
                    ...keywords,
                    ...applicationCategories,
                    softwareDescription,
                    ...authors.map(author => author.name),
                    ...authors.map(author => {
                        if (author["@type"] === "Organization") {
                            return author.parentOrganizations?.map(orga => orga.name);
                        }

                        return author.affiliations?.map(orga => orga.name);
                    }),
                    ...similarSoftwares
                        .map(similarSoftware =>
                            similarSoftware.registered
                                ? similarSoftware.softwareName
                                : resolveLocalizedString(similarSoftware.label)
                        )
                        .map(name =>
                            name === "VSCodium"
                                ? ["vscode", "tVisual Studio Code", "VSCodium"]
                                : name
                        )
                        .flat()
                ]
                    .filter(exclude(undefined))
                    .join(", ") +
                ")";

            return search;
        })(),
        userDeclaration,
        programmingLanguages,
        referencePublications
    };
}

function internalSoftwareToExternalSoftware(params: {
    internalSoftware: State.Software.Internal;
    positions: Set<number> | undefined;
}): State.Software.External {
    const { internalSoftware, positions } = params;

    const {
        logoUrl,
        softwareName,
        softwareDescription,
        latestVersion,
        referentCount,
        userCount,
        addedTime,
        updateTime,
        applicationCategories,
        organizations,
        search,
        softwareType,
        userDeclaration,
        programmingLanguages,
        referencePublications,
        customAttributes,
        ...rest
    } = internalSoftware;

    assert<Equals<typeof rest, {}>>();

    return {
        logoUrl,
        softwareName,
        softwareDescription,
        latestVersion,
        referentCount,
        userCount,
        supportedPlatforms: {
            hasDesktopApp:
                softwareType.type === "desktop/mobile" &&
                (softwareType.os.windows || softwareType.os.linux || softwareType.os.mac),
            isAvailableAsMobileApp:
                softwareType.type === "desktop/mobile" &&
                (softwareType.os.android || softwareType.os.ios)
        },
        searchHighlight:
            positions === undefined
                ? undefined
                : {
                      searchChars: search.normalize().split(""),
                      highlightedIndexes: Array.from(positions)
                  },
        userDeclaration,
        programmingLanguages,
        applicationCategories,
        referencePublications,
        customAttributes
    };
}

type SoftwareRef =
    | {
          type: "externalId";
          sourceSlug: string;
          externalId: string;
      }
    | {
          type: "name";
          softwareName: string;
      };

export function apiSoftwareToExternalCatalogSoftware(params: {
    apiSoftwares: ApiTypes.Software[];
    softwareRef: SoftwareRef;
}): State.Software.External | undefined {
    const { apiSoftwares, softwareRef } = params;

    const internalSoftware = apiSoftwareToInternalSoftware({
        apiSoftwares,
        softwareRef,
        userDeclaration: undefined
    });

    if (internalSoftware === undefined) {
        return undefined;
    }

    return internalSoftwareToExternalSoftware({
        internalSoftware,
        positions: undefined
    });
}
