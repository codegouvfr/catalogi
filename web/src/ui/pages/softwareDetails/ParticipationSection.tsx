// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import { useCore, useCoreState } from "core";
import type { State as SoftwareDetailsState } from "core/usecases/softwareDetails";
import { routes } from "ui/routes";
import { DetailUsersAndReferents } from "ui/shared/DetailUsersAndReferents";
import { openDeclarationRemovalModal } from "ui/shared/DeclarationRemovalModal";
import { openSoftwareProtectionModal } from "ui/shared/SoftwareProtectionModal";

type Props = {
    software: SoftwareDetailsState.Software;
    userDeclaration: SoftwareDetailsState.Ready["userDeclaration"];
    isUnreferencingOngoing: boolean;
    isDereferencingProtected: boolean;
};

export const ParticipationSection = (props: Props) => {
    const {
        software,
        userDeclaration,
        isUnreferencingOngoing,
        isDereferencingProtected
    } = props;

    const { softwareDetails, userAuthentication } = useCore().functions;
    const { currentUser } = useCoreState("userAuthentication", "currentUser");
    const { t } = useTranslation();
    const { classes, cx } = useStyles();

    const declarationType = userDeclaration?.isReferent
        ? "referent"
        : userDeclaration?.isUser
          ? "user"
          : undefined;

    const onUnreferenceClick = () => {
        if (!currentUser) {
            userAuthentication.login();
            return;
        }

        if (isDereferencingProtected) {
            openSoftwareProtectionModal({
                type: "dereferencing",
                reason: software.protections?.dereferencing?.reason
            });
            return;
        }

        const userInput = window.prompt(
            t("softwareDetails.please provide a reason for unreferencing this software")
        );

        if (userInput === null || userInput === "") {
            return;
        }

        softwareDetails.unreference({ reason: userInput });
    };

    return (
        <>
            <DetailUsersAndReferents
                className={cx(fr.cx("fr-text--lg"), classes.usersAndReferents)}
                seeUserAndReferent={
                    software.referentCount > 0 || software.userCount > 0
                        ? routes.softwareUsersAndReferents({ id: software.id }).link
                        : undefined
                }
                referentCount={software.referentCount}
                userCount={software.userCount}
            />
            <div className={classes.buttons}>
                {declarationType === undefined ? (
                    <Button linkProps={routes.declarationForm({ id: software.id }).link}>
                        {t("softwareDetails.declare referent")}
                    </Button>
                ) : (
                    <>
                        {declarationType === "user" && (
                            <Button
                                linkProps={
                                    routes.declarationForm({
                                        id: software.id,
                                        declarationType: "referent"
                                    }).link
                                }
                            >
                                {t("softwareDetails.become referent")}
                            </Button>
                        )}
                        <Button
                            priority="secondary"
                            onClick={() =>
                                openDeclarationRemovalModal({
                                    declarationType,
                                    name: software.name,
                                    softwareId: software.id
                                })
                            }
                        >
                            {declarationType === "user"
                                ? t("softwareDetails.stop being user")
                                : t("softwareDetails.stop being referent")}
                        </Button>
                    </>
                )}
                {software.dereferencing === undefined && (
                    <Button
                        priority="tertiary"
                        disabled={isUnreferencingOngoing}
                        onClick={onUnreferenceClick}
                    >
                        {isUnreferencingOngoing ? (
                            <CircularProgress size={17} />
                        ) : (
                            t("softwareDetails.unreference software")
                        )}
                    </Button>
                )}
            </div>
        </>
    );
};

const useStyles = tss.withName({ ParticipationSection }).create({
    usersAndReferents: {
        color: fr.colors.decisions.text.actionHigh.blueFrance.default
    },
    buttons: {
        display: "flex",
        flexWrap: "wrap",
        gap: fr.spacing("4v"),
        marginTop: fr.spacing("6v")
    }
});
