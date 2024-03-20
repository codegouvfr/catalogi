import { createGroup, defineRoute, createRouter, param, type Route } from "type-route";
import { appPath } from "urls";

export const routeDefs = {
    "ogSill": defineRoute(
        {
            "lang": param.path.string,
            "id": param.query.optional.number
        },
        ({ lang }) => appPath + `/${lang}/software`
    ),
    "onyxiaUiSillCatalog": defineRoute(
        {
            "q": param.query.optional.string.default("")
        },
        () => appPath + `/software`
    ),
    "onyxiaUiSillCard": defineRoute(
        {
            /** Can be the software name (string) or it's `${id}` (for legacy route compat)  */
            "name": param.query.string
        },
        () => appPath + `/software`
    )
};

export const routeGroup = createGroup(Object.values(createRouter(routeDefs).routes));

export type PageRoute = Route<typeof routeGroup>;

export const getDoRequireUserLoggedIn: (route: PageRoute) => boolean = () => false;
