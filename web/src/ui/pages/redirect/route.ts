// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import {
    createGroup,
    defineRoute,
    createRouter,
    param,
    type Route,
    noMatch
} from "type-route";
import { z } from "zod";
import { appPath } from "urls";

export const routeDefs = {
    ogSill: defineRoute(
        {
            lang: param.path.string,
            id: param.query.optional.number
        },
        ({ lang }) => appPath + `/${lang}/software`
    ),
    onyxiaUiSillCatalog: defineRoute(
        {
            q: param.query.optional.string.default("")
        },
        () => appPath + `/software`
    ),
    onyxiaUiSillCard: defineRoute(
        {
            /** Can be the software name (string) or it's `${id}` (for legacy route compat)  */
            name: param.query.string
        },
        () => appPath + `/software`
    ),
    softwareDetailsByName: defineRoute(
        {
            name: param.query.string
        },
        () => appPath + `/detail`
    ),
    softwareUsersAndReferentsByName: defineRoute(
        {
            name: param.query.string
        },
        () => appPath + `/users-and-referents`
    ),
    declarationFormByName: defineRoute(
        {
            name: param.query.string,
            declarationType: param.query.optional.ofType({
                parse: raw => {
                    const schema = z.union([z.literal("user"), z.literal("referent")]);

                    try {
                        return schema.parse(raw);
                    } catch {
                        return noMatch;
                    }
                },
                stringify: value => value
            })
        },
        () => appPath + `/declaration`
    ),
    softwareUpdateFormByName: defineRoute(
        {
            name: param.query.string
        },
        () => appPath + `/update`
    ),
    instanceCreationFormBySoftwareName: defineRoute(
        {
            softwareName: param.query.string
        },
        () => appPath + `/add-instance`
    )
};

export const routeGroup = createGroup(Object.values(createRouter(routeDefs).routes));

export type PageRoute = Route<typeof routeGroup>;

export const getDoRequireUserLoggedIn: (route: PageRoute) => boolean = () => false;
