// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ApiTypes } from "api";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useResolveLocalizedString } from "ui/i18n";
import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";
import { useFromNow } from "ui/datetimeUtils";
import softwareLogoPlaceholder from "ui/assets/software_logo_placeholder.png";
import Markdown from "react-markdown";

import type { Link } from "type-route";
import { useCoreState } from "core";
import { LogoURLButton } from "./LogoURLButton";

export type Props = {
    className?: string;
    organization: ApiTypes.Organization;
};

export const OrganizationCard = memo(({ className, organization }: Props) => {
    const { name, url, identifiers, producer } = organization;

    const softwareName = name;
    const latestVersion = {
        semVer:
            identifiers?.[0]?.subjectOf?.additionalType === "ROR"
                ? identifiers?.[0].value.split("/")[3]
                : undefined,
        publicationTime: undefined
    };

    // TO GET
    const logoUrl = undefined;
    const softwareDescription = "";

    // TO COMPUTE
    const softwareDetailsLink = new URL("https://google.fr");

    const searchHighlight = undefined;

    const ui = useCoreState("uiConfig", "main");

    const { t } = useTranslation();
    const { resolveLocalizedString } = useResolveLocalizedString();
    const { classes, cx } = useStyles({
        isSearchHighlighted:
            searchHighlight !== undefined ||
            !ui?.uiConfig.catalog.cardOptions.referentCount
    });
    const { fromNowText } = useFromNow({ dateTime: latestVersion?.publicationTime });

    return (
        <div className={cx(fr.cx("fr-card"), classes.root, className)}>
            <div className={classes.cardBody}>
                <a className={cx(classes.headerContainer)} {...softwareDetailsLink}>
                    {(logoUrl || ui?.uiConfig.catalog.defaultLogo) && (
                        <div className={classes.logoWrapper}>
                            <img
                                className={cx(classes.logo)}
                                src={logoUrl ?? softwareLogoPlaceholder}
                                alt={"software logo"}
                            />
                        </div>
                    )}

                    <div className={cx(classes.header)}>
                        <div className={cx(classes.titleContainer)}>
                            <h3 className={cx(classes.title)}>{softwareName}</h3>
                            <div className={cx(classes.titleActionsContainer)}>🇨🇵</div>
                        </div>
                        <div>
                            {latestVersion !== undefined && (
                                <p
                                    className={cx(
                                        fr.cx("fr-card__detail"),
                                        classes.softwareVersionContainer
                                    )}
                                >
                                    {latestVersion?.publicationTime &&
                                        t("softwareCatalogCard.latestVersion", {
                                            fromNowText
                                        })}
                                    {latestVersion?.semVer && (
                                        <span
                                            className={cx(
                                                fr.cx(
                                                    "fr-badge--no-icon",
                                                    "fr-badge--yellow-tournesol",
                                                    "fr-badge",
                                                    "fr-badge--sm"
                                                ),
                                                classes.badgeVersion
                                            )}
                                        >
                                            {latestVersion?.semVer}
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                </a>

                <div className={cx(fr.cx("fr-card__desc"), classes.description)}>
                    <Markdown>{resolveLocalizedString(softwareDescription)}</Markdown>
                </div>
            </div>
            <div className={classes.footer}>
                <a
                    className={cx(
                        fr.cx("fr-btn", "fr-btn--secondary", "fr-text--sm"),
                        classes.declareReferentOrUserButton
                    )}
                    {...softwareDetailsLink}
                >
                    {t("organizationCard.seeSoftwareDetails", {
                        count: producer?.length
                    })}
                </a>
                <LogoURLButton
                    url={url}
                    label={"Site"}
                    priority="secondary"
                ></LogoURLButton>
                {identifiers?.[0]?.url && url !== identifiers?.[0]?.url && (
                    <LogoURLButton
                        url={identifiers?.[0].url}
                        priority="secondary"
                    ></LogoURLButton>
                )}
                <div className={cx(classes.footerActionsContainer)}>
                    <a className={cx(classes.footerActionLink)} {...softwareDetailsLink}>
                        <i className={fr.cx("fr-icon-arrow-right-line")} />
                    </a>
                </div>
            </div>
        </div>
    );
});

const useStyles = tss
    .withName({ OrganizationCard })
    .withParams<{ isSearchHighlighted: boolean }>()
    .create(({ isSearchHighlighted }) => ({
        root: {
            backgroundColor: fr.colors.decisions.background.default.grey.default,
            "&&&": {
                ...fr.spacing("padding", {
                    topBottom: "7v",
                    rightLeft: "6v"
                }),
                [fr.breakpoints.down("md")]: {
                    ...fr.spacing("padding", {
                        topBottom: "5v",
                        rightLeft: "3v"
                    })
                }
            }
        },
        searchHighlight: {
            fontStyle: "italic",
            color: fr.colors.decisions.text.mention.grey.default,
            "& > span": {
                color: fr.colors.decisions.text.active.blueFrance.default,
                fontWeight: "bold"
            }
        },
        cardBody: {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            marginBottom: fr.spacing("8v")
        },
        headerContainer: {
            display: "flex",
            alignItems: "center",
            marginBottom: fr.spacing("4v"),
            backgroundImage: "unset"
        },
        header: {
            width: "100%"
        },
        logoWrapper: {
            width: fr.spacing("14v"),
            aspectRatio: "auto 1/1",
            marginRight: fr.spacing("3v"),
            overflow: "hidden"
        },
        logo: {
            height: "100%"
        },
        titleContainer: {
            display: "flex",
            justifyContent: "space-between"
        },
        title: {
            margin: 0,
            color: fr.colors.decisions.text.title.grey.default,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: "2",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            fontSize: "20px" // Phone issue ?
        },
        titleActionsContainer: {
            display: "flex",
            alignItems: "center",
            gap: fr.spacing("2v"),
            "&>i": {
                color: fr.colors.decisions.text.title.blueFrance.default,
                "&::before": {
                    "--icon-size": fr.spacing("4v")
                }
            }
        },
        softwareVersionContainer: {
            [fr.breakpoints.down("md")]: {
                fontSize: fr.spacing("2v")
            }
        },
        badgeVersion: {
            ...fr.spacing("margin", { rightLeft: "1v" }),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "30%"
        },
        description: {
            marginTop: 0,
            marginBottom: fr.spacing("3v"),
            color: fr.colors.decisions.text.default.grey.default,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: isSearchHighlighted ? "5" : "3",
            whiteSpace: "pre-wrap"
        },
        detailUsersAndReferents: {
            order: 4,
            marginTop: "auto"
        },
        footer: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            [fr.breakpoints.down("md")]: {
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start"
            }
        },
        declareReferentOrUserButton: {
            [fr.breakpoints.down("md")]: {
                width: "100%",
                justifyContent: "center"
            }
        },
        footerActionsContainer: {
            display: "flex",
            marginLeft: fr.spacing("4v"),
            flex: 1,
            justifyContent: "flex-end",
            color: fr.colors.decisions.text.title.blueFrance.default,
            [fr.breakpoints.down("md")]: {
                marginLeft: 0,
                marginTop: fr.spacing("3v"),
                gap: fr.spacing("4v"),
                alignSelf: "end"
            }
        },
        footerActionLink: {
            background: "none"
        }
    }));
