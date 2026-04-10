// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createRouter } from "type-route";
import { createTypeRouteMock } from "ui/tools/typeRouteMock";
import { isStorybook } from "ui/tools/isStorybook";
import { routeDefs } from "ui/pages";

const { RouteProvider, useRoute, routes: realRoutes, session } = createRouter(routeDefs);

export { RouteProvider, useRoute, session };

export const { getPreviousRouteName } = (() => {
    let previousRouteName: keyof typeof realRoutes | false = false;
    let currentRouteName: keyof typeof realRoutes | false =
        session.getInitialRoute().name;
    let previousUrl: string | null = null;

    function dispatchRouteChange() {
        const newUrl = window.location.href;
        // public contract — VITE_HEAD listeners in deployment repos depend on this shape
        window.dispatchEvent(
            new CustomEvent("routechange", {
                detail: { url: newUrl, referrer: previousUrl }
            })
        );
        previousUrl = newUrl;
    }

    // Single source of truth for all pageviews (initial + SPA navigations).
    session.listen(nextRoute => {
        previousRouteName = currentRouteName;
        currentRouteName = nextRoute.name;
        dispatchRouteChange();
    });

    dispatchRouteChange();

    function getPreviousRouteName() {
        return previousRouteName;
    }

    return { getPreviousRouteName };
})();

const { createMockRouteFactory, routesProxy } = createTypeRouteMock({
    routes: realRoutes
});

export const routes = isStorybook ? routesProxy : realRoutes;

export { createMockRouteFactory };
