// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import Card from "@codegouvfr/react-dsfr/Card";

import codingSvgUrl from "@codegouvfr/react-dsfr/dsfr/artwork/pictograms/digital/coding.svg";
import documentSvgUrl from "@codegouvfr/react-dsfr/dsfr/artwork/pictograms/document/document.svg";
import humanCooperationSvgUrl from "@codegouvfr/react-dsfr/dsfr/artwork/pictograms/environment/human-cooperation.svg";
import { SearchBar } from "@codegouvfr/react-dsfr/SearchBar";
import Tile from "@codegouvfr/react-dsfr/Tile";
import { Grid } from "@mui/material";
import { useCoreState } from "core";
import { useState } from "react";

import { Trans, useTranslation } from "react-i18next";
import { Waypoint } from "react-waypoint";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { keyframes, tss } from "tss-react";
import HomepageWaveSvg from "ui/assets/homepage_wave.svg?react";
import illustration_sill from "ui/assets/illustration_sill.svg";
import { routes } from "ui/routes";
import { useMetricCountUpAnimation } from "ui/tools/useMetricCountUpAnimation";
import type { PageRoute } from "./route";
import type { ApiTypes } from "api";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function Home(props: Props) {
    const { className, route, ...rest } = props;
    const { uiConfig } = useCoreState("uiConfig", "main")!;

    assert<Equals<typeof rest, {}>>();

    const { cx, classes, css } = useStyles();
    const { t } = useTranslation();

    const stats = useCoreState("generalStats", "main");

    const [search, setSearch] = useState<string>("");
    const [linkSearch, setLinkSearch] = useState<string>("");

    const updateSearchLink = (searchEvent: React.ChangeEvent<HTMLInputElement>) => {
        const value = searchEvent.target.value;
        setSearch(value);
        setLinkSearch(`/list?search=${value}&sort=best_match`);
    };

    const statsCases = uiConfig.home.statistics.categories;

    const configUseCases = uiConfig.home.usecases;
    const useCaseNames = (
        Object.keys(configUseCases) as ApiTypes.ConfigurableUseCaseName[]
    ).filter(key => configUseCases[key].enabled);

    const softwareSelectionList = [
        {
            title: t("home.lastAdded"),
            linkProps: routes.softwareCatalog({
                sort: "added_time"
            }).link
        },
        {
            title: t("home.mostUsed"),
            linkProps: routes.softwareCatalog({
                sort: "user_count"
            }).link
        },
        {
            title: t("home.essential"),
            linkProps: routes.softwareCatalog({
                attributeNames: ["isInstallableOnUserComputer"]
            }).link
        },
        {
            title: t("home.recentlyUpdated"),
            linkProps: routes.softwareCatalog({
                sort: "latest_version_publication_date"
            }).link
        },
        {
            title: t("home.waitingForReferent"),
            linkProps: routes.softwareCatalog({
                sort: "referent_count_ASC"
            }).link
        },
        {
            title: t("home.inSupportMarket"),
            linkProps: routes.softwareCatalog({
                attributeNames: ["isPresentInSupportContract"]
            }).link
        }
    ];

    return (
        <div className={className}>
            <HeroSection className={fr.cx("fr-container")} />

            <div
                style={{
                    position: "relative",
                    top: 7
                }}
            >
                <HomepageWaveSvg
                    className={css({
                        "& path": {
                            fill: fr.colors.decisions.background.alt.blueFrance.default
                        }
                    })}
                />
            </div>

            {uiConfig?.home?.softwareSelection?.enabled && (
                <section
                    className={cx(classes.softwareSelectionBackground, classes.section)}
                >
                    <div className={fr.cx("fr-container")}>
                        <h2 className={classes.titleSection}>
                            {t("home.softwareSelection")}
                        </h2>
                        <div className={classes.softwareSelection}>
                            {softwareSelectionList.map(({ title, linkProps }) => (
                                <Tile key={title} title={title} linkProps={linkProps} />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {uiConfig?.home?.quickAccess?.enabled && (
                <section
                    className={cx(classes.softwareSelectionBackground, classes.section)}
                >
                    <div className={fr.cx("fr-container")}>
                        <Grid
                            container
                            direction="row"
                            sx={{
                                justifyContent: "center",
                                alignItems: "center"
                            }}
                        >
                            <Button
                                size="large"
                                priority="secondary"
                                linkProps={routes.softwareCatalog().link}
                            >
                                {t("home.accessCatalog")}
                            </Button>
                        </Grid>
                    </div>
                </section>
            )}

            <WhatIsTheSillSection
                className={cx(fr.cx("fr-container"), classes.section)}
            />

            {uiConfig?.home?.searchBar?.enabled && (
                <section className={cx(fr.cx("fr-container"), classes.section)}>
                    <Grid
                        container
                        direction="row"
                        columnSpacing={1}
                        sx={{
                            justifyContent: "center",
                            alignItems: "center",
                            alignContent: "stretch"
                        }}
                    >
                        <Grid item xs={8}>
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
                                            onChange={updateSearchLink}
                                            onKeyDown={event => {
                                                if (event.key === "Escape") {
                                                    assert(inputElement !== null);
                                                    inputElement.blur();
                                                }
                                                if (event.key === "Enter") {
                                                    window.location.href = linkSearch;
                                                }
                                            }}
                                        />
                                    );
                                }}
                            />
                        </Grid>
                        <Grid item>
                            <Button
                                linkProps={{
                                    href: linkSearch
                                }}
                            >
                                {t("app.search")}
                            </Button>
                        </Grid>
                    </Grid>
                </section>
            )}

            <section className={cx(classes.sillNumbersBackground, classes.section)}>
                <div className={cx(fr.cx("fr-container"), classes.sillNumbersContainer)}>
                    <h1 className={cx(classes.whiteText, classes.SillNumberTitle)}>
                        {t("home.SILLNumbers")}
                    </h1>
                    <Grid
                        container
                        direction="row"
                        sx={{
                            justifyContent: "center",
                            alignItems: "center"
                        }}
                    >
                        {statsCases.map(metricName => (
                            <Grid item xs={3}>
                                <div key={metricName}>
                                    <AnimatedMetric
                                        className={cx(
                                            fr.cx("fr-display--sm"),
                                            classes.whiteText,
                                            classes.numberText
                                        )}
                                        metricValue={stats[metricName]}
                                    />
                                    <h4 className={classes.whiteText}>
                                        {t(`home.${metricName}`)}
                                    </h4>
                                </div>
                            </Grid>
                        ))}
                    </Grid>
                </div>
            </section>
            <div className={cx(classes.helpUsBackground, classes.section)}>
                <div className={cx(fr.cx("fr-container"))}>
                    <h2 className={classes.titleSection}>{t("home.helpUs")}</h2>
                    <Grid
                        container
                        direction="row"
                        spacing={2}
                        sx={{
                            justifyContent: "center",
                            alignItems: "stretch",
                            alignContent: "stretch"
                        }}
                    >
                        {useCaseNames.map(useCaseName => {
                            const link = (() => {
                                const configLink = configUseCases[useCaseName].buttonLink;
                                const renderedConfigLink = {
                                    href: configLink
                                };
                                switch (useCaseName) {
                                    case "addSoftwareOrService":
                                        return configLink && configLink !== ""
                                            ? renderedConfigLink
                                            : routes.addSoftwareLanding().link;
                                    case "declareReferent":
                                    case "editSoftware":
                                        return configLink && configLink !== ""
                                            ? renderedConfigLink
                                            : routes.softwareCatalog().link;
                                }
                            })();

                            return (
                                <Grid item xs={4}>
                                    <Card
                                        classes={{
                                            img: css({
                                                "& > img": {
                                                    objectFit: "unset",
                                                    background: "white"
                                                }
                                            })
                                        }}
                                        key={useCaseName}
                                        title={t(`home.${useCaseName}Title`)}
                                        desc={
                                            <Trans
                                                i18nKey={`home.${useCaseName}Desc`}
                                                components={configUseCases[
                                                    useCaseName
                                                ].labelLinks.reduce(
                                                    (
                                                        map: Record<string, JSX.Element>,
                                                        link: string,
                                                        index: number
                                                    ) => {
                                                        const key = `a${index + 1}`;
                                                        const obj: Record<
                                                            string,
                                                            JSX.Element
                                                        > = {};

                                                        obj[key] = (
                                                            /* eslint-disable-next-line jsx-a11y/anchor-has-content */
                                                            <a
                                                                href={link}
                                                                style={{
                                                                    color: fr.colors
                                                                        .decisions.text
                                                                        .title.blueFrance
                                                                        .default
                                                                }}
                                                            />
                                                        );
                                                        return Object.assign(map, obj);
                                                    },
                                                    {}
                                                )}
                                            />
                                        }
                                        imageAlt={t("home.illustrationImage")}
                                        linkProps={link}
                                        imageUrl={(() => {
                                            switch (useCaseName) {
                                                case "declareReferent":
                                                    return humanCooperationSvgUrl;
                                                case "editSoftware":
                                                    return documentSvgUrl;
                                                case "addSoftwareOrService":
                                                    return codingSvgUrl;
                                            }
                                        })()}
                                        footer={
                                            configUseCases[useCaseName].buttonEnabled && (
                                                <Button
                                                    priority="primary"
                                                    linkProps={link}
                                                >
                                                    {t(`home.${useCaseName}ButtonLabel`)}
                                                </Button>
                                            )
                                        }
                                        enlargeLink={false}
                                    />
                                </Grid>
                            );
                        })}
                    </Grid>
                </div>
            </div>
        </div>
    );
}

function AnimatedMetric(props: { className?: string; metricValue: number }) {
    const { metricValue, className } = props;

    const { ref, renderedMetricValue } = useMetricCountUpAnimation({
        metricValue
    });

    return (
        <p ref={ref} className={className}>
            {renderedMetricValue}
        </p>
    );
}

const useStyles = tss.withName({ Home }).create({
    section: {
        ...fr.spacing("padding", {
            topBottom: "30v"
        }),
        [fr.breakpoints.down("md")]: {
            ...fr.spacing("padding", {
                topBottom: "10v"
            })
        }
    },
    titleSection: {
        marginBottom: fr.spacing("10v"),
        [fr.breakpoints.down("md")]: {
            marginBottom: fr.spacing("8v")
        },
        textAlign: "center"
    },
    softwareSelectionBackground: {
        backgroundColor: fr.colors.decisions.background.alt.blueFrance.default
    },
    softwareSelection: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        columnGap: fr.spacing("6v"),
        rowGap: fr.spacing("8v"),
        [fr.breakpoints.down("md")]: {
            gridTemplateColumns: `repeat(1, 1fr)`
        }
    },
    sillNumbersBackground: {
        backgroundColor: fr.colors.decisions.background.actionHigh.blueFrance.default
    },
    sillNumbersContainer: {
        textAlign: "center"
    },
    whiteText: {
        color: fr.colors.decisions.text.inverted.grey.default
    },
    SillNumberTitle: {
        marginBottom: fr.spacing("20v")
    },
    numberText: {
        marginBottom: fr.spacing("1v")
    },
    helpUsBackground: {
        backgroundColor: fr.colors.decisions.background.default.grey.hover
    },
    searchBar: {
        flex: 1
    }
});

const { HeroSection } = (() => {
    type Props = {
        className?: string;
    };

    function HeroSection(props: Props) {
        const { className } = props;

        const { cx, classes } = useStyles();

        const { t } = useTranslation();

        return (
            <section className={cx(classes.root, className)}>
                <div className={classes.titleWrapper}>
                    <h2 className={classes.title}>
                        <span
                            style={{
                                color: fr.colors.decisions.text.title.blueFrance.default
                            }}
                        >
                            {t("home.title")}
                        </span>{" "}
                        {t("home.subTitle")}
                    </h2>
                </div>
                <img
                    src={illustration_sill}
                    alt="Illustration du SILL"
                    className={classes.illustration}
                />
            </section>
        );
    }

    const useStyles = tss.withName({ HeroSection }).create({
        root: {
            display: "flex",
            [fr.breakpoints.down("md")]: {
                flexDirection: "column",
                marginTop: fr.spacing("10v")
            },
            marginTop: fr.spacing("20v"),
            marginBottom: fr.spacing("10v")
        },
        titleWrapper: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            paddingRight: fr.spacing("10v"),
            [fr.breakpoints.down("md")]: {
                marginBottom: fr.spacing("15v"),
                paddingRight: "unset"
            }
        },
        title: {
            marginBottom: 0,
            maxWidth: 700
        },
        illustration: {
            [fr.breakpoints.down("md")]: {
                width: "50%",
                margin: "0 auto"
            }
        }
    });

    return { HeroSection };
})();

const { WhatIsTheSillSection } = (() => {
    type Props = {
        className?: string;
    };

    function WhatIsTheSillSection(props: Props) {
        const { className } = props;
        const { uiConfig } = useCoreState("uiConfig", "main")!;

        const [isVisible, setIsVisible] = useState(false);

        const { cx, classes } = useStyles({ isVisible });

        const { t } = useTranslation();

        return (
            <section className={cx(classes.root, className)}>
                <Waypoint onEnter={() => setIsVisible(true)} />
                <h2>{t("home.theSillInAFewWords")}</h2>
                <p className={classes.paragraph}>
                    <Trans
                        i18nKey={"home.theSillInAFewWordsParagraph"}
                        /* eslint-disable jsx-a11y/anchor-has-content */
                        components={
                            {
                                space: <span> </span>,
                                ...uiConfig?.home.theSillInAFewWordsParagraphLinks.reduce(
                                    (
                                        map: Record<string, JSX.Element>,
                                        link: string,
                                        index: number
                                    ) => {
                                        const key = `a${index + 1}`;
                                        const obj: Record<string, JSX.Element> = {};
                                        obj[key] = (
                                            <a
                                                href={link}
                                                style={{
                                                    color: fr.colors.decisions.text.title
                                                        .blueFrance.default
                                                }}
                                            />
                                        );
                                        return Object.assign(map, obj);
                                    },
                                    {}
                                )
                            }
                            /* eslint-enable jsx-a11y/anchor-has-content */
                        }
                    />
                </p>
            </section>
        );
    }

    const useStyles = tss
        .withName({ WhatIsTheSillSection })
        .withParams<{ isVisible: boolean }>()
        .create(({ isVisible }) => ({
            root: {
                textAlign: "center",
                opacity: isVisible ? undefined : 0,
                animation: !isVisible
                    ? undefined
                    : `${keyframes`
        0% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
        `} 1000ms`
            },
            paragraph: {
                maxWidth: 700,
                margin: "auto"
            }
        }));

    return { WhatIsTheSillSection };
})();
