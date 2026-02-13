// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Organization } from "api/dist/src/lib/ApiTypes";
import { memo } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";
import { useTranslation } from "react-i18next";
import { useCoreState } from "../../../core";
import { Link } from "type-route";

export type Props = {
    className?: string;
    organization: Organization;
    countSoftware: number;
    organizationListLink: Link;
};

export const OrganizationCard = memo(
    ({ className, organization, countSoftware, organizationListLink }: Props) => {
        const { name, url, identifiers } = organization;

        const { t } = useTranslation();
        const ui = useCoreState("uiConfig", "main");

        const searchHighlight = true;
        const { classes, cx } = useStyles({
            isSearchHighlighted:
                searchHighlight !== undefined ||
                !ui?.uiConfig.catalog.cardOptions.referentCount
        });

        return (
            <div className={cx(fr.cx("fr-card"), classes.root, className)}>
                <div className={classes.cardBody}>
                    <a className={cx(classes.headerContainer)} {...organizationListLink}>
                        <div className={cx(classes.header)}>
                            <div className={cx(classes.titleContainer)}>
                                <h3 className={cx(classes.title)}>
                                    {name} ({countSoftware})
                                </h3>
                                <div className={cx(classes.titleActionsContainer)}></div>
                            </div>
                        </div>
                    </a>
                </div>
                <div className={classes.footer}>
                    <div className={cx(classes.footerActionsContainer)}>
                        <a
                            className={cx(classes.footerActionLink)}
                            {...organizationListLink}
                        >
                            <i className={fr.cx("fr-icon-arrow-right-line")} />
                        </a>
                    </div>
                </div>
            </div>
        );
    }
);

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
            WebkitLineClamp: "1",
            whiteSpace: "pre-wrap",
            overflow: "hidden"
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
