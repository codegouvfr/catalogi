// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { SearchBar } from "@codegouvfr/react-dsfr/SearchBar";
import { useCore, useCoreState } from "core";
import type { State as SoftwareCatalogState } from "core/usecases/softwareCatalog";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Link } from "type-route";
import { tss } from "tss-react";
import softwareLogoPlaceholder from "ui/assets/software_logo_placeholder.png";
import { routes } from "ui/routes";

const minSearchLength = 3;
const maxSuggestionCount = 4;

type Option = {
    key: string;
    content: ReactNode;
    route: { link: Link; push: () => void };
    isCallToAction?: boolean;
};

type Props = {
    className?: string;
};

export function SoftwareQuickSearch(props: Props) {
    const { className } = props;

    const { t } = useTranslation();
    const { classes, cx } = useStyles();
    const { softwareCatalog } = useCore().functions;
    const { uiConfig } = useCoreState("uiConfig", "main")!;

    const id = useId();
    const listboxId = `${id}-listbox`;
    const quickLinksLabelId = `${id}-quick-links`;

    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
    const [searchResults, setSearchResults] = useState<SoftwareCatalogState.Software[]>(
        []
    );

    const trimmedSearch = search.trim();
    const isSearching = trimmedSearch.length >= minSearchLength;

    useEffect(() => {
        if (!isSearching) {
            return;
        }

        let isActive = true;

        softwareCatalog
            .getSearchResults({ search: trimmedSearch })
            .then(softwares => isActive && setSearchResults(softwares));

        return () => {
            isActive = false;
        };
    }, [trimmedSearch, isSearching]);

    const getCatalogRoute = () =>
        trimmedSearch === ""
            ? routes.softwareCatalog()
            : routes.softwareCatalog({ search: trimmedSearch, sort: "best_match" });

    const options: Option[] = (() => {
        if (!isSearching) {
            return [
                ...(uiConfig.header.menu.catalog.enabled
                    ? [
                          {
                              key: "catalog",
                              content: t("header.navigation catalog"),
                              route: routes.softwareCatalog()
                          }
                      ]
                    : []),
                ...(uiConfig.header.menu.about.enabled
                    ? [
                          {
                              key: "about",
                              content: t("header.navigation about"),
                              route: routes.readme()
                          }
                      ]
                    : [])
            ];
        }

        if (searchResults.length === 0) {
            return [
                {
                    key: "allSoftwares",
                    content: t("home.seeAllSoftwares"),
                    route: routes.softwareCatalog(),
                    isCallToAction: true
                }
            ];
        }

        return [
            ...searchResults.slice(0, maxSuggestionCount).map(software => ({
                key: `software-${software.id}`,
                content: (
                    <>
                        {(software.image !== undefined ||
                            uiConfig.catalog.defaultLogo) && (
                            <img
                                className={classes.logo}
                                src={software.image ?? softwareLogoPlaceholder}
                                alt=""
                            />
                        )}
                        {software.name}
                    </>
                ),
                route: routes.softwareDetails({ id: software.id })
            })),
            {
                key: "allResults",
                content: t("home.seeAllResults", { count: searchResults.length }),
                route: getCatalogRoute(),
                isCallToAction: true
            }
        ];
    })();

    const close = () => {
        setIsOpen(false);
        setActiveIndex(undefined);
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
            case "ArrowDown":
            case "ArrowUp": {
                event.preventDefault();
                setIsOpen(true);
                if (options.length === 0) {
                    return;
                }
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex(
                    activeIndex === undefined
                        ? step === 1
                            ? 0
                            : options.length - 1
                        : (activeIndex + step + options.length) % options.length
                );
                return;
            }
        }
    };

    return (
        <div className={cx(classes.root, className)}>
            <SearchBar
                big
                label={t("home.searchPlaceholder")}
                allowEmptySearch
                // Also called on Enter, then the input is blurred (closes the menu)
                onButtonClick={() =>
                    (isOpen && activeIndex !== undefined
                        ? options[activeIndex].route
                        : getCatalogRoute()
                    ).push()
                }
                renderInput={({ className, id, placeholder, type }) => (
                    <input
                        className={className}
                        id={id}
                        placeholder={placeholder}
                        type={type}
                        autoComplete="off"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={isOpen}
                        aria-controls={listboxId}
                        aria-activedescendant={
                            isOpen && activeIndex !== undefined
                                ? `${listboxId}-${activeIndex}`
                                : undefined
                        }
                        value={search}
                        onChange={event => {
                            setSearch(event.target.value);
                            setIsOpen(true);
                            setActiveIndex(undefined);
                        }}
                        onFocus={() => setIsOpen(true)}
                        onBlur={close}
                        onKeyDown={onKeyDown}
                    />
                )}
            />
            <div
                className={cx(fr.cx("fr-menu"), classes.menu)}
                hidden={!isOpen}
                // Keep the focus in the input when clicking in the menu
                onMouseDown={event => event.preventDefault()}
            >
                <div className={cx(fr.cx("fr-menu__list"), classes.menuList)}>
                    {!isSearching && (
                        <>
                            <p className={fr.cx("fr-hint-text", "fr-px-2w", "fr-pt-3v")}>
                                {t("home.searchHint")}
                            </p>
                            {options.length > 0 && (
                                <p
                                    id={quickLinksLabelId}
                                    className={fr.cx(
                                        "fr-hint-text",
                                        "fr-px-2w",
                                        "fr-mb-3v"
                                    )}
                                >
                                    {t("home.quickLinks")}
                                </p>
                            )}
                        </>
                    )}
                    {isSearching && searchResults.length === 0 && (
                        <p className={fr.cx("fr-hint-text", "fr-px-2w", "fr-pt-3v")}>
                            {t("home.noSearchResult")}
                        </p>
                    )}
                    <ul
                        id={listboxId}
                        role="listbox"
                        aria-label={isSearching ? t("home.searchPlaceholder") : undefined}
                        aria-labelledby={isSearching ? undefined : quickLinksLabelId}
                        className={cx(fr.cx("fr-raw-list"), classes.listbox)}
                    >
                        {options.map((option, index) => (
                            <li
                                key={option.key}
                                id={`${listboxId}-${index}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                className={cx(option.isCallToAction && fr.cx("fr-p-2w"))}
                            >
                                {option.isCallToAction ? (
                                    <Button
                                        priority="tertiary"
                                        className={classes.callToAction}
                                        linkProps={{ ...option.route.link, tabIndex: -1 }}
                                    >
                                        {option.content}
                                    </Button>
                                ) : (
                                    <a
                                        {...option.route.link}
                                        tabIndex={-1}
                                        className={classes.option}
                                    >
                                        {option.content}
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

const useStyles = tss.withName({ SoftwareQuickSearch }).create({
    root: {
        position: "relative"
    },
    menu: {
        left: 0,
        right: 0
    },
    menuList: {
        width: "100%",
        marginBottom: 0
    },
    listbox: {
        "& > li[aria-selected=true] > a": {
            backgroundColor: "var(--hover)"
        }
    },
    option: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("3v"),
        ...fr.spacing("padding", { topBottom: "3v", rightLeft: "4v" }),
        color: fr.colors.decisions.text.title.grey.default,
        backgroundImage: "none",
        "--hover-tint": "var(--hover)",
        "--active-tint": "var(--active)"
    },
    callToAction: {
        width: "100%",
        justifyContent: "center"
    },
    logo: {
        width: fr.spacing("16v"),
        height: fr.spacing("8v"),
        objectFit: "contain"
    }
});
