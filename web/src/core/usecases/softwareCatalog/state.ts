// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import {
    createUsecaseActions,
    createObjectThatThrowsIfAccessed
} from "redux-clean-architecture";
import type { ApiTypes } from "api";

type OmitFromExisting<T, K extends keyof T> = Omit<T, K>;

export const name = "softwareCatalog" as const;

export type SupportedPlatforms = {
    hasDesktopApp?: boolean;
    isAvailableAsMobileApp?: boolean;
};

export type State = {
    softwares: State.Software.Internal[];
    softwareList: ApiTypes.SoftwareInList[];
    search: string;
    searchResults:
        | {
              softwareName: string;
              positions: number[];
          }[]
        | undefined;
    sort: State.Sort;
    /** Used in organizations: E.g: DINUM */
    organization: string | undefined;
    /** E.g: JavaScript */
    category: string | undefined;
    programmingLanguage: string | undefined;
    environment: State.Environment | undefined;
    filteredAttributeNames: State.AttributeName[];
    sortBackup: State.Sort;
    /** Undefined if user isn't logged in */
    userEmail: string | undefined;
};

export namespace State {
    export type Sort =
        | "added_time"
        | "update_time"
        | "latest_version_publication_date"
        | "user_count"
        | "referent_count"
        | "user_count_ASC"
        | "referent_count_ASC"
        | "best_match"
        | "my_software";

    export type Environment =
        | "linux"
        | "windows"
        | "mac"
        | "browser"
        | "stack"
        | "android"
        | "ios";

    export type AttributeName = string;

    export type Software = ApiTypes.SoftwareInList & {
        userDeclaration?: {
            isUser: boolean;
            isReferent: boolean;
        };
        searchHighlight?: {
            searchChars: string[];
            highlightedIndexes: number[];
        };
        /** String used for search indexing (concatenation of name, description, keywords, etc.) */
        search?: string;
    };

    export namespace Software {
        export type Internal = Software;
        export type External = Software;
    }

    export type referentCount = number;
}

export type UpdateFilterParams<
    K extends UpdateFilterParams.Key = UpdateFilterParams.Key
> = {
    key: K;
    value: State[K];
};

export namespace UpdateFilterParams {
    export type Key = keyof Omit<
        State,
        "softwares" | "sortBackup" | "userEmail" | "searchResult"
    >;
}

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: createObjectThatThrowsIfAccessed<State>({
        debugMessage: "Software catalog usecase not initialized"
    }),
    //"initialState": {} as any as State,
    reducers: {
        initialized: (
            _state,
            {
                payload
            }: {
                payload: {
                    softwares: State.Software.Internal[];
                    softwareList: ApiTypes.SoftwareInList[];
                    defaultSort: State.Sort;
                    userEmail: string | undefined;
                };
            }
        ) => {
            const { softwares, softwareList, defaultSort, userEmail } = payload;

            return {
                softwares,
                softwareList,
                search: "",
                searchResults: undefined,
                sort: defaultSort,
                sortBackup: defaultSort,
                organization: undefined,
                category: undefined,
                programmingLanguage: undefined,
                environment: undefined,
                filteredAttributeNames: [],
                referentCount: undefined,
                isRemovingUserOrReferent: false,
                userEmail
            };
        },
        filterUpdated: (state, { payload }: { payload: UpdateFilterParams }) => {
            const { key, value } = payload;

            // @ts-expect-error
            state[key] = value;
        },
        searchResultUpdated: (
            state,
            {
                payload
            }: {
                payload: {
                    searchResults:
                        | {
                              softwareName: string;
                              positions: number[];
                          }[]
                        | undefined;
                };
            }
        ) => {
            const { searchResults } = payload;

            state.searchResults = searchResults;
        },
        // NOTE: This is first and foremost an action for evtAction
        notifyRequestChangeSort: (
            state,
            { payload }: { payload: { sort: State.Sort } }
        ) => {
            const { sort } = payload;

            if (sort === "best_match" && state.sort !== "best_match") {
                state.sortBackup = state.sort;
            }
        },
        filterReset: state => {
            state.organization = undefined;
            state.category = undefined;
            state.programmingLanguage = undefined;
            state.environment = undefined;
            state.filteredAttributeNames = [];
        }
    }
});
