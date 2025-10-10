// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useState, useId } from "react";
import { tss } from "tss-react";
import { SearchBar } from "@codegouvfr/react-dsfr/SearchBar";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { fr } from "@codegouvfr/react-dsfr";
import { assert } from "tsafe/assert";
import { Equals } from "tsafe";
import {
    useLang,
    softwareCategoriesFrBySoftwareCategoryEn,
    useGetOrganizationFullName,
    LocalizedString
} from "ui/i18n";
import { useTranslation } from "react-i18next";
import { State as SoftwareCatalogState } from "core/usecases/softwareCatalog";
import MenuItem from "@mui/material/MenuItem";
import SelectMui from "@mui/material/Select";
import { InputBase } from "@mui/material";
import Tooltip from "@mui/material/Tooltip";
import { SelectNext } from "ui/shared/SelectNext";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import { useEffectOnValueChange } from "powerhooks/useEffectOnValueChange";
import { useCoreState } from "../../../core";

export type Props = {
    className?: string;

    search: string;
    onSearchChange: (search: string) => void;

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
    onAttributeNamesChange: (
        attributeNames: SoftwareCatalogState.AttributeName[]
    ) => void;
};

export function SoftwareCatalogSearch(props: Props) {
    const {
        className,

        search,
        onSearchChange,

        organizationOptions,
        organization,
        onOrganizationChange,

        categoryOptions,
        category,
        onCategoryChange,

        environmentOptions,
        environment,
        onEnvironmentChange,

        programmingLanguageOptions,
        programmingLanguage,
        onProgrammingLanguageChange,

        attributeOptions,
        attributeNames,
        onAttributeNamesChange,

        ...rest
    } = props;
    const { uiConfig, attributeDefinitions } = useCoreState("uiConfig", "main")!;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { t } = useTranslation();

    const [filtersWrapperDivElement, setFiltersWrapperDivElement] =
        useState<HTMLDivElement | null>(null);

    const { lang } = useLang();

    const [areFiltersOpen, setAreFiltersOpen] = useState(
        () =>
            organization !== undefined ||
            category !== undefined ||
            environment !== undefined ||
            attributeNames.length !== 0
    );

    useEffectOnValueChange(() => {
        if (!areFiltersOpen) {
            onOrganizationChange(undefined);
            onCategoryChange(undefined);
            onEnvironmentChange(undefined);
            onAttributeNamesChange([]);
        }
    }, [areFiltersOpen]);

    const { classes, cx } = useStyles({
        filterWrapperMaxHeight: areFiltersOpen
            ? (filtersWrapperDivElement?.scrollHeight ?? 0)
            : 0
    });

    const filtersWrapperId = `filter-wrapper-${useId()}`;

    const { getOrganizationFullName } = useGetOrganizationFullName();

    return (
        <div className={classes.root}>
            <div className={cx(classes.basicSearch, className)}>
                <SearchBar
                    className={classes.searchBar}
                    label={t("softwareCatalogSearch.placeholder")}
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
                <Button
                    className={classes.filterButton}
                    iconId={
                        areFiltersOpen ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill"
                    }
                    iconPosition="right"
                    onClick={() => setAreFiltersOpen(!areFiltersOpen)}
                    aria-expanded={areFiltersOpen ? "true" : "false"}
                    aria-controls={filtersWrapperId}
                >
                    {t("softwareCatalogSearch.filters")}
                </Button>
            </div>
            <div
                className={classes.filtersWrapper}
                id={filtersWrapperId}
                ref={setFiltersWrapperDivElement}
            >
                {uiConfig?.catalog.search.options.organisation && (
                    <SelectNext
                        className={classes.filterSelectGroup}
                        label={
                            <>
                                {t("softwareCatalogSearch.organizationLabel")}{" "}
                                <Tooltip
                                    title={t(
                                        "softwareCatalogSearch.organization filter hint"
                                    )}
                                    arrow
                                >
                                    <i className={fr.cx("ri-question-line")} />
                                </Tooltip>
                            </>
                        }
                        nativeSelectProps={{
                            onChange: event =>
                                onOrganizationChange(event.target.value || undefined),
                            value: organization ?? ""
                        }}
                        disabled={organizationOptions.length === 0}
                        options={[
                            {
                                label: t("app.allFeminine"),
                                value: ""
                            },
                            ...organizationOptions.map(
                                ({ organization, softwareCount }) => ({
                                    value: organization,
                                    label: `${getOrganizationFullName(
                                        organization
                                    )} (${softwareCount})`
                                })
                            )
                        ]}
                    />
                )}

                {uiConfig?.catalog.search.options.applicationCategories && (
                    <SelectNext
                        className={classes.filterSelectGroup}
                        label={t("softwareCatalogSearch.categoriesLabel")}
                        disabled={categoryOptions.length === 0}
                        nativeSelectProps={{
                            onChange: event =>
                                onCategoryChange(event.target.value || undefined),
                            value: category ?? ""
                        }}
                        options={[
                            {
                                label: t("app.allFeminine"),
                                value: ""
                            },
                            ...categoryOptions
                                .map(({ category, softwareCount }) => ({
                                    value: category,
                                    label: `${
                                        lang === "fr"
                                            ? (softwareCategoriesFrBySoftwareCategoryEn[
                                                  category
                                              ] ?? category)
                                            : category
                                    } (${softwareCount})`
                                }))
                                .sort((a, b) => {
                                    const labelA = a.label.toLowerCase();
                                    const labelB = b.label.toLowerCase();
                                    if (labelA < labelB) return -1;
                                    if (labelA > labelB) return 1;
                                    return 0;
                                })
                        ]}
                    />
                )}

                {uiConfig?.catalog.search.options.softwareType && (
                    <SelectNext
                        className={classes.filterSelectGroup}
                        label={t("softwareCatalogSearch.environnement label")}
                        nativeSelectProps={{
                            onChange: event =>
                                onEnvironmentChange(event.target.value || undefined),
                            value: environment ?? ""
                        }}
                        options={[
                            {
                                label: t("app.all"),
                                value: "" as const
                            },
                            ...environmentOptions.map(
                                ({ environment, softwareCount }) => ({
                                    value: environment,
                                    label: `${t(
                                        `softwareCatalogSearch.${environment}`
                                    )} (${softwareCount})`
                                })
                            )
                        ]}
                    />
                )}

                {uiConfig?.catalog.search.options.customAttributes && (
                    <div className={classes.filterSelectGroup}>
                        <label htmlFor="prerogatives-label">
                            {t("softwareCatalogSearch.customAttributesTitle")}
                        </label>
                        <SelectMui
                            multiple
                            displayEmpty={true}
                            value={attributeNames}
                            onChange={event => {
                                const attributeNames = event.target.value;

                                assert(typeof attributeNames !== "string");

                                onAttributeNamesChange(attributeNames);
                            }}
                            className={cx(fr.cx("fr-select"), classes.multiSelect)}
                            input={<InputBase />}
                            renderValue={attributeNames =>
                                t("softwareCatalogSearch.number of attributes selected", {
                                    count: attributeNames.length
                                })
                            }
                            placeholder="Placeholder"
                        >
                            {attributeOptions.map(
                                ({ attributeName, attributeLabel, softwareCount }) => {
                                    const label =
                                        typeof attributeLabel === "string"
                                            ? attributeLabel
                                            : attributeLabel[lang];
                                    return (
                                        <MenuItem
                                            key={attributeName}
                                            value={attributeName}
                                            disabled={softwareCount === 0}
                                        >
                                            <Checkbox
                                                checked={
                                                    attributeNames.indexOf(
                                                        attributeName
                                                    ) !== -1
                                                }
                                            />
                                            <ListItemText
                                                primary={`${label} (${softwareCount})`}
                                            />
                                        </MenuItem>
                                    );
                                }
                            )}
                        </SelectMui>
                    </div>
                )}

                {uiConfig?.catalog.search.options.programmingLanguages && (
                    <SelectNext
                        className={classes.filterSelectGroup}
                        label={t("softwareCatalogSearch.programmingLanguages label")}
                        nativeSelectProps={{
                            onChange: event =>
                                onProgrammingLanguageChange(
                                    event.target.value || undefined
                                ),
                            value: programmingLanguage ?? ""
                        }}
                        options={[
                            {
                                label: t("app.all"),
                                value: "" as const
                            },
                            ...programmingLanguageOptions.map(
                                ({ programmingLanguage, softwareCount }) => ({
                                    value: programmingLanguage,
                                    label: `${programmingLanguage} (${softwareCount})`
                                })
                            )
                        ]}
                    />
                )}
            </div>
        </div>
    );
}

SoftwareCatalogSearch.displayName = "SoftwareCatalogSearch";

const useStyles = tss
    .withName({ SoftwareCatalogSearch })
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
