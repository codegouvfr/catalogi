// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { fr } from "@codegouvfr/react-dsfr";
import { Evt } from "evt";
import { useRerenderOnStateChange } from "evt/hooks";
import { useTranslation } from "react-i18next";

const modal = createModal({
    id: "software-protection",
    isOpenedByDefault: false
});

type ProtectionType = "statusChanging" | "edition";

type Params = {
    type: ProtectionType;
    reason: string | null | undefined;
};

const evtParams = Evt.create<Params | undefined>(undefined);

evtParams.toStateless().attach(() => modal.open());

export function openSoftwareProtectionModal(params: Params) {
    evtParams.state = params;
}

export function SoftwareProtectionModal() {
    const { t } = useTranslation();

    useRerenderOnStateChange(evtParams);

    const params = evtParams.state;

    const { type = "dereferencing", reason } = params ?? {};

    const title =
        type === "dereferencing"
            ? t("softwareDetails.protectedFromUnreferencingTitle")
            : t("softwareDetails.protectedFromEditingTitle");

    const description =
        type === "dereferencing"
            ? t("softwareDetails.protectedFromUnreferencingDescription")
            : t("softwareDetails.protectedFromEditingDescription");

    return (
        <modal.Component
            title={title}
            buttons={[
                {
                    doClosesModal: true,
                    children: t("softwareDetails.protectionModalClose")
                }
            ]}
        >
            <Alert
                severity="info"
                small
                description={
                    <>
                        {description}
                        {reason && (
                            <p style={{ marginBottom: 0, marginTop: fr.spacing("2v") }}>
                                <span className={fr.cx("fr-text--bold")}>
                                    {t("softwareDetails.protectionAdminMessage")}
                                </span>{" "}
                                {reason}
                            </p>
                        )}
                    </>
                }
            />
        </modal.Component>
    );
}
