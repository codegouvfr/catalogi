// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useTranslation } from "react-i18next";

export function SoftwareCreationRestrictedAlert(props: { className?: string }) {
    const { className } = props;
    const { t } = useTranslation();

    return (
        <div className={className}>
            <div className={fr.cx("fr-container")}>
                <Alert
                    className={fr.cx("fr-my-6v")}
                    severity="info"
                    title={t("softwareForm.creationRestrictedTitle")}
                    description={t("softwareForm.creationRestrictedDescription")}
                />
            </div>
        </div>
    );
}
