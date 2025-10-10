// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { memo } from "react";
import { useLang } from "ui/i18n";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import { assert } from "tsafe/assert";
import type { Equals } from "tsafe";
import { fr } from "@codegouvfr/react-dsfr";
import { getFormattedDate } from "ui/datetimeUtils";
import type { ApiTypes } from "api";
import { Popover } from "@mui/material";
import React from "react";
import { AuthorCard } from "ui/shared/AuthorCard";
import { LogoURLButton } from "ui/shared/LogoURLButton";
import { useCoreState } from "../../../core";

export type Props = {
    className?: string;
    softwareLogoUrl?: string;
    softwareName: string;
    softwareDereferencing:
        | {
              reason?: string;
              time: number;
              lastRecommendedVersion?: string;
          }
        | undefined;
    authors: Array<ApiTypes.Person | ApiTypes.Organization>;
    officialWebsite?: string;
    documentationWebsite?: string;
    sourceCodeRepository?: string;
    onGoBackClick: () => void;
    userDeclaration:
        | {
              isUser: boolean;
              isReferent: boolean;
          }
        | undefined;
};

export const HeaderDetailCard = memo((props: Props) => {
    const {
        className,
        softwareLogoUrl,
        softwareName,
        authors,
        officialWebsite,
        documentationWebsite,
        sourceCodeRepository,
        onGoBackClick,
        userDeclaration,
        softwareDereferencing,
        ...rest
    } = props;
    const { uiConfig } = useCoreState("uiConfig", "main")!;

    assert<Equals<typeof rest, {}>>();

    const { classes, cx } = useStyles();

    const { t } = useTranslation();

    const { lang } = useLang();

    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

    const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(anchorEl ? null : event.currentTarget);
    };

    const handlePopoverClose = () => {
        setAnchorEl(null);
    };

    const open = (id: string) => {
        return anchorEl?.id?.slice(2) === id || anchorEl?.id === id;
    };

    return (
        <div className={cx(classes.root, className)}>
            <div className={classes.leftCol}>
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a href={"#"} onClick={onGoBackClick} className={classes.backButton}>
                    <i className={fr.cx("fr-icon-arrow-left-s-line")} />
                </a>
                <div className={classes.softwareInformation}>
                    {softwareLogoUrl && (
                        <div className={classes.logoWrapper}>
                            <img
                                className={classes.logo}
                                src={softwareLogoUrl}
                                alt={t("headerDetailCard.software logo")}
                            />
                        </div>
                    )}
                    <div className={classes.mainInfo}>
                        <div className={classes.titleAndTagWrapper}>
                            <h4 className={classes.softwareName}>{softwareName}</h4>
                            &nbsp; &nbsp;
                            {userDeclaration?.isReferent ? (
                                <span
                                    className={fr.cx(
                                        "fr-badge--no-icon",
                                        "fr-badge--blue-cumulus",
                                        "fr-badge",
                                        "fr-badge--sm",
                                        "fr-mb-1v"
                                    )}
                                >
                                    {t("headerDetailCard.you are referent")}
                                </span>
                            ) : userDeclaration?.isUser ? (
                                <span
                                    className={fr.cx(
                                        "fr-badge--no-icon",
                                        "fr-badge--green-archipel",
                                        "fr-badge",
                                        "fr-badge--sm",
                                        "fr-mb-1v"
                                    )}
                                >
                                    {t("headerDetailCard.you are user")}
                                </span>
                            ) : null}
                        </div>
                        {authors.length > 0 && (
                            <div>
                                <span className={classes.authors}>
                                    {t("headerDetailCard.authors")}
                                </span>
                                <span>
                                    {authors.map(author => (
                                        <React.Fragment key={author.name}>
                                            {(!uiConfig?.softwareDetails.authorCard ||
                                                author["@type"] === "Organization" ||
                                                (author["@type"] === "Person" &&
                                                    (!author.affiliations ||
                                                        author.affiliations?.length <=
                                                            0))) && (
                                                <a
                                                    href={
                                                        author.url ??
                                                        author?.identifiers?.[0]?.url?.toString()
                                                    }
                                                    className={classes.authorLink}
                                                    key={author.name}
                                                >
                                                    {author.name}
                                                </a>
                                            )}

                                            {uiConfig?.softwareDetails.authorCard &&
                                                author["@type"] === "Person" &&
                                                author.affiliations &&
                                                author.affiliations?.length > 0 && (
                                                    <>
                                                        <button
                                                            id={`a-popover-${author.name}`}
                                                            className={classes.authorLink}
                                                            key={author.name}
                                                            onClick={handlePopoverOpen}
                                                        >
                                                            {author.name}
                                                        </button>

                                                        <Popover
                                                            id={`popover-${author.name}`}
                                                            open={open(
                                                                `popover-${author.name}`
                                                            )}
                                                            sx={{ pointerEvents: "auto" }}
                                                            anchorEl={anchorEl}
                                                            onClose={handlePopoverClose}
                                                            anchorOrigin={{
                                                                vertical: "bottom",
                                                                horizontal: "left"
                                                            }}
                                                            transformOrigin={{
                                                                vertical: "top",
                                                                horizontal: "left"
                                                            }}
                                                            disableRestoreFocus
                                                        >
                                                            <AuthorCard
                                                                author={author}
                                                                handleClose={
                                                                    handlePopoverClose
                                                                }
                                                            />
                                                        </Popover>
                                                    </>
                                                )}
                                        </React.Fragment>
                                    ))}
                                </span>
                            </div>
                        )}
                        {softwareDereferencing !== undefined && (
                            <>
                                &nbsp; &nbsp;
                                <p className={classes.dereferencedText}>
                                    {t("headerDetailCard.software dereferenced", {
                                        when: getFormattedDate({
                                            time: softwareDereferencing.time,
                                            lang,
                                            doAlwaysShowYear: true
                                        })
                                    })}
                                    {softwareDereferencing.reason === undefined
                                        ? ""
                                        : `, ${softwareDereferencing.reason}`}
                                    {t(
                                        "headerDetailCard.software dereferenced last version",
                                        {
                                            lastRecommendedVersion:
                                                softwareDereferencing.lastRecommendedVersion
                                        }
                                    )}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className={classes.externalLinkButtons}>
                {officialWebsite && (
                    <LogoURLButton
                        iconId={"fr-icon-global-line"}
                        className={cx(fr.cx("fr-ml-4v", "fr-my-2v"))}
                        priority="secondary"
                        url={officialWebsite}
                        label={t("headerDetailCard.website")}
                    />
                )}
                {documentationWebsite && (
                    <LogoURLButton
                        iconId={"fr-icon-book-2-line"}
                        className={cx(fr.cx("fr-ml-4v", "fr-my-2v"))}
                        priority="secondary"
                        url={documentationWebsite}
                        label={t("headerDetailCard.documentation")}
                    />
                )}
                {sourceCodeRepository && (
                    <LogoURLButton
                        iconId={"fr-icon-code-s-slash-line"}
                        className={cx(fr.cx("fr-ml-4v", "fr-my-2v"))}
                        priority="secondary"
                        url={sourceCodeRepository}
                        label={t("headerDetailCard.repository")}
                    />
                )}
            </div>
        </div>
    );
});

const useStyles = tss.withName({ HeaderDetailCard }).create({
    root: {
        display: "grid",
        gridTemplateColumns: `repeat(2, 1fr)`,
        columnGap: fr.spacing("6v"),
        marginBottom: fr.spacing("6v"),
        [fr.breakpoints.down("md")]: {
            gridTemplateColumns: `repeat(1, 1fr)`,
            gridRowGap: fr.spacing("6v")
        }
    },
    leftCol: {
        display: "flex",
        alignItems: "center"
    },
    backButton: {
        background: "none",
        marginRight: fr.spacing("4v"),

        "&>i": {
            "&::before": {
                "--icon-size": fr.spacing("8v")
            }
        }
    },
    softwareInformation: {
        display: "flex",
        flex: "1"
    },
    mainInfo: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center"
    },
    titleAndTagWrapper: {
        display: "flex",
        alignItems: "center"
    },
    logoWrapper: {
        minWidth: 65,
        width: fr.spacing("14v"),
        height: fr.spacing("14v"),
        marginRight: fr.spacing("3v"),
        overflow: "hidden"
    },
    logo: {
        height: "100%"
    },
    softwareName: {
        marginBottom: fr.spacing("1v")
    },
    authors: {
        color: fr.colors.decisions.text.mention.grey.default
    },
    authorLink: {
        marginRight: fr.spacing("2v"),
        color: fr.colors.decisions.text.actionHigh.blueFrance.default
    },
    externalLinkButtons: {
        display: "flex",
        alignItems: "center",
        justifyContent: "end",
        flexWrap: "wrap"
    },
    dereferencedText: {
        color: fr.colors.decisions.text.default.error.default
    }
});
