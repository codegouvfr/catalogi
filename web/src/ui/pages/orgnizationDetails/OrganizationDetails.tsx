// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { OrganizationCard } from "../../shared/OrganizationCard";
import type { PageRoute } from "./route";
import { useCoreState } from "core";

import { tss } from "tss-react";
import { fr } from "@codegouvfr/react-dsfr";
import { useTranslation } from "react-i18next";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function organizationDetails(props: Props) {
    const { className, route } = props;

    const { t } = useTranslation();
    const { cx, classes } = useStyles();

    const key = route.params.key;

    let search = "";

    const searchRequest = (req: string) => {
        search = req;
        console.log(req);
    };

    const state = useCoreState("organizationList", "main");
    const org = state?.list && key ? state.list[key] : undefined;

    return (
        <>
            <div className={cx(fr.cx("fr-container"), classes.root, className)}>
                <div className={classes.header}>
                    <h6 className={classes.softwareCount}>{key ?? "test"}</h6>
                </div>
                <div>
                    {org && <OrganizationCard organization={org}></OrganizationCard>}
                </div>

                <div>
                    <h6>List of software</h6>
                </div>
            </div>
        </>
    );
}

const useStyles = tss.withName({ organizationDetails }).create({
    root: {
        paddingBottom: fr.spacing("30v"),
        [fr.breakpoints.down("md")]: {
            paddingBottom: fr.spacing("20v")
        }
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...fr.spacing("margin", {
            topBottom: "4v"
        }),
        [fr.breakpoints.down("md")]: {
            flexWrap: "wrap"
        }
    },
    softwareCount: {
        marginBottom: 0
    },
    sort: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("2v"),

        "&&>select": {
            width: "auto",
            marginTop: 0
        },
        [fr.breakpoints.down("md")]: {
            marginTop: fr.spacing("4v")
        }
    }
});
