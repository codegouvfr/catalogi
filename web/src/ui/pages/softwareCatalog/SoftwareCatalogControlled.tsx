// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useRef, useLayoutEffect, useMemo } from "react";
import { tss } from "tss-react";
import type { State as SoftwareCatalogState } from "core/usecases/softwareCatalog";
import { assert } from "tsafe/assert";
import type { Equals } from "tsafe";
import type { Link } from "type-route";
import { fr } from "@codegouvfr/react-dsfr";
import { SoftwareCatalogCard } from "ui/pages/softwareCatalog/SoftwareCatalogCard";
import { SoftwareCatalogSearch } from "ui/pages/softwareCatalog/SoftwareCatalogSearch";
import { useTranslation } from "react-i18next";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useWindowInnerSize } from "powerhooks/useWindowInnerSize";
import { useBreakpointsValues } from "@codegouvfr/react-dsfr/useBreakpointsValues";
import { SelectNext } from "ui/shared/SelectNext";
import { LocalizedString } from "../../i18n";
import { ApiTypes } from "api";

export type Props = {
    className?: string;
    softwares: ApiTypes.SoftwareInList[];
    linksBySoftwareName: Record<
        string,
        Record<"softwareDetails" | "declareUsageForm" | "softwareUsersAndReferents", Link>
    >;

    search: string;
    onSearchChange: (search: string) => void;

    sortOptions: SoftwareCatalogState.Sort[];
    sort: SoftwareCatalogState.Sort;
    onSortChange: (sort: SoftwareCatalogState.Sort) => void;

    organizationOptions: {
        organization: string;
        softwareCount: number;
    }[];
    organization: string | undefined;
    onOrganizationChange: (organization: string | undefined) => void;

    categoryOptions: {
        category: string;
        softwareCount: number;
    }[];
    category: string | undefined;
    onCategoryChange: (category: string | undefined) => void;

    programmingLanguageOptions: {
        programmingLanguage: string;
        softwareCount: number;
    }[];
    programmingLanguage: string | undefined;
    onProgrammingLanguageChange: (programmingLanguage: string | undefined) => void;

    environmentOptions: {
        environment: SoftwareCatalogState.Environment;
        softwareCount: number;
    }[];
    environment: SoftwareCatalogState.Environment | undefined;
    onEnvironmentChange: (
        environmentsFilter: SoftwareCatalogState.Environment | undefined
    ) => void;

    attributeOptions: {
        attributeName: SoftwareCatalogState.AttributeName;
        attributeLabel: LocalizedString;
        softwareCount: number;
    }[];
    attributeNames: SoftwareCatalogState.AttributeName[];
    onAttributeNameChange: (attribuetNames: SoftwareCatalogState.AttributeName[]) => void;
};

export function SoftwareCatalogControlled(props: Props) {
    const {
        className,
        softwares,
        linksBySoftwareName,
        search,
        onSearchChange,
        sortOptions,
        sort,
        onSortChange,
        organizationOptions,
        organization,
        onOrganizationChange,
        categoryOptions,
        category,
        onCategoryChange,
        environmentOptions,
        environment,
        onEnvironmentChange,
        attributeOptions,
        attributeNames,
        onAttributeNameChange,
        programmingLanguageOptions,
        programmingLanguage,
        onProgrammingLanguageChange,
        ...rest
    } = props;

    assert<Equals<typeof rest, {}>>();

    const { cx, classes } = useStyles();
    const { t } = useTranslation();

    return (
        <div className={cx(fr.cx("fr-container"), classes.root, className)}>
            <SoftwareCatalogSearch
                search={search}
                onSearchChange={onSearchChange}
                organizationOptions={organizationOptions}
                organization={organization}
                onOrganizationChange={onOrganizationChange}
                categoryOptions={categoryOptions}
                category={category}
                onCategoryChange={onCategoryChange}
                environmentOptions={environmentOptions}
                environment={environment}
                onEnvironmentChange={onEnvironmentChange}
                attributeNames={attributeNames}
                attributeOptions={attributeOptions}
                onAttributeNamesChange={onAttributeNameChange}
                programmingLanguage={programmingLanguage}
                programmingLanguageOptions={programmingLanguageOptions}
                onProgrammingLanguageChange={onProgrammingLanguageChange}
            />
            <div>
                <div className={classes.header}>
                    <h6 className={classes.softwareCount}>
                        {t("softwareCatalogControlled.searchResults", {
                            count: softwares.length
                        })}
                    </h6>
                    <SelectNext
                        label={t("softwareCatalogControlled.sortBy")}
                        className={classes.sort}
                        nativeSelectProps={{
                            value: sort,
                            onChange: event => onSortChange(event.target.value)
                        }}
                        options={sortOptions.map(value => ({
                            value,
                            label: (() => {
                                switch (value) {
                                    case "added_time":
                                        return t("softwareCatalogControlled.addedTime");
                                    case "update_time":
                                        return t("softwareCatalogControlled.updateTime");
                                    case "referent_count":
                                        return t(
                                            "softwareCatalogControlled.referentCount"
                                        );
                                    case "referent_count_ASC":
                                        return t(
                                            "softwareCatalogControlled.referentCountASC"
                                        );
                                    case "user_count":
                                        return t("softwareCatalogControlled.userCount");
                                    case "user_count_ASC":
                                        return t(
                                            "softwareCatalogControlled.userCountASC"
                                        );
                                    case "latest_version_publication_date":
                                        return t(
                                            "softwareCatalogControlled.latestVersionPublicationDate"
                                        );
                                    case "best_match":
                                        return t("softwareCatalogControlled.bestMatch");
                                    case "my_software":
                                        return t("softwareCatalogControlled.mySoftware");
                                }
                            })()
                        }))}
                    />
                </div>
                {softwares.length === 0 ? (
                    <h1>{t("softwareCatalogControlled.noSoftwareFound")}</h1>
                ) : (
                    <RowVirtualizerDynamicWindow
                        softwares={softwares}
                        linksBySoftwareName={linksBySoftwareName}
                    />
                )}
            </div>
        </div>
    );
}

function RowVirtualizerDynamicWindow(
    props: Pick<Props, "softwares" | "linksBySoftwareName">
) {
    const { softwares, linksBySoftwareName } = props;

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

    const softwaresGroupedByLine = useMemo(() => {
        const groupedSoftwares: (ApiTypes.SoftwareInList | undefined)[][] = [];

        for (let i = 0; i < softwares.length; i += columnCount) {
            const row: ApiTypes.SoftwareInList[] = [];

            for (let j = 0; j < columnCount; j++) {
                row.push(softwares[i + j]);
            }

            groupedSoftwares.push(row);
        }

        return groupedSoftwares;
    }, [softwares, columnCount]);

    const parentRef = useRef<HTMLDivElement>(null);

    const parentOffsetRef = useRef(0);

    useLayoutEffect(() => {
        parentOffsetRef.current = parentRef.current?.offsetTop ?? 0;
    }, []);

    const height = 332;

    const virtualizer = useWindowVirtualizer({
        count: softwaresGroupedByLine.length,
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
                                {softwaresGroupedByLine[virtualRow.index].map(
                                    (software, i) => {
                                        if (software === undefined) {
                                            return <div key={i} />;
                                        }

                                        const links =
                                            linksBySoftwareName[software.softwareName];

                                        return (
                                            <SoftwareCatalogCard
                                                key={software.id}
                                                className={css({ minHeight: height })}
                                                software={{
                                                    ...software,
                                                    softwareDetailsLink:
                                                        links?.softwareDetails,
                                                    declareFormLink:
                                                        links?.declareUsageForm,
                                                    softwareUsersAndReferentsLink:
                                                        links?.softwareUsersAndReferents
                                                }}
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

const useStyles = tss.withName({ SoftwareCatalogControlled }).create({
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
