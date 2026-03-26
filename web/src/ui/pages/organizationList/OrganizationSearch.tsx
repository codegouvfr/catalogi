// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useState, useId } from "react";
import { tss } from "tss-react";
import { SearchBar } from "@codegouvfr/react-dsfr/SearchBar";
import { fr } from "@codegouvfr/react-dsfr";
import { assert } from "tsafe/assert";
import { Equals } from "tsafe";
import { useTranslation } from "react-i18next";

export type Props = {
    className?: string;

    search: string;
    onSearchChange: (search: string) => void;
};

export function OrganizationSearch(props: Props) {
    const {
        className,

        search,
        onSearchChange,

        ...rest
    } = props;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { t } = useTranslation();

    const [filtersWrapperDivElement, setFiltersWrapperDivElement] =
        useState<HTMLDivElement | null>(null);

    const { classes, cx } = useStyles({
        filterWrapperMaxHeight: filtersWrapperDivElement?.scrollHeight ?? 0
    });

    return (
        <div className={classes.root}>
            <div className={cx(classes.basicSearch, className)}>
                <SearchBar
                    className={classes.searchBar}
                    label={t("organizationSearch.placeholder")}
                    renderInput={({ className, id, placeholder, type }) => {
                        const [inputElement, setInputElement] =
                            useState<HTMLInputElement | null>(null);

                        return (
                            <input
                                ref={setInputElement}
                                className={className}
                                id={id}
                                placeholder={placeholder}
                                type={type}
                                value={search}
                                onChange={event =>
                                    onSearchChange(event.currentTarget.value)
                                }
                                onKeyDown={event => {
                                    if (event.key === "Escape") {
                                        assert(inputElement !== null);
                                        inputElement.blur();
                                    }
                                }}
                            />
                        );
                    }}
                />
            </div>
        </div>
    );
}

OrganizationSearch.displayName = "SoftwareCatalogSearch";

const useStyles = tss
    .withName({ SoftwareCatalogSearch: OrganizationSearch })
    .withParams<{ filterWrapperMaxHeight: number }>()
    .create(({ filterWrapperMaxHeight }) => ({
        root: {
            "&:before": {
                content: "none"
            }
        },
        basicSearch: {
            display: "flex",
            paddingTop: fr.spacing("6v")
        },
        searchBar: {
            flex: 1
        },
        filterButton: {
            backgroundColor: fr.colors.decisions.background.actionLow.blueFrance.default,
            "&&&:hover": {
                backgroundColor: fr.colors.decisions.background.actionLow.blueFrance.hover
            },
            color: fr.colors.decisions.text.actionHigh.blueFrance.default,
            marginLeft: fr.spacing("4v")
        },
        filtersWrapper: {
            transition: "max-height 0.2s ease-out",
            maxHeight: filterWrapperMaxHeight,
            overflow: "hidden",
            marginTop: fr.spacing("4v"),
            display: "grid",
            gridTemplateColumns: `repeat(4, minmax(20%, 1fr))`,
            columnGap: fr.spacing("4v"),
            [fr.breakpoints.down("md")]: {
                gridTemplateColumns: `repeat(1, 1fr)`
            },
            paddingLeft: fr.spacing("1v")
        },
        filterSelectGroup: {
            "&:not(:last-of-type)": {
                borderRight: `1px ${fr.colors.decisions.border.default.grey.default} solid`,
                paddingRight: fr.spacing("4v")
            },
            [fr.breakpoints.down("md")]: {
                "&:not(:last-of-type)": {
                    border: "none"
                }
            }
        },
        multiSelect: {
            marginTop: fr.spacing("2v"),
            paddingRight: 0,
            "& > .MuiInputBase-input": {
                padding: 0
            },
            "& > .MuiSvgIcon-root": {
                display: "none"
            }
        }
    }));
