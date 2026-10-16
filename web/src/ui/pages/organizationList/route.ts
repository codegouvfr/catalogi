// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createGroup, defineRoute, createRouter, type Route, param } from "type-route";
import { appPath } from "urls";

export const routeDefs = {
    organizationList: defineRoute(
        {
            search: param.query.optional.string.default("")
        },
        () => appPath + "/organization-list"
    )
};

export const routeGroup = createGroup(Object.values(createRouter(routeDefs).routes));

export type PageRoute = Route<typeof routeGroup>;

export const getDoRequireUserLoggedIn: (route: PageRoute) => boolean = () => false;
