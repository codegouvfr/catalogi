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
    "declarationForm": defineRoute(
        {
            "name": param.query.string,
            "declarationType": param.query.optional.ofType({
                "parse": raw => {
                    const schema = z.union([z.literal("user"), z.literal("referent")]);

                    try {
                        return schema.parse(raw);
                    } catch {
                        return noMatch;
                    }
                },
                "stringify": value => value
            })
        },
        () => appPath + `/declaration`
    )
};

export const routeGroup = createGroup(Object.values(createRouter(routeDefs).routes));

export type PageRoute = Route<typeof routeGroup>;

export const getDoRequireUserLoggedIn: (route: PageRoute) => boolean = () => true;
