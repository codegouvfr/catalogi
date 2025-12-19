// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import memoize from "memoizee";
import { assert } from "tsafe/assert";
import { exclude } from "tsafe/exclude";
import FlexSearch from "flexsearch";
import type { ApiTypes } from "api";
import { createResolveLocalizedString } from "i18nifty";
import { UpdateFilterParams } from "./state";
import { name, actions, type State } from "./state";

export const thunks = {
    updateFilter:
        <K extends UpdateFilterParams.Key>(params: UpdateFilterParams<K>) =>
        async (...args) => {
            const [dispatch, getState] = args;

            if (params.key === "search") {
                const { search: currentSearch, sortBackup } = getState()[name];

                const newSearch = params.value;

                if (currentSearch === "" && newSearch !== "") {
                    dispatch(
                        actions.notifyRequestChangeSort({
                            sort: "best_match"
                        })
                    );
                }

                if (newSearch === "" && currentSearch !== "") {
                    dispatch(
                        actions.notifyRequestChangeSort({
                            sort: sortBackup
                        })
                    );
                }
            }

            dispatch(actions.filterUpdated(params));

            update_search_results: {
                if (params.key !== "search") {
                    break update_search_results;
                }

                const newSearch = params.value;

                assert(typeof newSearch === "string");

                if (newSearch === "") {
                    dispatch(
                        actions.searchResultUpdated({
                            searchResults: undefined
                        })
                    );

                    break update_search_results;
                }

                const { softwares } = getState()[name];

                const searchResults = await filterBySearchMemoized(softwares, newSearch);

                dispatch(
                    actions.searchResultUpdated({
                        searchResults
                    })
                );
            }
        },
    getDefaultSort:
        () =>
        (...args) => {
            const [, getState] = args;

            return getDefaultSort({
                userEmail: getState()[name].userEmail
            });
        }
} satisfies Thunks;

export const protectedThunks = {
    initialize:
        () =>
        async (...args) => {
            const [dispatch, getState, { sillApi, evtAction }] = args;

            const state = getState();
            const { currentUser } = state.userAuthentication;

            const initialize = async () => {
                const [softwareList, { email: userEmail }] = await Promise.all([
                    sillApi.getSoftwareList(),
                    currentUser ?? { email: undefined }
                ] as const);

                const { users } = currentUser
                    ? await sillApi.getUsers()
                    : { users: undefined };

                const softwares = softwareList.map(software => {
                    const userDeclaration =
                        users === undefined
                            ? undefined
                            : (() => {
                                  const agent = users.find(
                                      agent => agent.email === userEmail
                                  );

                                  if (agent === undefined) {
                                      return undefined;
                                  }

                                  return {
                                      isReferent:
                                          agent.declarations.find(
                                              declaration =>
                                                  declaration.declarationType ===
                                                      "referent" &&
                                                  declaration.softwareName ===
                                                      software.softwareName
                                          ) !== undefined,
                                      isUser:
                                          agent.declarations.find(
                                              declaration =>
                                                  declaration.declarationType ===
                                                      "user" &&
                                                  declaration.softwareName ===
                                                      software.softwareName
                                          ) !== undefined
                                  };
                              })();

                    return softwareInListToInternalSoftware({
                        software,
                        userDeclaration
                    });
                });

                dispatch(
                    actions.initialized({
                        softwares,
                        userEmail,
                        defaultSort: getDefaultSort({ userEmail })
                    })
                );
            };

            await initialize();

            evtAction.attach(
                action =>
                    (action.usecaseName === "softwareForm" &&
                        action.actionName === "formSubmitted") ||
                    (action.usecaseName === "declarationForm" &&
                        action.actionName === "triggerRedirect" &&
                        action.payload.isFormSubmitted) ||
                    (action.usecaseName === "declarationRemoval" &&
                        action.actionName === "userOrReferentRemoved") ||
                    (action.usecaseName === "softwareDetails" &&
                        action.actionName === "unreferencingCompleted"),
                () => initialize()
            );
        }
} satisfies Thunks;

function getDefaultSort(params: { userEmail: string | undefined }): State.Sort {
    const { userEmail } = params;

    return userEmail === undefined ? "referent_count" : "my_software";
}

function softwareInListToInternalSoftware(params: {
    software: ApiTypes.SoftwareInList;
    userDeclaration:
        | {
              isUser: boolean;
              isReferent: boolean;
          }
        | undefined;
}): State.Software {
    const { software, userDeclaration } = params;

    const {
        softwareName,
        softwareDescription,
        applicationCategories,
        similarSoftwares,
        keywords,
        authors
    } = software;

    const { resolveLocalizedString } = createResolveLocalizedString({
        currentLanguage: "fr",
        fallbackLanguage: "en"
    });

    return {
        ...software,
        userDeclaration,
        search: (() => {
            const search =
                softwareName +
                " (" +
                [
                    ...keywords,
                    ...applicationCategories,
                    softwareDescription,
                    ...authors.map(author => author.name),
                    ...similarSoftwares
                        .map(
                            similarSoftware =>
                                similarSoftware.softwareName ??
                                (similarSoftware.label
                                    ? resolveLocalizedString(similarSoftware.label)
                                    : undefined)
                        )
                        .map(name =>
                            name === "VSCodium"
                                ? ["vscode", "Visual Studio Code", "VSCodium"]
                                : name
                        )
                        .flat()
                ]
                    .filter(exclude(undefined))
                    .join(", ") +
                ")";

            return search;
        })()
    };
}

const { filterBySearchMemoized } = (() => {
    const getFlexSearch = memoize(
        (softwares: State.Software[]) => {
            const index = new FlexSearch.Document({
                document: {
                    id: "softwareName",
                    field: ["search"]
                },
                cache: 100,
                tokenize: "full",
                encoder: "Default",
                context: {
                    resolution: 9,
                    depth: 2,
                    bidirectional: true
                }
            });

            softwares.forEach(
                ({
                    logoUrl,
                    latestVersion,
                    userDeclaration,
                    customAttributes,
                    similarSoftwares,
                    ...software
                }) => index.add(software)
            );

            return index;
        },
        { max: 1 }
    );

    function highlightMatches(params: { text: string; search: string }) {
        const { text, search } = params;

        const escapedSearch = search.trim().replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
        const regexp = RegExp("(" + escapedSearch.replaceAll(" ", "|") + ")", "ig");
        let result;
        const highlights: number[] = [];

        if (text) {
            while ((result = regexp.exec(text)) !== null) {
                for (let i = result.index; i < regexp.lastIndex; i++) {
                    highlights.push(i);
                }
            }
        }

        return highlights;
    }

    const filterBySearchMemoized = memoize(
        async (
            softwares: State.Software[],
            search: string
        ): Promise<
            {
                softwareName: string;
                positions: number[];
            }[]
        > => {
            const index = getFlexSearch(softwares);

            const searchResult = await index.searchAsync(search, {
                suggest: true,
                enrich: true
            });

            if (searchResult.length === 0) {
                return [];
            }

            const [{ result: softwareNames }] = searchResult;

            return softwareNames.map(
                softwareName => (
                    assert(typeof softwareName === "string"),
                    {
                        softwareName,
                        positions: highlightMatches({
                            text: (() => {
                                const software = softwares.find(
                                    software => software.softwareName === softwareName
                                );

                                assert(software !== undefined);

                                return software.search ?? "";
                            })(),
                            search
                        })
                    }
                )
            );
        },
        { max: 1, promise: true }
    );

    return { filterBySearchMemoized };
})();
