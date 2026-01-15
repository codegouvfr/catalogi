// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect } from "react";
import { routes } from "ui/routes";
import { type PageRoute } from "./route";
import { id } from "tsafe/id";
import { LoadingFallback } from "ui/shared/LoadingFallback";
import { typeGuard } from "tsafe/typeGuard";
import { languages, evtLang } from "ui/i18n";
import { type Language } from "api";
import { useCoreState } from "core";
import { assert } from "tsafe/assert";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function Redirect(props: Props) {
    const { className, route } = props;

    const softwareNameBySillId = useCoreState("redirect", "softwareNameBySillId");

    const sillIdBySoftwareName = Object.fromEntries(
        Object.entries(softwareNameBySillId).map(([id, name]) => [name, parseInt(id)])
    );

    useEffect(() => {
        switch (route.name) {
            case "ogSill":
                {
                    {
                        const { lang } = route.params;

                        if (
                            typeGuard<Language>(
                                lang,
                                id<readonly string[]>(languages).includes(lang)
                            )
                        ) {
                            evtLang.state = lang;
                        }
                    }
                    const { id: softwareId } = route.params;

                    if (softwareId === undefined) {
                        routes.softwareCatalog().replace();
                        return;
                    }

                    const softwareName = softwareNameBySillId[softwareId];

                    if (softwareName === undefined) {
                        routes.page404().replace();
                        return;
                    }

                    routes.softwareDetails({ id: softwareId }).replace();
                }
                break;
            case "onyxiaUiSillCatalog":
                {
                    const { q } = route.params;

                    const { search } = parseQuery(q);

                    routes.softwareCatalog({ search: search || undefined }).replace();
                }
                break;
            case "onyxiaUiSillCard":
                {
                    const { name } = route.params;

                    const softwareId = sillIdBySoftwareName[name];

                    if (softwareId === undefined) {
                        routes.page404().replace();
                        return;
                    }

                    routes.softwareDetails({ id: softwareId }).replace();
                }
                break;
            case "softwareDetailsByName":
                {
                    const { name } = route.params;

                    const softwareId = sillIdBySoftwareName[name];

                    if (softwareId === undefined) {
                        routes.page404().replace();
                        return;
                    }

                    routes.softwareDetails({ id: softwareId }).replace();
                }
                break;
        }
    }, []);

    return <LoadingFallback className={className} />;
}

type Query = {
    search: string;
    tags: string[];
};

function parseQuery(queryString: string): Query {
    if (!queryString.startsWith("{")) {
        return {
            search: queryString,
            tags: []
        };
    }

    return JSON.parse(queryString);
}
