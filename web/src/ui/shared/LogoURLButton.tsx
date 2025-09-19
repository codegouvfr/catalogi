// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { tss } from "tss-react";
import Button from "@codegouvfr/react-dsfr/Button";
import { ReactNode } from "react";
import { FrIconClassName, RiIconClassName } from "@codegouvfr/react-dsfr";
import { ApiTypes } from "api";

export type Props = {
    // from Button
    iconId?: FrIconClassName | RiIconClassName;
    priority?: "primary" | "secondary" | "tertiary" | "tertiary no outline";
    children?: ReactNode;
    className?: string;
    // Specific
    url: URL | string | undefined;
    labelFromURL?: boolean;
    label?: string;
    type?: ApiTypes.Catalogi.SourceKind;
};

const resolveLogoFromURL = (
    linkURL: URL | string
): { URLlogo: URL | undefined; textFromURL: string | undefined } => {
    const urlString = typeof linkURL === "string" ? linkURL : linkURL.href;

    if (urlString.includes("orcid")) {
        return resolveLogoFromType("Orcid");
    }

    if (urlString.includes("wikidata")) {
        return resolveLogoFromType("wikidata");
    }

    if (urlString.includes("doi.org")) {
        return resolveLogoFromType("doi");
    }

    if (urlString.includes("softwareheritage.org")) {
        return resolveLogoFromType("SWH");
    }

    if (urlString.includes("gitlab")) {
        return resolveLogoFromType("GitLab");
    }

    if (urlString.includes("github.com")) {
        return resolveLogoFromType("GitHub");
    }

    if (urlString.includes("comptoir-du-libre.org")) {
        return resolveLogoFromType("ComptoirDuLibre");
    }

    if (urlString.includes("hal")) {
        return resolveLogoFromType("HAL");
    }

    if (urlString.includes("zenodo.org")) {
        return resolveLogoFromType("Zenodo");
    }

    if (urlString.includes("cnll")) {
        return resolveLogoFromType("CNLL");
    }

    return {
        URLlogo: undefined,
        textFromURL: undefined
    };
};

const resolveLogoFromType = (
    sourceType: ApiTypes.Catalogi.SourceKind
): { URLlogo: URL | undefined; textFromURL: string | undefined } => {
    switch (sourceType) {
        case "HAL":
            return {
                URLlogo: new URL(
                    "https://hal.science/assets/favicon/apple-touch-icon.png"
                ),
                textFromURL: "HAL"
            };
        case "Orcid":
            return {
                URLlogo: new URL("https://orcid.org/assets/vectors/orcid.logo.icon.svg"),
                textFromURL: "ORCID"
            };
        case "wikidata":
            return {
                URLlogo: new URL(
                    "https://www.wikidata.org/static/apple-touch/wikidata.png"
                ),
                textFromURL: "WikiData"
            };
        case "doi":
            return {
                URLlogo: new URL("https://www.doi.org/images/favicons/favicon-16x16.png"),
                textFromURL: "DOI"
            };
        case "SWH":
            return {
                URLlogo: new URL(
                    "https://archive.softwareheritage.org/static/img/icons/swh-logo-32x32.png"
                ),
                textFromURL: "Software Heritage"
            };
        case "GitLab":
            return {
                URLlogo: new URL(
                    "https://gitlab.com/assets/favicon-72a2cad5025aa931d6ea56c3201d1f18e68a8cd39788c7c80d5b2b82aa5143ef.png"
                ),
                textFromURL: "GitLab"
            };
        case "GitHub":
            return {
                URLlogo: new URL("https://github.githubassets.com/favicons/favicon.svg"),
                // https://github.githubassets.com/favicons/favicon-dark.svg
                textFromURL: "GitHub"
            };
        case "ComptoirDuLibre":
            return {
                URLlogo: new URL(
                    "https://comptoir-du-libre.org/img/favicon/CDL-Favicon.16_16.png?v2.13.2_DEV"
                ),
                textFromURL: "Comptoir Du Libre"
            };
        case "FramaLibre":
            return {
                URLlogo: new URL(
                    "https://framasoft.org/nav/img/icons/favicon/sites/libre.png"
                ),
                textFromURL: "FramaLibre"
            };
        case "Zenodo":
            return {
                URLlogo: new URL(
                    "https://about.zenodo.org/static/img/logos/zenodo-gradient-2500.png"
                ),
                textFromURL: "Zenodo"
            };
        case "CNLL":
            return {
                URLlogo: new URL("https://cnll.fr/static/img/logo-cnll.svg"),
                textFromURL: "CNLL"
            };

        default:
            sourceType satisfies never;
            return {
                URLlogo: undefined,
                textFromURL: undefined
            };
    }
};

export function LogoURLButton(props: Props) {
    const {
        url,
        label,
        labelFromURL,
        type,
        priority = "primary",
        className,
        iconId
    } = props;

    const urlString = typeof url === "string" ? url : url?.href;

    const { classes } = useStyles();

    const getUrlMetadata = () => {
        if (type) return resolveLogoFromType(type);
        if (url) return resolveLogoFromURL(url);
        return {
            URLlogo: undefined,
            textFromURL: undefined
        };
    };

    const { URLlogo, textFromURL } = getUrlMetadata();

    const getLabel = () => {
        if (label) return label;
        if (labelFromURL) return textFromURL;
        return "";
    };
    const resolvedLabel = getLabel();

    return (
        <Button
            className={className}
            priority={priority}
            {...(iconId && !URLlogo ? { iconId: iconId } : { iconId: undefined })}
            linkProps={{
                target: "_blank",
                rel: "noreferrer",
                href: urlString
            }}
        >
            {URLlogo && <img alt="logo site" src={URLlogo.href} height="20px" />}
            <p className={classes.linkContent}>{resolvedLabel}</p>
        </Button>
    );
}

const useStyles = tss.withName({ LogoURLButton }).create({
    linkContent: {
        marginLeft: "7px"
    }
});

const yo = [
    {
        "@type": "PropertyValue",
        value: "93",
        subjectOf: {
            url: "https://cnll.fr/",
            name: "Union des entreprises du logiciel libre et du numérique ouvert",
            "@type": "Website",
            additionalType: "cnll"
        }
    }
];
