// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";
import { LogoURLButton } from "ui/shared/LogoURLButton";
import type { ApiTypes } from "api";

const getIdentifierUrl = (identifier: ApiTypes.Identifier) =>
    identifier.url ?? identifier.subjectOf?.url;

const getDomain = (url: string | URL) => new URL(url).hostname.replace("www.", "");

/** One link per domain, the official website being already linked from the hero. */
export const getUsefulLinks = (params: {
    identifiers: ApiTypes.Identifier[];
    officialWebsiteUrl: string | undefined;
}): ApiTypes.Identifier[] => {
    const { identifiers, officialWebsiteUrl } = params;

    return identifiers
        .filter(identifier => {
            const identifierURLString = identifier?.url?.toString();
            return (
                !officialWebsiteUrl ||
                (identifierURLString &&
                    !officialWebsiteUrl.startsWith(identifierURLString))
            );
        })
        .reduce((acc, identifier) => {
            const url = getIdentifierUrl(identifier);
            if (!url) return acc;
            const domain = getDomain(url);
            if (
                acc.some(i => {
                    const iUrl = getIdentifierUrl(i);
                    return iUrl !== undefined && getDomain(iUrl) === domain;
                })
            ) {
                return acc;
            }
            acc.push(identifier);
            return acc;
        }, [] as ApiTypes.Identifier[]);
};

type Props = {
    links: ApiTypes.Identifier[];
};

export const UsefulLinks = (props: Props) => {
    const { links } = props;
    const { classes } = useStyles();

    return (
        <ul className={classes.list}>
            {links.map(identifier => {
                const url = getIdentifierUrl(identifier);
                if (!url) return null;

                return (
                    <li key={url.toString()}>
                        <LogoURLButton priority="secondary" url={url} labelFromURL />
                    </li>
                );
            })}
        </ul>
    );
};

const useStyles = tss.withName({ UsefulLinks }).create({
    list: {
        listStyle: "none",
        display: "flex",
        flexWrap: "wrap",
        gap: fr.spacing("4v"),
        padding: 0,
        margin: 0,
        marginBottom: fr.spacing("6v")
    }
});
