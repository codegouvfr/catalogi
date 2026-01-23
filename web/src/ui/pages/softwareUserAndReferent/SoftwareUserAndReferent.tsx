// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, useState } from "react";
import { useCore, useCoreState } from "core";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { tss } from "tss-react";
import { fr } from "@codegouvfr/react-dsfr";
import { useGetOrganizationFullName } from "ui/i18n";
import { useTranslation } from "react-i18next";
import { ActionsFooter } from "ui/shared/ActionsFooter";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { PageRoute } from "./route";
import { LoadingFallback } from "ui/shared/LoadingFallback";
import softwareLogoPlaceholder from "ui/assets/software_logo_placeholder.png";
import { routes, getPreviousRouteName, session } from "ui/routes";
import { Tag } from "@codegouvfr/react-dsfr/Tag";

export type Props = {
    className?: string;
    route: PageRoute;
};

export default function SoftwareUserAndReferent(props: Props) {
    const { route, className } = props;

    const { softwareUserAndReferent } = useCore().functions;

    const { isReady, logoUrl, referents, users, softwareId, softwareName } = useCoreState(
        "softwareUserAndReferent",
        "main"
    );

    useEffect(() => {
        softwareUserAndReferent.initialize({ softwareId: route.params.id });

        return () => {
            softwareUserAndReferent.clear();
        };
    }, [route.params.id]);

    const { classes, cx } = useStyles();

    const { t } = useTranslation();

    const [activeMenu, setActiveMenu] = useState(0);

    const { getOrganizationFullName } = useGetOrganizationFullName();

    if (!isReady) {
        return <LoadingFallback />;
    }

    const menuTabs = [
        {
            id: 0,
            name: "referents" as const,
            label: `${t("common.referent", {
                count: referents.length
            })}`
        },
        {
            id: 1,
            name: "users" as const,
            label: `${t("common.user", {
                count: users.length
            })}`
        }
    ];

    const referentEmails = referents.map(({ email }) => email);

    const contentReferent = () => {
        return referents.map(referent => {
            const {
                email,
                isTechnicalExpert,
                organization,
                usecaseDescription,
                serviceUrl
            } = referent;
            return (
                <li key={email}>
                    <p>
                        <a {...routes.userProfile({ email }).link}>{email}</a>
                        {isTechnicalExpert && (
                            <Tag
                                style={{
                                    position: "relative",
                                    top: 4,
                                    marginLeft: fr.spacing("2v")
                                }}
                                iconId="fr-icon-checkbox-circle-line"
                            >
                                {t("softwareUserAndReferent.is technical expert")}
                            </Tag>
                        )}
                    </p>
                    <p>
                        <span className={classes.infoLegend}>
                            {t("softwareUserAndReferent.organization")}
                        </span>
                        : {getOrganizationFullName(organization)}{" "}
                    </p>
                    {usecaseDescription && (
                        <p>
                            <span className={classes.infoLegend}>
                                {t("softwareUserAndReferent.use case")}
                            </span>
                            : {usecaseDescription}
                        </p>
                    )}
                    {serviceUrl && (
                        <p>
                            {t("softwareUserAndReferent.is referent of")}{" "}
                            <a href={serviceUrl}>{serviceUrl}</a>
                        </p>
                    )}
                </li>
            );
        });
    };

    const contentUsers = () => {
        return users.map((user, index) => {
            const { organization, usecaseDescription, serviceUrl } = user;
            return (
                <li key={index}>
                    <p>
                        <span className={classes.infoLegend}>
                            {t("softwareUserAndReferent.organization")}
                        </span>
                        : {getOrganizationFullName(organization)}{" "}
                    </p>
                    {usecaseDescription && (
                        <p>
                            <span className={classes.infoLegend}>
                                {t("softwareUserAndReferent.use case")}
                            </span>
                            : {usecaseDescription}
                        </p>
                    )}
                    {serviceUrl !== undefined && (
                        <p>
                            <span className={classes.infoLegend}>
                                {t("softwareUserAndReferent.is user of")}{" "}
                            </span>
                            <a href={serviceUrl} target="_blank" rel="noreferrer">
                                {serviceUrl}
                            </a>
                        </p>
                    )}
                </li>
            );
        });
    };

    return (
        <div>
            <div className={cx(fr.cx("fr-container"), className)}>
                <Breadcrumb
                    segments={[
                        {
                            linkProps: {
                                ...routes.softwareCatalog().link
                            },
                            label: t("softwareUserAndReferent.catalog breadcrumb")
                        },
                        {
                            linkProps: routes.softwareDetails({
                                id: softwareId
                            }).link,
                            label: softwareName
                        }
                    ]}
                    currentPageLabel={t(
                        "softwareUserAndReferent.user and referent breadcrumb"
                    )}
                    className={classes.breadcrumb}
                />
                <div className={classes.header}>
                    {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                    <a
                        href={"#"}
                        onClick={() => {
                            const previousRouteName = getPreviousRouteName();

                            if (
                                previousRouteName === "softwareCatalog" ||
                                previousRouteName === undefined
                            ) {
                                //Restore scroll position
                                session.back();
                                return;
                            }

                            routes.softwareCatalog().push();
                        }}
                        className={classes.backButton}
                    >
                        <i className={fr.cx("fr-icon-arrow-left-s-line")} />
                    </a>
                    <h4 className={classes.title}>
                        {t("softwareUserAndReferent.title")}
                    </h4>
                </div>
                <div className={classes.main}>
                    <nav
                        className={cx(fr.cx("fr-sidemenu"), classes.sidemenu)}
                        aria-labelledby="fr-sidemenu-title"
                    >
                        <div className={fr.cx("fr-sidemenu__inner")}>
                            <button
                                className={fr.cx("fr-sidemenu__btn")}
                                hidden
                                aria-controls="fr-sidemenu-wrapper"
                                aria-expanded="false"
                            >
                                {t("softwareUserAndReferent.category")} (
                                {activeMenu === 0
                                    ? t("common.referent", {
                                          count: referents.length
                                      })
                                    : t("common.user", {
                                          count: users.length
                                      })}
                                )
                            </button>
                            <div
                                className={fr.cx("fr-collapse")}
                                id="fr-sidemenu-wrapper"
                            >
                                <div
                                    className={cx(
                                        fr.cx("fr-sidemenu__title"),
                                        classes.sidemenuTitle
                                    )}
                                    id="fr-sidemenu-title"
                                >
                                    <div className={classes.logoWrapper}>
                                        <img
                                            className={classes.logo}
                                            src={logoUrl ?? softwareLogoPlaceholder}
                                            alt="Logo du logiciel"
                                        />
                                    </div>
                                    {softwareName}
                                </div>
                                <ul className={fr.cx("fr-sidemenu__list")}>
                                    {menuTabs.map(tab => {
                                        const ariaCurrent =
                                            tab.id === activeMenu
                                                ? {
                                                      "aria-current": "step" as const
                                                  }
                                                : {
                                                      "aria-current": undefined
                                                  };

                                        return (
                                            <li
                                                className={cx(
                                                    fr.cx("fr-sidemenu__item"),
                                                    {
                                                        "fr-sidemenu__item--active":
                                                            tab.id === activeMenu
                                                    }
                                                )}
                                                key={tab.id}
                                            >
                                                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                                                <a
                                                    className={cx(
                                                        fr.cx("fr-sidemenu__link"),
                                                        classes.sidemenuItemFlex
                                                    )}
                                                    href="#"
                                                    target="_self"
                                                    {...ariaCurrent}
                                                    onClick={() => setActiveMenu(tab.id)}
                                                >
                                                    <div>{tab.label}</div>
                                                    {tab.name === "referents" &&
                                                        referentEmails.length > 0 && (
                                                            <div>
                                                                <a
                                                                    className={fr.cx(
                                                                        "fr-icon-mail-line"
                                                                    )}
                                                                    href={`mailto:${referentEmails.join(
                                                                        ","
                                                                    )}`}
                                                                >
                                                                    &nbsp;
                                                                </a>
                                                            </div>
                                                        )}
                                                </a>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    </nav>
                    <div className={classes.contentMenuTab}>
                        <ul>{activeMenu === 0 ? contentReferent() : contentUsers()}</ul>
                    </div>
                </div>
            </div>
            <ActionsFooter className={classes.container}>
                <Button
                    iconId="fr-icon-eye-line"
                    priority="secondary"
                    className={classes.softwareDetails}
                    {...routes.softwareDetails({ id: softwareId }).link}
                >
                    {t("softwareUserAndReferent.softwareDetails")}
                </Button>
                <Button
                    priority="primary"
                    linkProps={
                        routes.declarationForm({
                            id: softwareId,
                            declarationType: activeMenu === 0 ? "referent" : "user"
                        }).link
                    }
                >
                    {activeMenu === 0
                        ? t("softwareUserAndReferent.declare referent")
                        : t("softwareUserAndReferent.declare user")}
                </Button>
            </ActionsFooter>
        </div>
    );
}

const useStyles = tss.withName({ SoftwareUserAndReferent }).create({
    breadcrumb: {
        marginBottom: fr.spacing("4v")
    },
    header: {
        display: "flex",
        alignItems: "center",
        marginBottom: fr.spacing("10v")
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
    title: {
        marginBottom: 0
    },
    main: {
        display: "flex",
        [fr.breakpoints.down("md")]: {
            flexDirection: "column"
        }
    },
    sidemenu: {
        flex: 1
    },
    sidemenuTitle: {
        display: "flex",
        alignItems: "center"
    },
    sidemenuItemFlex: {
        display: "flex",
        justifyContent: "space-between"
    },
    logoWrapper: {
        height: fr.spacing("10v"),
        width: fr.spacing("10v"),
        minWidth: fr.spacing("10v"),
        marginRight: fr.spacing("2v"),
        overflow: "hidden",
        [fr.breakpoints.down("md")]: {
            height: fr.spacing("5v"),
            width: fr.spacing("5v")
        }
    },
    logo: {
        height: "100%"
    },
    contentMenuTab: {
        flex: 2
    },
    container: {
        display: "flex",
        alignItems: "center",
        justifyContent: "end"
    },
    softwareDetails: {
        marginRight: fr.spacing("4v"),
        "&&::before": {
            "--icon-size": fr.spacing("6v")
        }
    },
    infoLegend: {
        color: fr.colors.decisions.text.mention.grey.default
    }
});
