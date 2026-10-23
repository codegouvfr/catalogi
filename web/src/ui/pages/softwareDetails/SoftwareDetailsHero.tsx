// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Button, type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import { Popover } from "@mui/material";
import { useCoreState } from "core";
import { useLang } from "ui/i18n";
import { getFormattedDate } from "ui/datetimeUtils";
import { routes, getPreviousRouteName, session } from "ui/routes";
import { AuthorCard } from "ui/shared/AuthorCard";
import type { State as SoftwareDetailsState } from "core/usecases/softwareDetails";

type Props = {
    software: Pick<
        SoftwareDetailsState.Software,
        | "name"
        | "description"
        | "authors"
        | "url"
        | "softwareHelp"
        | "codeRepositoryUrl"
        | "dereferencing"
    >;
    logoUrl: string | undefined;
    userDeclaration: SoftwareDetailsState.Ready["userDeclaration"];
    /** Undefined when user actions are disabled for this instance */
    editButton: ButtonProps | undefined;
    /** Undefined when no source has data for this software */
    onShowSourcesClick: (() => void) | undefined;
};

export const SoftwareDetailsHero = (props: Props) => {
    const { software, logoUrl, userDeclaration, editButton, onShowSourcesClick } = props;
    const {
        name,
        description,
        authors,
        url,
        softwareHelp,
        codeRepositoryUrl,
        dereferencing
    } = software;

    const { t } = useTranslation();
    const { lang } = useLang();
    const { classes, cx } = useStyles();

    // A broken logo url would otherwise leave an empty box and its alt text in the hero
    const [hasLogoFailed, setHasLogoFailed] = useState(false);

    // DSFR asks for the "new window" mention on links opening a new tab
    const getExternalLinkButton = (params: {
        label: string;
        href: string;
    }): ButtonProps => ({
        children: params.label,
        linkProps: {
            href: params.href,
            target: "_blank",
            rel: "noreferrer",
            title: `${params.label} - ${t("softwareDetails.new window")}`
        }
    });

    const buttons: ButtonProps[] = [
        ...(url === undefined
            ? []
            : [
                  getExternalLinkButton({
                      label: t("softwareDetails.official website"),
                      href: url
                  })
              ]),
        ...(softwareHelp === undefined
            ? []
            : [
                  {
                      ...getExternalLinkButton({
                          label: t("softwareDetails.documentation"),
                          href: softwareHelp
                      }),
                      priority: "secondary" as const
                  }
              ]),
        ...(codeRepositoryUrl === undefined
            ? []
            : [
                  {
                      ...getExternalLinkButton({
                          label: t("softwareDetails.source code"),
                          href: codeRepositoryUrl
                      }),
                      priority: "secondary" as const
                  }
              ]),
        ...(editButton === undefined ? [] : [editButton])
    ];

    const catalogLink = routes.softwareCatalog().link;

    return (
        // DSFR buttons of a group already have a 4v bottom margin, hence 12v for 16v
        <div className={cx(fr.cx("fr-pb-12v"), classes.root)}>
            <div className={fr.cx("fr-container")}>
                <Breadcrumb
                    className={fr.cx("fr-mt-16v", "fr-mb-8v")}
                    homeLinkProps={routes.home().link}
                    segments={[
                        {
                            linkProps: {
                                ...catalogLink,
                                onClick: event => {
                                    // Going back restores the catalog scroll position
                                    if (getPreviousRouteName() === "softwareCatalog") {
                                        event.preventDefault();
                                        session.back();
                                        return;
                                    }
                                    catalogLink.onClick(event);
                                }
                            },
                            label: t("softwareDetails.catalog breadcrumb")
                        }
                    ]}
                    currentPageLabel={name}
                />
                <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
                    <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
                        <div className={cx(fr.cx("fr-mb-8v"), classes.titleRow)}>
                            <h1 className={classes.title}>{name}</h1>
                            {onShowSourcesClick !== undefined && (
                                <Button
                                    iconId="fr-icon-information-line"
                                    priority="tertiary no outline"
                                    title={t("headerDetailCard.openSourceProvenance")}
                                    onClick={onShowSourcesClick}
                                />
                            )}
                        </div>
                        {userDeclaration?.isReferent ? (
                            <Badge
                                noIcon
                                small
                                className={fr.cx("fr-badge--blue-cumulus", "fr-mb-8v")}
                            >
                                {t("headerDetailCard.you are referent")}
                            </Badge>
                        ) : userDeclaration?.isUser ? (
                            <Badge
                                noIcon
                                small
                                className={fr.cx("fr-badge--green-archipel", "fr-mb-8v")}
                            >
                                {t("headerDetailCard.you are user")}
                            </Badge>
                        ) : null}
                        <p className={fr.cx("fr-text--lead", "fr-mb-8v")}>
                            {description}
                        </p>
                        {authors.length > 0 && <Authors authors={authors} />}
                        {dereferencing !== undefined && (
                            <Alert
                                className={fr.cx("fr-mb-8v")}
                                severity="warning"
                                small
                                description={
                                    t("headerDetailCard.software dereferenced", {
                                        when: getFormattedDate({
                                            time: dereferencing.time,
                                            lang,
                                            doAlwaysShowYear: true
                                        })
                                    }) +
                                    (dereferencing.reason === undefined
                                        ? ""
                                        : `, ${dereferencing.reason}`) +
                                    t(
                                        "headerDetailCard.software dereferenced last version",
                                        {
                                            lastRecommendedVersion:
                                                dereferencing.lastRecommendedVersion
                                        }
                                    )
                                }
                            />
                        )}
                        {buttons.length > 0 && (
                            <ButtonsGroup
                                inlineLayoutWhen="md and up"
                                buttonsIconPosition="right"
                                buttons={buttons as [ButtonProps, ...ButtonProps[]]}
                            />
                        )}
                    </div>
                    {logoUrl !== undefined && !hasLogoFailed && (
                        <div
                            className={cx(
                                fr.cx("fr-col-12", "fr-col-md-4"),
                                classes.logoColumn
                            )}
                        >
                            {/* Decorative, the software name is the title next to it */}
                            <img
                                className={classes.logo}
                                src={logoUrl}
                                alt=""
                                onError={() => setHasLogoFailed(true)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Authors = (props: { authors: SoftwareDetailsState.Software["authors"] }) => {
    const { authors } = props;

    const { t } = useTranslation();
    const { classes } = useStyles();
    const { uiConfig } = useCoreState("uiConfig", "main")!;

    const [openedAuthorCard, setOpenedAuthorCard] = useState<
        { authorName: string; anchorEl: HTMLElement } | undefined
    >(undefined);

    const closeAuthorCard = () => setOpenedAuthorCard(undefined);

    return (
        <p className={fr.cx("fr-mb-8v")}>
            <span className={classes.authorsLabel}>{t("headerDetailCard.authors")}</span>
            {authors.map((author, index) => (
                <Fragment key={author.name}>
                    {index > 0 && ", "}
                    {uiConfig.softwareDetails.authorCard &&
                    author["@type"] === "Person" &&
                    author.affiliations !== undefined &&
                    author.affiliations.length > 0 ? (
                        <>
                            <button
                                type="button"
                                className={fr.cx("fr-link")}
                                aria-expanded={
                                    openedAuthorCard?.authorName === author.name
                                }
                                onClick={event =>
                                    setOpenedAuthorCard(
                                        openedAuthorCard?.authorName === author.name
                                            ? undefined
                                            : {
                                                  authorName: author.name,
                                                  anchorEl: event.currentTarget
                                              }
                                    )
                                }
                            >
                                {author.name}
                            </button>
                            <Popover
                                open={openedAuthorCard?.authorName === author.name}
                                anchorEl={openedAuthorCard?.anchorEl}
                                onClose={closeAuthorCard}
                                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                                transformOrigin={{ vertical: "top", horizontal: "left" }}
                            >
                                <AuthorCard
                                    author={author}
                                    handleClose={closeAuthorCard}
                                />
                            </Popover>
                        </>
                    ) : (
                        <AuthorLink author={author} />
                    )}
                </Fragment>
            ))}
        </p>
    );
};

const AuthorLink = (props: {
    author: SoftwareDetailsState.Software["authors"][number];
}) => {
    const { author } = props;
    const href = author.url ?? author.identifiers?.[0]?.url?.toString();

    if (href === undefined) return <>{author.name}</>;

    return (
        <a className={fr.cx("fr-link")} href={href}>
            {author.name}
        </a>
    );
};

const useStyles = tss.withName({ SoftwareDetailsHero }).create({
    root: {
        borderBottom: `1px solid ${fr.colors.decisions.border.default.grey.default}`
    },
    titleRow: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("2v")
    },
    title: {
        marginBottom: 0
    },
    authorsLabel: {
        color: fr.colors.decisions.text.mention.grey.default
    },
    logoColumn: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        [fr.breakpoints.down("md")]: {
            order: -1,
            justifyContent: "flex-start"
        }
    },
    logo: {
        width: fr.spacing("32v"),
        height: fr.spacing("32v"),
        objectFit: "contain",
        [fr.breakpoints.down("md")]: {
            width: fr.spacing("16v"),
            height: fr.spacing("16v")
        }
    }
});
