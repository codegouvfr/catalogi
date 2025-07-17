// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import { useTranslation } from "react-i18next";
import { Catalogi } from "shared";

export type Props = {
    referencePublications?: Catalogi.ScholarlyArticle[];
};

export const PublicationTab = (props: Props) => {
    const { referencePublications } = props;

    const { t } = useTranslation();

    return (
        <>
            <h6>{t("softwareDetails.tabReferencePublicationTitle")}</h6>
            <ul>
                {referencePublications?.map(article => {
                    return (
                        <li>
                            <a
                                href={article.identifier?.url?.toString()}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    marginRight: fr.spacing("2v"),
                                    color: fr.colors.decisions.text.actionHigh.blueFrance
                                        .default
                                }}
                            >
                                {article.headline ?? article["@id"]}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </>
    );
};
