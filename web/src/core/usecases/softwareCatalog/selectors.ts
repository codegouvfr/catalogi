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
import type { ApiTypes } from "api";
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

const getComputeds = memoize(
    (software: State.Software) => {
        const { userAndReferentCountByOrganization } = software;

        return {
            userCount: Object.values(userAndReferentCountByOrganization)
                .map(({ userCount }) => userCount)
                .reduce((prev, curr) => prev + curr, 0),
            referentCount: Object.values(userAndReferentCountByOrganization)
                .map(({ referentCount }) => referentCount)
                .reduce((prev, curr) => prev + curr, 0),
            organizations: objectKeys(userAndReferentCountByOrganization)
        };
    },
    { max: 1000 }
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
                            return createCompareFn<State.Software>({
                                getWeight: software => software.addedTime,
                                order: "descending"
                            });
                        case "update_time":
                            return createCompareFn<State.Software>({
                                getWeight: software => software.updateTime,
                                order: "descending"
                            });
                        case "latest_version_publication_date":
                            return createCompareFn<State.Software>({
                                getWeight: software =>
                                    software.latestVersion?.publicationTime ?? 0,
                                order: "descending",
                                tieBreaker: createCompareFn({
                                    getWeight: software => software.updateTime,
                                    order: "descending"
                                })
                            });
                        case "referent_count":
                            return createCompareFn<State.Software>({
                                getWeight: software =>
                                    getComputeds(software).referentCount,
                                order: "descending"
                            });
                        case "referent_count_ASC":
                            return createCompareFn<State.Software>({
                                getWeight: software =>
                                    getComputeds(software).referentCount,
                                order: "ascending"
                            });
                        case "user_count":
                            return createCompareFn<State.Software>({
                                getWeight: software => getComputeds(software).userCount,
                                order: "descending"
                            });
                        case "user_count_ASC":
                            return createCompareFn<State.Software>({
                                getWeight: software => getComputeds(software).userCount,
                                order: "ascending"
                            });
                        case "my_software":
                            return createCompareFn<State.Software>({
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

        return tmpSoftwares.map(software => ({
            ...software,
            searchHighlight: (() => {
                if (
                    positionsBySoftwareName === undefined ||
                    software.search === undefined
                ) {
                    return undefined;
                }
                const positions = positionsBySoftwareName.get(software.softwareName);

                assert(positions !== undefined);

                return {
                    searchChars: software.search.normalize().split(""),
                    highlightedIndexes: Array.from(positions)
                };
            })()
        }));
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
                        .map(software => getComputeds(software).organizations)
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

        tmpSoftwares.forEach(software =>
            getComputeds(software).organizations.forEach(
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

const softwareList = (rootState: RootState) => rootState[name].softwareList;

const main = createSelector(
    softwares,
    softwareList,
    sortOptions,
    organizationOptions,
    categoryOptions,
    environmentOptions,
    programmingLanguageOptions,
    attributeNameFilterOptions,
    (
        softwares,
        softwareList,
        sortOptions,
        organizationOptions,
        categoryOptions,
        environmentOptions,
        programmingLanguageOptions,
        attributeNameFilterOptions
    ) => ({
        softwares,
        softwareList,
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
        (softwares: State.Software[]) =>
            Object.fromEntries(softwares.map(({ softwareName }, i) => [softwareName, i])),
        { max: 1 }
    );

    function filterAndSortBySearch(params: {
        searchResults: {
            softwareName: string;
            positions: number[];
        }[];
        softwares: State.Software[];
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
    softwares: State.Software[];
    organization: string;
}) {
    const { softwares, organization } = params;

    return softwares.filter(software =>
        getComputeds(software).organizations.includes(organization)
    );
}

function filterByCategory(params: { softwares: State.Software[]; category: string }) {
    const { softwares, category } = params;

    return softwares.filter(({ applicationCategories }) =>
        applicationCategories.includes(category)
    );
}

function filterByProgrammingLanguage(params: {
    softwares: State.Software[];
    programmingLanguage: string;
}) {
    const { softwares, programmingLanguage } = params;
    return softwares.filter(({ programmingLanguages }) =>
        programmingLanguages.includes(programmingLanguage)
    );
}

function filterByEnvironnement(params: {
    softwares: State.Software[];
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
    softwares: State.Software[];
    attributeName: State.AttributeName;
}) {
    const { softwares, attributeName } = params;

    return softwares.filter(
        software =>
            ({
                ...software.customAttributes,
                ...software.customAttributes
            })[attributeName]
    );
}

export function softwareInListToExternalCatalogSoftware(params: {
    softwareList: ApiTypes.SoftwareInList[];
    softwareName: string;
}): State.Software | undefined {
    const { softwareList, softwareName: targetName } = params;

    return softwareList.find(s => s.softwareName === targetName) as
        | State.Software
        | undefined;
}
