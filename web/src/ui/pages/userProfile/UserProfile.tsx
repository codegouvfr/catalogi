// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { assert } from "tsafe/assert";
import { Equals } from "tsafe";
import { useCore, useCoreState } from "core";
import type { PageRoute } from "./route";
import { LoadingFallback } from "ui/shared/LoadingFallback";
import { tss } from "tss-react";
import { fr } from "@codegouvfr/react-dsfr";
import Markdown from "react-markdown";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { routes, session, getPreviousRouteName } from "ui/routes";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Tag } from "@codegouvfr/react-dsfr/Tag";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function UserProfile(props: Props) {
    const { className, route, ...rest } = props;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { userProfile } = useCore().functions;
    const { isReady, profile, softwares } = useCoreState("userProfile", "main");
    const { allSoftwares } = useCoreState("softwareCatalog", "main");

    const softwareIdByName = Object.fromEntries(
        allSoftwares.map(s => [s.softwareName, s.id])
    );

    useEffect(() => {
        userProfile.initialize({ email: route.params.email });

        return () => {
            userProfile.clear();
        };
    }, [route.params.email]);

    const { t } = useTranslation();

    const { cx, classes } = useStyles();

    if (!isReady) {
        return <LoadingFallback />;
    }

    return (
        <div className={cx(fr.cx("fr-container"), className)}>
            <Breadcrumb
                currentPageLabel={`${profile.email} - ${profile.organization}`}
                homeLinkProps={routes.home().link}
                segments={[
                    {
                        label: "Users",
                        linkProps: {}
                    }
                ]}
            />
            <div className={classes.header}>
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a
                    href={"#"}
                    onClick={() => {
                        const previousRouteName = getPreviousRouteName();

                        if (previousRouteName === false) {
                            routes.softwareCatalog().push();
                            return;
                        }

                        session.back();
                    }}
                    className={classes.headerBackButton}
                >
                    <i className={fr.cx("fr-icon-arrow-left-s-line")} />
                </a>
                <h4 className={classes.headerTitle}>
                    {t("userProfile.agent profile", {
                        email: profile.email,
                        organization: profile.organization
                    })}
                </h4>
                {profile.isHimself && (
                    <Button
                        className={classes.editProfileButton}
                        iconId="ri-pencil-line"
                        priority="secondary"
                        linkProps={routes.account().link}
                    >
                        {t("userProfile.edit my profile")}
                    </Button>
                )}
            </div>
            <div className={classes.softwareListing}>
                {softwares.map(
                    ({
                        softwareName,
                        isReferent,
                        isUser,
                        isTechnicalExpert,
                        usecaseDescription
                    }) => (
                        <p>
                            <a
                                {...routes.softwareDetails({
                                    id: softwareIdByName[softwareName]
                                }).link}
                            >
                                {softwareName}
                            </a>
                            &nbsp;
                            <Tag
                                style={{
                                    position: "relative",
                                    top: 4,
                                    marginLeft: fr.spacing("2v")
                                }}
                                iconId="fr-icon-checkbox-circle-line"
                            >
                                {isReferent && isTechnicalExpert
                                    ? t("userProfile.badge text_expert")
                                    : isReferent
                                      ? t("userProfile.badge text_referent")
                                      : isUser
                                        ? t("userProfile.badge text_user")
                                        : ""}
                            </Tag>
                            <Markdown className={classes.usecaseDescription}>
                                {usecaseDescription}
                            </Markdown>
                        </p>
                    )
                )}
            </div>
            {profile.about !== undefined ? (
                <Markdown>{profile.about}</Markdown>
            ) : (
                <p>{t("userProfile.no description")}</p>
            )}
            <div className={classes.sendEmailButtonWrapper}>
                <Button
                    linkProps={{
                        href: `mailto:${profile.email}`
                    }}
                >
                    {t("userProfile.send email")}
                </Button>
            </div>
        </div>
    );
}

const useStyles = tss.withName({ UserProfile }).create({
    header: {
        display: "flex",
        alignItems: "center",
        marginBottom: fr.spacing("10v")
    },
    headerTitle: {
        marginBottom: 0
    },
    headerBackButton: {
        background: "none",
        marginRight: fr.spacing("4v"),
        "&>i": {
            "&::before": {
                "--icon-size": fr.spacing("8v")
            }
        }
    },
    editProfileButton: {
        marginLeft: fr.spacing("4v")
    },
    sendEmailButtonWrapper: {
        ...fr.spacing("margin", { topBottom: "15v" }),
        display: "flex",
        justifyContent: "center"
    },
    softwareListing: {
        marginBottom: fr.spacing("10v")
    },
    usecaseDescription: {
        marginTop: fr.spacing("4v")
    }
});
