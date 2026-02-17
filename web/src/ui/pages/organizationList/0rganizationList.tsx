// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { OrganizationSearch } from "./OrganizationSearch";
import type { PageRoute } from "./route";
import { useCoreState } from "core";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function OrganizationList(props: Props) {
    const { className, route } = props;

    let search = "";

    const searchRequest = (req: string) => {
        search = req;
        console.log(req);
    };

    const state = useCoreState("organizationList", "main");
    console.log(state.list);

    return (
        <>
            <h1>Liste des organization développeuse</h1>
            <OrganizationSearch
                search={search}
                onSearchChange={searchRequest}
            ></OrganizationSearch>
            <div>Text Box</div>
            <div>List of orga</div>
        </>
    );
}
