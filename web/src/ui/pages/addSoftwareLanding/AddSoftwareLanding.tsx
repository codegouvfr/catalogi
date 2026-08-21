// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { tss } from "tss-react";
import { assert } from "tsafe/assert";
import type { Equals } from "tsafe";
import { Trans, useTranslation } from "react-i18next";
import type { PageRoute } from "./route";
import { routes } from "ui/routes";
import { fr } from "@codegouvfr/react-dsfr";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import illustration_sill from "ui/assets/illustration_sill.svg";
import { useCoreState } from "core";
import { SoftwareCreationRestrictedAlert } from "ui/shared/SoftwareCreationRestrictedAlert";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function AddSoftwareLanding(props: Props) {
    const { className, route, ...rest } = props;

    assert<Equals<typeof rest, {}>>();

    const { cx, classes } = useStyles();
    const { t } = useTranslation();
    const { currentUser } = useCoreState("userAuthentication", "currentUser");
    const uiConfig = useCoreState("uiConfig", "main")?.uiConfig;

    const isCreationForbidden =
        uiConfig?.home.usecases.addSoftwareOrService.enabled === false &&
        currentUser?.role !== "admin";

    if (isCreationForbidden) {
        return <SoftwareCreationRestrictedAlert className={className} />;
    }

    const whoCanAddAccordionList = [
        {
            label: t("addSoftwareLanding.discover as agent label"),
            description: (
                <Trans i18nKey={"addSoftwareLanding.discover as agent description"} />
            )
        },
        {
            label: t("addSoftwareLanding.discover as DSI label"),
            description: (
                <Trans i18nKey={"addSoftwareLanding.discover as DSI description"} />
            )
        },
        {
            label: t("addSoftwareLanding.contribute as agent label"),
            description: (
                <Trans i18nKey={"addSoftwareLanding.contribute as agent description"} />
            )
        },
        {
            label: t("addSoftwareLanding.contribute as DSI label"),
            description: (
                <Trans i18nKey={"addSoftwareLanding.contribute as DSI description"} />
            )
        }
    ];

    return (
        <div className={className}>
            <div className={classes.section}>
                <div className={cx(fr.cx("fr-container"), classes.titleContainer)}>
                    <div>
                        <h2 className={classes.title}>
                            <Trans
                                i18nKey={"addSoftwareLanding.title"}
                                components={{ span: <span /> }}
                            />
                        </h2>
                        <p className={fr.cx("fr-text--lg")}>
                            {t("addSoftwareLanding.subtitle")}
                        </p>
                    </div>
                    <img
                        src={illustration_sill}
                        alt="Illustration du SILL"
                        className={classes.clipart}
                    />
                </div>
            </div>
            <section className={cx(classes.whoCanAddBackground, classes.section)}>
                <div className={fr.cx("fr-container")}>
                    <div
                        className={cx(
                            classes.titleSection,
                            classes.whoCanAddHeaderContainer
                        )}
                    >
                        <h2 className={classes.whoCanAddTitle}>
                            {t("addSoftwareLanding.who can add software")}
                        </h2>
                        <div className={classes.whoCanAddButtonContainer}>
                            <a
                                {...routes.softwareCreationForm().link}
                                className={fr.cx("fr-btn")}
                            >
                                {t("app.add software")}
                            </a>
                            <a
                                {...routes.instanceCreationForm().link}
                                className={fr.cx("fr-btn", "fr-btn--secondary")}
                            >
                                {t("app.add instance")}
                            </a>
                        </div>
                    </div>

                    {whoCanAddAccordionList.map(accordion => (
                        <Accordion key={accordion.label} label={accordion.label}>
                            <p className={classes.accordionDescription}>
                                {accordion.description}
                            </p>
                        </Accordion>
                    ))}
                </div>
            </section>
        </div>
    );
}

const useStyles = tss.withName({ AddSoftwareLanding }).create({
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
        }
    },
    titleContainer: {
        marginBottom: fr.spacing("10v"),
        display: "flex",
        [fr.breakpoints.down("md")]: {
            flexDirection: "column"
        }
    },
    title: {
        marginRight: fr.spacing("30v"),
        "&>span": {
            color: fr.colors.decisions.text.title.blueFrance.default
        },
        [fr.breakpoints.down("md")]: {
            ...fr.spacing("margin", {
                right: 0,
                bottom: "8v"
            })
        }
    },
    clipart: {
        [fr.breakpoints.down("md")]: {
            width: "50%",
            margin: "0 auto"
        }
    },
    whoCanAddBackground: {
        backgroundColor: fr.colors.decisions.background.alt.blueFrance.default
    },
    whoCanAddHeaderContainer: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("2v"),
        [fr.breakpoints.down("md")]: {
            gap: fr.spacing("8v"),
            flexDirection: "column"
        }
    },
    whoCanAddTitle: {
        marginBottom: 0
    },
    whoCanAddButtonContainer: {
        display: "flex",
        gap: fr.spacing("2v"),
        whiteSpace: "nowrap",
        [fr.breakpoints.down("md")]: {
            whiteSpace: "normal"
        }
    },
    accordionDescription: {
        marginBottom: 0
    }
});
