// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useTranslation } from "react-i18next";
import { fr } from "@codegouvfr/react-dsfr";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import type { State as SoftwareDetails } from "core/usecases/softwareDetails";
import { SoftwareCatalogCard } from "ui/pages/softwareCatalog/SoftwareCatalogCard";
import type { Link } from "type-route";
import { capitalize } from "tsafe/capitalize";
import { useStyles } from "tss-react";
import { exclude } from "tsafe/exclude";
import { useResolveLocalizedString } from "ui/i18n";
import { Tag } from "@codegouvfr/react-dsfr/Tag";

export type Props = {
    className?: string;
    similarSoftwares: SoftwareDetails.Software["similarSoftwares"];
    getLinks: (params: {
        softwareName: string;
    }) => Record<
        "declarationForm" | "softwareDetails" | "softwareUsersAndReferents",
        Link
    >;
    getAddWikipediaSoftwareToSillLink: (params: { externalId: string }) => Link;
};

export const SimilarSoftwareTab = (props: Props) => {
    const {
        className,
        similarSoftwares,
        getLinks,
        getAddWikipediaSoftwareToSillLink,
        ...rest
    } = props;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { t } = useTranslation();

    const { css } = useStyles();

    const { resolveLocalizedString } = useResolveLocalizedString();

    const similarSoftwaresNotRegistered = similarSoftwares.filter(
        (
            similarSoftware
        ): similarSoftware is SoftwareDetails.SimilarSoftwareNotRegistered =>
            !similarSoftware.registered
    );

    return (
        <section className={className}>
            <p className={fr.cx("fr-text--bold")}>
                {t("similarSoftwareTab.similar software in sill")} (
                {similarSoftwares.filter(({ registered }) => registered).length}) :
            </p>
            {similarSoftwares
                .map(similarSoftware =>
                    similarSoftware.registered ? similarSoftware.software : undefined
                )
                .filter(exclude(undefined))
                .map(software => {
                    const {
                        logoUrl,
                        softwareName,
                        latestVersion,
                        softwareDescription,
                        userCount,
                        referentCount,
                        customAttributes,
                        userDeclaration
                    } = software;

                    const {
                        declarationForm,
                        softwareDetails,
                        softwareUsersAndReferents
                    } = getLinks({ softwareName });

                    return (
                        <SoftwareCatalogCard
                            key={softwareName}
                            className={css({
                                maxWidth: 600,
                                ...fr.spacing("margin", {
                                    rightLeft: "auto",
                                    topBottom: "6v"
                                })
                            })}
                            software={{
                                ...software,
                                softwareDetailsLink: softwareDetails,
                                declareFormLink: declarationForm,
                                softwareUsersAndReferentsLink: softwareUsersAndReferents
                            }}
                        />
                    );
                })}

            {similarSoftwaresNotRegistered.length === 0 ? null : (
                <>
                    <p className={fr.cx("fr-text--bold", "fr-mt-8v")}>
                        {t("similarSoftwareTab.similar software not in sill")} (
                        {similarSoftwaresNotRegistered.length}) :
                    </p>
                    <ul>
                        {similarSoftwaresNotRegistered
                            .sort(
                                (
                                    { isLibreSoftware: isLibreSoftwareA },
                                    { isLibreSoftware: isLibreSoftwareB }
                                ) => {
                                    if (isLibreSoftwareA && !isLibreSoftwareB) {
                                        return -1;
                                    }
                                    if (!isLibreSoftwareA && isLibreSoftwareB) {
                                        return 1;
                                    }
                                    return 0;
                                }
                            )
                            .map(
                                ({ externalId, label, description, isLibreSoftware }) => {
                                    return (
                                        <li key={externalId}>
                                            <p
                                                className={css({
                                                    display: "inline-block",
                                                    marginRight: fr.spacing("4v")
                                                })}
                                            >
                                                <a
                                                    href={`https://www.wikidata.org/wiki/${externalId}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {resolveLocalizedString(label)}
                                                </a>
                                                :&nbsp;&nbsp;
                                                {capitalize(
                                                    resolveLocalizedString(description)
                                                )}
                                            </p>
                                            {isLibreSoftware ? (
                                                <Tag
                                                    iconId="ri-check-fill"
                                                    linkProps={getAddWikipediaSoftwareToSillLink(
                                                        { externalId }
                                                    )}
                                                >
                                                    {t(
                                                        "similarSoftwareTab.libre software"
                                                    )}
                                                </Tag>
                                            ) : null}
                                        </li>
                                    );
                                }
                            )}
                    </ul>
                </>
            )}
        </section>
    );
};
