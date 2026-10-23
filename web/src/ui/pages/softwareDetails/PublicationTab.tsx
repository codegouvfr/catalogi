// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import { useTranslation } from "react-i18next";
import { ApiTypes } from "api";

export type Props = {
    referencePublications?: ApiTypes.ScholarlyArticle[];
};

export const PublicationTab = (props: Props) => {
    const { referencePublications } = props;

    const { t } = useTranslation();

    return (
        <ul>
            {referencePublications?.map(article => {
                return (
                    <li key={article["@id"]}>
                        <a
                            href={article.identifiers?.[0]?.url?.toString()} // It doesn't matter which id we take
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
    );
};
