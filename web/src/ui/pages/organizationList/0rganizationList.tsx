// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { OrganizationSearch } from "./OrganizationSearch";
import type { PageRoute } from "./route";
import { routes } from "ui/routes";
import { useConst } from "powerhooks/useConst";
import { useConstCallback } from "powerhooks/useConstCallback";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function OrganizationList(props: Props) {
    const { className, route } = props;

    let search: string = "";

    const searchRequest = (req: string) => {
        search = req;
        console.log(req);
    };
    // Update URL
    const { updateRouteParams } = (function useClosure() {
        const refParams = useConst(() => ({
            ref: id<Param0<(typeof routes)["organizationList"]>>(route.params)
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

                return routes.organizationList(params);
            }
        );

        return { updateRouteParams };
    })();

    return (
        <>
            <h1>Liste des organization développeuse</h1>
            <OrganizationSearch
                search={search}
                onSearchChange={updateRouteParams({ search }).replace()}
            ></OrganizationSearch>
            <div>Text Box</div>
            <div>List of orga</div>
        </>
    );
}
