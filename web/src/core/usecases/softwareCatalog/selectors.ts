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
import { getDetailsSubsectionKey, type ApiTypes } from "api";
import { LocalizedString } from "../../../ui/i18n";
import { name, type State, type Software } from "./state";
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
    (software: Software) => {
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

        let positionsByName: Map<string, Set<number>> | undefined = undefined;

        if (searchResults !== undefined) {
            const filterResults = filterAndSortBySearch({
                searchResults,
                softwares: tmpSoftwares
            });

            tmpSoftwares = filterResults.map(({ software, positions }) => {
                (positionsByName ??= new Map()).set(software.name, positions);
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

        tmpSoftwares = filterByAttributeNames({
            softwares: tmpSoftwares,
            attributeNames: filteredAttributeNames
        });

        if (sort !== "best_match") {
            tmpSoftwares = [...tmpSoftwares].sort(
                (() => {
                    switch (sort) {
                        case "added_time":
                            return createCompareFn<Software>({
                                getWeight: software => software.addedTime,
                                order: "descending"
                            });
                        case "update_time":
                            return createCompareFn<Software>({
                                getWeight: software => software.updateTime,
                                order: "descending"
                            });
                        case "latest_version_publication_date":
                            return createCompareFn<Software>({
                                getWeight: software =>
                                    software.latestVersion?.releaseDate ?? "",
                                order: "descending",
                                tieBreaker: createCompareFn({
                                    getWeight: software => software.updateTime,
                                    order: "descending"
                                })
                            });
                        case "referent_count":
                            return createCompareFn<Software>({
                                getWeight: software =>
                                    getComputeds(software).referentCount,
                                order: "descending"
                            });
                        case "referent_count_ASC":
                            return createCompareFn<Software>({
                                getWeight: software =>
                                    getComputeds(software).referentCount,
                                order: "ascending"
                            });
                        case "user_count":
                            return createCompareFn<Software>({
                                getWeight: software => getComputeds(software).userCount,
                                order: "descending"
                            });
                        case "user_count_ASC":
                            return createCompareFn<Software>({
                                getWeight: software => getComputeds(software).userCount,
                                order: "ascending"
                            });
                        case "my_software":
                            return createCompareFn<Software>({
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
                if (positionsByName === undefined || software.search === undefined) {
                    return undefined;
                }
                const positions = positionsByName.get(software.name);

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

        tmpSoftwares = filterByAttributeNames({
            softwares: tmpSoftwares,
            attributeNames: filteredAttributeNames
        });

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

        tmpSoftwares = filterByAttributeNames({
            softwares: tmpSoftwares,
            attributeNames: filteredAttributeNames
        });

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
                        .map(
                            ({
                                runtimePlatforms,
                                operatingSystems
                            }): State.Environment[] => {
                                const envs: State.Environment[] = [];
                                if (runtimePlatforms.includes("cloud"))
                                    envs.push("browser");
                                if (runtimePlatforms.length === 0) envs.push("stack");
                                if (runtimePlatforms.includes("desktop")) {
                                    (objectKeys(operatingSystems) as State.Environment[])
                                        .filter(
                                            os =>
                                                operatingSystems[
                                                    os as keyof typeof operatingSystems
                                                ]
                                        )
                                        .forEach(os => envs.push(os));
                                }
                                return envs;
                            }
                        )
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

        tmpSoftwares = filterByAttributeNames({
            softwares: tmpSoftwares,
            attributeNames: filteredAttributeNames
        });

        tmpSoftwares.forEach(({ runtimePlatforms, operatingSystems }) => {
            if (runtimePlatforms.includes("cloud")) {
                softwareCountInCurrentFilterByEnvironment.set(
                    "browser",
                    softwareCountInCurrentFilterByEnvironment.get("browser")! + 1
                );
            }
            if (runtimePlatforms.length === 0) {
                softwareCountInCurrentFilterByEnvironment.set(
                    "stack",
                    softwareCountInCurrentFilterByEnvironment.get("stack")! + 1
                );
            }
            if (runtimePlatforms.includes("desktop")) {
                (objectKeys(operatingSystems) as State.Environment[])
                    .filter(os => operatingSystems[os as keyof typeof operatingSystems])
                    .forEach(os =>
                        softwareCountInCurrentFilterByEnvironment.set(
                            os,
                            softwareCountInCurrentFilterByEnvironment.get(os)! + 1
                        )
                    );
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
        option?: ApiTypes.AttributeOption;
        subsection?: { key: string; title: LocalizedString };
        softwareCount: number;
    }[] => {
        const definitions = ui?.attributeDefinitions ?? [];
        const enumNames = new Set(
            definitions.filter(({ kind }) => kind === "enum").map(({ name }) => name)
        );
        const getFilterKeys = (customAttributes: Software["customAttributes"]) =>
            objectKeys(customAttributes ?? {})
                .filter(attributeName => customAttributes?.[attributeName])
                .map(attributeName =>
                    enumNames.has(attributeName)
                        ? `${attributeName}:${customAttributes?.[attributeName]}`
                        : attributeName
                );

        const softwareCountInCurrentFilterByAttributeName = new Map(
            [
                ...Array.from(
                    new Set(
                        internalSoftwares
                            .map(({ customAttributes }) =>
                                getFilterKeys(customAttributes)
                            )
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

        // An attribute's own filter is left out of its counts, so other values stay selectable
        const attributeFilters = groupAttributeFilters(filteredAttributeNames);

        tmpSoftwares.forEach(software => {
            const { customAttributes, operatingSystems } = software;
            const matchesOtherAttributes = (attributeName: State.AttributeName) =>
                matchesAttributeFilters({
                    software,
                    attributeFilters,
                    ignoredAttribute: getFilteredAttribute(attributeName)
                });

            if (customAttributes) {
                getFilterKeys(customAttributes).forEach(attributeName => {
                    if (!matchesOtherAttributes(attributeName)) return;
                    const currentCount =
                        softwareCountInCurrentFilterByAttributeName.get(attributeName);

                    if (currentCount !== undefined) {
                        softwareCountInCurrentFilterByAttributeName.set(
                            attributeName,
                            currentCount + 1
                        );
                    }
                });
            }

            if (
                (operatingSystems.windows ||
                    operatingSystems.linux ||
                    operatingSystems.mac) &&
                matchesOtherAttributes("isInstallableOnUserComputer")
            ) {
                const currentCount = softwareCountInCurrentFilterByAttributeName.get(
                    "isInstallableOnUserComputer"
                );

                assert(currentCount !== undefined);

                softwareCountInCurrentFilterByAttributeName.set(
                    "isInstallableOnUserComputer",
                    currentCount + 1
                );
            }
        });

        const subsectionKeys = definitions.map(({ detailsSection, detailsSubsection }) =>
            detailsSubsection === undefined
                ? undefined
                : getDetailsSubsectionKey(detailsSection, detailsSubsection)
        );

        const describeFilterKey = (filterKey: string) => {
            const [attributeName, value] = filterKey.split(":");
            const rank = definitions.findIndex(({ name }) => name === attributeName);
            const definition = definitions[rank];
            if (
                definition === undefined ||
                !definition.enableFiltering ||
                definition.kind === "text"
            ) {
                return undefined;
            }
            // Attributes without subsection first, then subsections in order of their first attribute
            const subsectionRank =
                subsectionKeys[rank] === undefined
                    ? -1
                    : subsectionKeys.indexOf(subsectionKeys[rank]);
            const subsectionKey = subsectionKeys[rank];
            const described = {
                attributeLabel: definition.label,
                subsection:
                    subsectionKey === undefined
                        ? undefined
                        : { key: subsectionKey, title: definition.detailsSubsection! }
            };
            if (definition.kind !== "enum") {
                return { rank: [subsectionRank, rank, 0], ...described };
            }
            const optionRank =
                definition.options?.findIndex(option => option.value === value) ?? -1;
            const option = definition.options?.[optionRank];
            if (option === undefined) return undefined;
            return { rank: [subsectionRank, rank, optionRank], ...described, option };
        };

        return Array.from(softwareCountInCurrentFilterByAttributeName.entries())
            .flatMap(([attributeName, softwareCount]) => {
                const description = describeFilterKey(attributeName);
                return description === undefined
                    ? []
                    : [{ attributeName, ...description, softwareCount }];
            })
            .sort(
                (a, b) =>
                    a.rank[0] - b.rank[0] ||
                    a.rank[1] - b.rank[1] ||
                    a.rank[2] - b.rank[2]
            )
            .map(({ rank: _rank, ...filterOption }) => filterOption);
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

        tmpSoftwares = filterByAttributeNames({
            softwares: tmpSoftwares,
            attributeNames: filteredAttributeNames
        });

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
    internalSoftwares,
    sortOptions,
    organizationOptions,
    categoryOptions,
    environmentOptions,
    programmingLanguageOptions,
    attributeNameFilterOptions,
    (
        softwares,
        allSoftwares,
        sortOptions,
        organizationOptions,
        categoryOptions,
        environmentOptions,
        programmingLanguageOptions,
        attributeNameFilterOptions
    ) => ({
        softwares,
        allSoftwares,
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
    const getIndexByName = memoize(
        (softwares: Software[]) =>
            Object.fromEntries(softwares.map(({ name }, i) => [name, i])),
        { max: 1 }
    );

    function filterAndSortBySearch(params: {
        searchResults: {
            name: string;
            positions: number[];
        }[];
        softwares: Software[];
    }) {
        const { searchResults, softwares } = params;

        const indexByName = getIndexByName(softwares);

        return searchResults
            .map(({ name }) => name)
            .map((name, i) => ({
                software: softwares[indexByName[name]],
                positions: new Set(searchResults[i].positions)
            }));
    }

    return { filterAndSortBySearch };
})();

function filterByOrganization(params: { softwares: Software[]; organization: string }) {
    const { softwares, organization } = params;

    return softwares.filter(software =>
        getComputeds(software).organizations.includes(organization)
    );
}

function filterByCategory(params: { softwares: Software[]; category: string }) {
    const { softwares, category } = params;

    return softwares.filter(({ applicationCategories }) =>
        applicationCategories.includes(category)
    );
}

function filterByProgrammingLanguage(params: {
    softwares: Software[];
    programmingLanguage: string;
}) {
    const { softwares, programmingLanguage } = params;
    return softwares.filter(({ programmingLanguages }) =>
        programmingLanguages.includes(programmingLanguage)
    );
}

function filterByEnvironnement(params: {
    softwares: Software[];
    environment: State.Environment;
}) {
    const { softwares, environment } = params;

    // eslint-disable-next-line array-callback-return
    return softwares.filter(({ runtimePlatforms, operatingSystems }) => {
        switch (environment) {
            case "linux":
            case "mac":
            case "windows":
            case "android":
            case "ios":
                return operatingSystems[environment] === true;
            case "browser":
                return runtimePlatforms.includes("cloud");
            case "stack":
                return runtimePlatforms.length === 0;
        }
    });
}

/** Filter keys are `name:value` for an enum value, the bare attribute name otherwise */
const getFilteredAttribute = (attributeName: State.AttributeName) =>
    attributeName.split(":")[0];

const groupAttributeFilters = (attributeNames: State.AttributeName[]) => {
    const attributeFilters = new Map<string, State.AttributeName[]>();
    attributeNames.forEach(attributeName => {
        const attribute = getFilteredAttribute(attributeName);
        attributeFilters.set(attribute, [
            ...(attributeFilters.get(attribute) ?? []),
            attributeName
        ]);
    });
    return attributeFilters;
};

const matchesAttributeName = (software: Software, attributeName: State.AttributeName) => {
    if (attributeName === "isInstallableOnUserComputer") {
        return (
            software.operatingSystems.windows ||
            software.operatingSystems.linux ||
            software.operatingSystems.mac
        );
    }

    const [name, value] = attributeName.split(":");
    const attributeValue = (software.customAttributes as any)?.[name];

    return value === undefined ? Boolean(attributeValue) : attributeValue === value;
};

/** Values of one attribute are alternatives, every filtered attribute must match */
function matchesAttributeFilters(params: {
    software: Software;
    attributeFilters: Map<string, State.AttributeName[]>;
    ignoredAttribute?: string;
}) {
    const { software, attributeFilters, ignoredAttribute } = params;

    return [...attributeFilters].every(
        ([attribute, attributeNames]) =>
            attribute === ignoredAttribute ||
            attributeNames.some(attributeName =>
                matchesAttributeName(software, attributeName)
            )
    );
}

function filterByAttributeNames(params: {
    softwares: Software[];
    attributeNames: State.AttributeName[];
}) {
    const { softwares, attributeNames } = params;
    const attributeFilters = groupAttributeFilters(attributeNames);

    return softwares.filter(software =>
        matchesAttributeFilters({ software, attributeFilters })
    );
}
