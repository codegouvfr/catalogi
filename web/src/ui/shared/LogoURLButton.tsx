// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { tss } from "tss-react";
import Button from "@codegouvfr/react-dsfr/Button";
import { ReactNode } from "react";
import { FrIconClassName, RiIconClassName } from "@codegouvfr/react-dsfr";

// Type guard function
export const isLogoHandle = (value: string): boolean => {
    const validLogoHandles: LogoHandle[] = [
        "GitLab",
        "HAL",
        "wikidata",
        "SWH",
        "Orcid",
        "doi",
        "GitHub",
        "ComptoirDuLibre",
        "FramaLibre",
        "CNLL",
        "Zenodo",
        "ROR",
        "GRID",
        "ISNI",
        "CROSSREF",
        "RNSR"
    ];
    return validLogoHandles.includes(value as LogoHandle);
};

export type LogoHandle =
    | "GitLab"
    | "HAL"
    | "wikidata"
    | "SWH"
    | "Orcid"
    | "doi"
    | "GitHub"
    | "ComptoirDuLibre"
    | "FramaLibre"
    | "CNLL"
    | "Zenodo"
    | "ROR"
    | "GRID"
    | "ISNI"
    | "CROSSREF"
    | "RNSR";

export type Props = {
    // from Button
    iconId?: FrIconClassName | RiIconClassName;
    priority?: "primary" | "secondary" | "tertiary" | "tertiary no outline";
    size?: "small" | "large" | "medium";
    children?: ReactNode;
    className?: string;
    // Specific
    url?: URL | string | undefined;
    labelFromURL?: boolean;
    label?: string;
    type?: LogoHandle;
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

    if (urlString.includes("framalibre")) {
        return resolveLogoFromType("FramaLibre");
    }

    if (urlString.includes("ror.org")) {
        return resolveLogoFromType("ROR");
    }

    if (urlString.includes("appliweb.dgri.education.fr/rnsr")) {
        return resolveLogoFromType("RNSR");
    }

    if (urlString.includes("rnsr.adc.education.fr")) {
        return resolveLogoFromType("RNSR");
    }

    if (urlString.includes("isni.org")) {
        return resolveLogoFromType("ISNI");
    }

    if (urlString.includes("grid.org")) {
        return resolveLogoFromType("GRID");
    }

    if (urlString.includes("api.crossref.org")) {
        return resolveLogoFromType("CROSSREF");
    }

    return {
        URLlogo: undefined,
        textFromURL: new URL(urlString).hostname.replace("www.", "")
    };
};

const resolveLogoFromType = (
    sourceType: LogoHandle
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
        case "ROR":
            return {
                URLlogo: new URL("https://ror.org/img/ror-logo.svg"),
                textFromURL: "ROR"
            };
        case "GRID":
            return {
                URLlogo: new URL(
                    "https://grid.ac/assets/big-logo-ee7b8b390ece80dc0c59f5c5a46e2fd09c58d0315ebcced04516b91611f141be.svg"
                ),
                textFromURL: "GRID"
            };
        case "ISNI":
            return {
                URLlogo: new URL(
                    "https://upload.wikimedia.org/wikipedia/commons/4/4e/International_Standard_Name_Identifier.png"
                ),
                textFromURL: "ISNI"
            };
        case "RNSR":
            return {
                URLlogo: new URL(
                    "https://rnsr.adc.education.fr/assets/img/logo_rnsr.png"
                ),
                textFromURL: "RNSR"
            };
        case "CROSSREF":
            return {
                URLlogo: new URL("https://www.crossref.org/favicon.ico"),
                textFromURL: "Crossref"
            };
        default:
            sourceType satisfies never;
            return {
                URLlogo: undefined,
                textFromURL: undefined
            };
    }
};

const buildUrlFromType = (sourceType: LogoHandle, label: string): string | undefined => {
    switch (sourceType) {
        case "HAL":
            return `https://hal.science/${label}`;
        case "Orcid":
            return `https://orcid.org/${label}`;
        case "wikidata":
            return `https://www.wikidata.org/wiki/${label}`;
        case "doi":
            return `https://orcid.org/${label}`; // TODO
        case "SWH":
            return `https://orcid.org/${label}`; // TODO
        case "GitLab":
            return `https://orcid.org/${label}`; // TODO
        case "GitHub":
            return `https://github.com/${label}`;
        case "ComptoirDuLibre":
            return `https://orcid.org/${label}`; // TODO
        case "FramaLibre":
            return `https://orcid.org/${label}`; // TODO
        case "Zenodo":
            return `https://orcid.org/${label}`; // TODO
        case "CNLL":
            return `https://orcid.org/${label}`; // TODO
        case "ROR":
            return `https://ror.org/${label}`; // TODO
        case "ISNI":
            return `http://isni.org/isni/${label}`;
        case "CROSSREF":
            return `https://orcid.org/${label}`; // TODO
        case "RNSR":
            return `https://rnsr.adc.education.fr//structure/${label}`;
        case "GRID":
            return undefined;
        default:
            sourceType satisfies never;
            return undefined;
    }
};

export function LogoURLButton(props: Props) {
    const {
        url,
        label,
        labelFromURL,
        type,
        size = "medium",
        priority = "primary",
        className,
        iconId
    } = props;

    let urlToConvert = !url && type && label ? buildUrlFromType(type, label) : url;

    const urlString =
        typeof urlToConvert === "string" ? urlToConvert : urlToConvert?.href;

    const { classes } = useStyles();

    const getUrlMetadata = () => {
        if (type) return resolveLogoFromType(type);
        if (urlToConvert) return resolveLogoFromURL(urlToConvert);
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
            size={size}
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
