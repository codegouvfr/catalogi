// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, useTransition, useMemo } from "react";
import { createUseDebounce } from "powerhooks/useDebounce";
import { routes } from "ui/routes";
import { useCore, useCoreState } from "core";
import { SoftwareCatalogControlled } from "ui/pages/softwareCatalog/SoftwareCatalogControlled";
import { useConstCallback } from "powerhooks/useConstCallback";
import { type PageRoute } from "./route";
import { useEvt } from "evt/hooks";
import { type Param0 } from "tsafe";
import { useConst } from "powerhooks/useConst";
import { id } from "tsafe/id";

type Props = {
    className?: string;
    route: PageRoute;
};

const { useDebounce } = createUseDebounce({ delay: 400 });

export default function SoftwareCatalog(props: Props) {
    const { className, route } = props;

    const {
        categoryOptions,
        environmentOptions,
        organizationOptions,
        attributeNameFilterOptions,
        programmingLanguageOptions,
        softwares,
        softwareList,
        sortOptions
    } = useCoreState("softwareCatalog", "main");

    const { softwareCatalog } = useCore().functions;
    const { evtSoftwareCatalog } = useCore().evts;

    const [, startTransition] = useTransition();

    //TODO: Submit an issue to type route, this should be built in.
    const { updateRouteParams } = (function useClosure() {
        const refParams = useConst(() => ({
            ref: id<Param0<(typeof routes)["softwareCatalog"]>>(route.params)
        }));

        const updateRouteParams = useConstCallback(
            (paramsToUpdate: (typeof refParams)["ref"]) => {
                const params = { ...refParams.ref, ...paramsToUpdate };

                if (params.search === "") {
                    delete params.search;
                }

                if (params.attributeNames?.length === 0) {
                    delete params.attributeNames;
                }

                refParams.ref = params;

                return routes.softwareCatalog(params);
            }
        );

        return { updateRouteParams };
    })();

    useEvt(
        ctx => {
            evtSoftwareCatalog.attach(
                ({ action }) => action === "change sort",
                ctx,
                ({ sort }) =>
                    startTransition(() => {
                        updateRouteParams({
                            sort
                        }).replace();
                    })
            );
        },
        [evtSoftwareCatalog]
    );

    useDebounce(() => {
        softwareCatalog.updateFilter({
            key: "search",
            value: route.params.search
        });
    }, [route.params.search]);

    useEffect(() => {
        if (route.params.sort === undefined) {
            return;
        }

        softwareCatalog.updateFilter({
            key: "sort" as const,
            value: route.params.sort
        });
    }, [route.params.sort]);

    useEffect(() => {
        softwareCatalog.updateFilter({
            key: "organization",
            value:
                route.params.organization !== undefined
                    ? route.params.organization
                    : undefined
        });
    }, [route.params.organization]);

    useEffect(() => {
        softwareCatalog.updateFilter({
            key: "category",
            value: route.params.category !== undefined ? route.params.category : undefined
        });
    }, [route.params.category]);

    useEffect(() => {
        softwareCatalog.updateFilter({
            key: "programmingLanguage",
            value:
                route.params.programmingLanguage !== undefined
                    ? route.params.programmingLanguage
                    : undefined
        });
    }, [route.params.programmingLanguage]);

    useEffect(() => {
        softwareCatalog.updateFilter({
            key: "environment",
            value:
                route.params.environment !== undefined
                    ? route.params.environment
                    : undefined
        });
    }, [route.params.environment]);

    useEffect(() => {
        softwareCatalog.updateFilter({
            key: "filteredAttributeNames",
            value: route.params.attributeNames
        });
    }, [route.params.attributeNames]);

    const linksBySoftwareName = useMemo(
        () =>
            Object.fromEntries(
                softwareList.map(({ softwareName, id }) => [
                    softwareName,
                    /* prettier-ignore */
                    {
                        "softwareDetails": routes.softwareDetails({ "id": id }).link,
                        "declareUsageForm": routes.declarationForm({ "name": softwareName }).link,
                        "softwareUsersAndReferents": routes.softwareUsersAndReferents({ "name": softwareName }).link
                    }
                ])
            ),
        [softwareList]
    );

    return (
        /* prettier-ignore */
        <SoftwareCatalogControlled
            className={className}
            softwares={softwares}
            linksBySoftwareName={linksBySoftwareName}
            sortOptions={sortOptions}
            sort={route.params.sort ?? softwareCatalog.getDefaultSort()}
            onSortChange={sort => startTransition(() => updateRouteParams({ sort }).replace())}
            search={route.params.search}
            onSearchChange={search => updateRouteParams({ search }).replace()}
            organizationOptions={organizationOptions}
            organization={route.params.organization}
            onOrganizationChange={organization => startTransition(() => updateRouteParams({ organization }).replace())}
            categoryOptions={categoryOptions}
            category={route.params.category}
            onCategoryChange={category => startTransition(() => updateRouteParams({ category }).replace())}
            programmingLanguageOptions={programmingLanguageOptions}
            programmingLanguage={route.params.programmingLanguage}
            onProgrammingLanguageChange={programmingLanguage => startTransition(() => updateRouteParams({ programmingLanguage }).replace())}
            environmentOptions={environmentOptions}
            environment={route.params.environment}
            onEnvironmentChange={environment => startTransition(() => updateRouteParams({ environment }).replace())}
            attributeOptions={attributeNameFilterOptions}
            attributeNames={route.params.attributeNames}
            onAttributeNameChange={attributeNames => startTransition(() => updateRouteParams({ attributeNames }).replace())}
        />
    );
}
