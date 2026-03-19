// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ApiTypes } from "api";
import { OrganizationCard } from "../../shared/OrganizationCard";
import { OrganizationSearch } from "./OrganizationSearch";
import type { PageRoute } from "./route";
import { useCore, useCoreState } from "core";
import { useLayoutEffect, useMemo, useRef } from "react";

import { tss } from "tss-react";
import { fr } from "@codegouvfr/react-dsfr";
import { useBreakpointsValues } from "@codegouvfr/react-dsfr/useBreakpointsValues";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useWindowInnerSize } from "powerhooks/useWindowInnerSize";
import { useTranslation } from "react-i18next";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function OrganizationList(props: Props) {
    const { className, route } = props;

    const { t } = useTranslation();
    const { cx, classes } = useStyles();

    let search = "";

    const searchRequest = (req: string) => {
        search = req;
        console.log(req);
    };

    const state = useCoreState("organizationList", "main");
    console.log(state.list);

    return (
        <>
            <div className={cx(fr.cx("fr-container"), classes.root, className)}>
                <OrganizationSearch
                    search={search}
                    onSearchChange={searchRequest}
                ></OrganizationSearch>
                <div className={classes.header}>
                    <h6 className={classes.softwareCount}>
                        {t("softwareCatalogControlled.searchResults", {
                            count: state.list ? Object.values(state.list).length : 0
                        })}
                    </h6>
                </div>
                <div>
                    <RowVirtualizerDynamicWindow
                        organizations={state.list ? Object.values(state.list) : []}
                    ></RowVirtualizerDynamicWindow>
                </div>
            </div>
        </>
    );
}

function RowVirtualizerDynamicWindow(props: {
    organizations: Array<ApiTypes.Organization>;
}) {
    const { organizations } = props;

    const { columnCount } = (function useClosure() {
        const { breakpointsValues } = useBreakpointsValues();

        const { windowInnerWidth } = useWindowInnerSize();

        const columnCount = (() => {
            if (windowInnerWidth < breakpointsValues.md) {
                return 1;
            }

            if (windowInnerWidth < breakpointsValues.xl) {
                return 2;
            }

            return 3;
        })();

        return { columnCount };
    })();

    const organizationsGroupedByLine = useMemo(() => {
        const groupedorganizations: (ApiTypes.Organization | undefined)[][] = [];

        for (let i = 0; i < organizations.length; i += columnCount) {
            const row: ApiTypes.Organization[] = [];

            for (let j = 0; j < columnCount; j++) {
                row.push(organizations[i + j]);
            }

            groupedorganizations.push(row);
        }

        return groupedorganizations;
    }, [organizations, columnCount]);

    const parentRef = useRef<HTMLDivElement>(null);

    const parentOffsetRef = useRef(0);

    useLayoutEffect(() => {
        parentOffsetRef.current = parentRef.current?.offsetTop ?? 0;
    }, []);

    const height = 332;

    const virtualizer = useWindowVirtualizer({
        count: organizationsGroupedByLine.length,
        estimateSize: () => height,
        scrollMargin: parentOffsetRef.current,
        overscan: 5
    });
    const items = virtualizer.getVirtualItems();

    const { css } = useStyles();

    const gutter = fr.spacing("4v");

    return (
        <div ref={parentRef}>
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    position: "relative"
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${
                            items[0].start - virtualizer.options.scrollMargin
                        }px)`
                    }}
                >
                    {items.map(virtualRow => (
                        <div
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            ref={virtualizer.measureElement}
                        >
                            <div
                                className={css({
                                    display: "grid",
                                    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                                    gridGap: gutter,
                                    paddingTop: gutter
                                })}
                            >
                                {organizationsGroupedByLine[virtualRow.index].map(
                                    (organization, i) => {
                                        if (organization === undefined) {
                                            return <div key={i} />;
                                        }

                                        return (
                                            <OrganizationCard
                                                key={organization.name}
                                                organization={organization}
                                            />
                                        );
                                    }
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const useStyles = tss.withName({ OrganizationList }).create({
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
