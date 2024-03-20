import {
    createGroup,
    defineRoute,
    createRouter,
    param,
    noMatch,
    type Route
} from "type-route";
import { z } from "zod";
import { assert, type Equals } from "tsafe/assert";
import { appPath } from "urls";

export const routeDefs = {
    "softwareDetails": defineRoute(
        {
            "name": param.query.string,
            "autoOpenRemoveRoleModal": param.query.optional.boolean.default(false),
            "tab": param.query.optional.ofType({
                "parse": raw => {
                    const schema = z.union([
                        z.literal("instances"),
                        z.literal("alternatives")
                    ]);

                    assert<
                        Equals<
                            ReturnType<(typeof schema)["parse"]>,
                            "instances" | "alternatives"
                        >
                    >();

                    try {
                        return schema.parse(raw);
                    } catch {
                        return noMatch;
                    }
                },
                "stringify": value => value
            })
        },
        () => appPath + `/detail`
    )
};

export const routeGroup = createGroup(Object.values(createRouter(routeDefs).routes));

export type PageRoute = Route<typeof routeGroup>;

export const getDoRequireUserLoggedIn: (route: PageRoute) => boolean = () => false;
