// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SoftwareType } from "shared";
import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";
import { useTranslation } from "react-i18next";

type Props = {
    title?: string;
    softwareType: SoftwareType;
};

export function SoftwareTypeTable(props: Props) {
    const { classes, cx } = useStyles();

    const { t } = useTranslation();

    return (
        <div className="fr-table--sm fr-table fr-table" id="table-sm-component">
            <div className="fr-table__wrapper">
                <div className="fr-table__container">
                    <div className="fr-table__content">
                        <table id="table-sm">
                            <caption>
                                <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                                    {t("previewTab.supportedOS")}
                                </p>
                            </caption>
                            <thead>
                                <tr>
                                    <th scope="col" style={{ textAlign: "center" }}>
                                        Windows
                                    </th>
                                    <th scope="col" style={{ textAlign: "center" }}>
                                        Linux
                                    </th>
                                    <th scope="col" style={{ textAlign: "center" }}>
                                        Mac
                                    </th>
                                    <th scope="col" style={{ textAlign: "center" }}>
                                        iOS
                                    </th>
                                    <th scope="col" style={{ textAlign: "center" }}>
                                        Android
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr id="table-sm-row-key-1" data-row-key="1">
                                    <td style={{ textAlign: "center" }}>
                                        {props?.softwareType?.type === "desktop/mobile" &&
                                        props.softwareType.os.windows
                                            ? "✅"
                                            : "❌"}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                        {props?.softwareType?.type === "desktop/mobile" &&
                                        props.softwareType.os.linux
                                            ? "✅"
                                            : "❌"}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                        {props?.softwareType?.type === "desktop/mobile" &&
                                        props.softwareType.os.mac
                                            ? "✅"
                                            : "❌"}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                        {props?.softwareType?.type === "desktop/mobile" &&
                                        props.softwareType.os.ios
                                            ? "✅"
                                            : "❌"}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                        {props?.softwareType?.type === "desktop/mobile" &&
                                        props.softwareType.os.android
                                            ? "✅"
                                            : "❌"}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

const useStyles = tss.withName({ SoftwareTypeTable }).create({
    item: {
        "&:not(:last-of-type)": {
            marginBottom: fr.spacing("4v")
        }
    }
});
