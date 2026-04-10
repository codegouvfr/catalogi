// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import React, { memo } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { tss } from "tss-react";
import { useTranslation } from "react-i18next";
import { useLang, useResolveLocalizedString, type LocalizedString } from "ui/i18n";
import { getFormattedDate } from "ui/datetimeUtils";
import type { ApiTypes } from "api";

export type SourceFieldKey = keyof Omit<
    ApiTypes.SoftwareSourceData,
    "sourceSlug" | "priority" | "kind" | "sourceUrl" | "externalId" | "lastDataFetchAt"
>;

export type Props = {
    dataBySource: ApiTypes.SoftwareSourceData[];
    /**
     * If omitted, renders the drawer variant (one card per source with every non-empty field).
     * If set, renders the popover variant scoped to a single field.
     */
    fields?: SourceFieldKey[];
    /** Popover variant only: called when the editor picks a value from a source. */
    onUseValue?: (params: {
        sourceSlug: string;
        field: SourceFieldKey;
        value: unknown;
    }) => void;
    className?: string;
};

const makeRenderValue =
    (resolveLocalizedString: (v: LocalizedString) => string) =>
    (value: unknown): string => {
        if (value === undefined || value === null) return "";
        if (typeof value === "string") return value;
        if (typeof value === "boolean") return value ? "true" : "false";
        if (Array.isArray(value)) {
            return value
                .map(item =>
                    typeof item === "string"
                        ? item
                        : ((item as { name?: string })?.name ?? JSON.stringify(item))
                )
                .filter(Boolean)
                .join(", ");
        }
        if (typeof value === "object") {
            const asVersion = value as { version?: string; releaseDate?: string };
            if ("version" in asVersion || "releaseDate" in asVersion) {
                return [asVersion.version, asVersion.releaseDate]
                    .filter(Boolean)
                    .join(" — ");
            }
            // Treat as LocalizedString. resolveLocalizedString asserts that at
            // least one entry is a non-empty string, so filter first.
            const localized = Object.fromEntries(
                Object.entries(value as Record<string, unknown>).filter(
                    ([, v]) => typeof v === "string" && v.length > 0
                )
            ) as LocalizedString;
            if (Object.keys(localized).length === 0) return "";
            return resolveLocalizedString(localized);
        }
        return String(value);
    };

// A compile error fires if this list drifts from `SourceFieldKey`.
const FIELD_KEYS = [
    "name",
    "description",
    "image",
    "url",
    "codeRepositoryUrl",
    "softwareHelp",
    "license",
    "latestVersion",
    "keywords",
    "programmingLanguages",
    "applicationCategories",
    "authors",
    "identifiers",
    "referencePublications",
    "providers",
    "operatingSystems",
    "runtimePlatforms",
    "isLibreSoftware"
] as const satisfies readonly SourceFieldKey[];

const isFieldPopulated = (
    source: ApiTypes.SoftwareSourceData,
    field: SourceFieldKey
): boolean => {
    const v = source[field] as unknown;
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") {
        // Catch empty LocalizedString-like objects ({}, {fr: ""}, {fr: null})
        // and version objects with no usable fields.
        return Object.values(v as object).some(
            x =>
                x !== null &&
                x !== undefined &&
                x !== "" &&
                (!Array.isArray(x) || x.length > 0)
        );
    }
    if (typeof v === "string") return v.length > 0;
    return true;
};

export const SourceProvenanceView = memo((props: Props) => {
    const { dataBySource, fields, onUseValue, className } = props;
    const { classes, cx } = useStyles();
    const { t } = useTranslation();
    const { lang } = useLang();
    const { resolveLocalizedString } = useResolveLocalizedString();
    const renderValue = makeRenderValue(resolveLocalizedString);

    const renderFetchInfo = (source: ApiTypes.SoftwareSourceData) => {
        if (!source.lastDataFetchAt) {
            return source.kind === "user_input"
                ? null
                : t("sourceProvenance.neverFetched");
        }
        const when = getFormattedDate({
            time: source.lastDataFetchAt,
            lang,
            doAlwaysShowYear: true,
            showTime: false
        });
        return source.kind === "user_input"
            ? t("sourceProvenance.lastEditedAt", { when })
            : t("sourceProvenance.lastFetchedAt", { when });
    };

    const getSourceLabel = (source: ApiTypes.SoftwareSourceData): string => {
        switch (source.kind) {
            case "user_input":
                return t("sourceProvenance.sourceLabel_user_input");
            case "wikidata":
                return t("sourceProvenance.sourceLabel_wikidata");
            case "HAL":
                return t("sourceProvenance.sourceLabel_HAL");
            case "ComptoirDuLibre":
                return t("sourceProvenance.sourceLabel_ComptoirDuLibre");
            case "CNLL":
                return t("sourceProvenance.sourceLabel_CNLL");
            case "Zenodo":
                return t("sourceProvenance.sourceLabel_Zenodo");
            case "GitLab":
                return t("sourceProvenance.sourceLabel_GitLab");
            case "GitHub":
                return t("sourceProvenance.sourceLabel_GitHub");
            default:
                return source.sourceSlug;
        }
    };

    // Popover variant: one row per source for the single requested field.
    if (fields && fields.length === 1) {
        const [field] = fields;
        const rows = dataBySource.filter(source => isFieldPopulated(source, field));

        if (rows.length === 0) {
            return (
                <div className={cx(classes.popoverRoot, className)}>
                    <p className={fr.cx("fr-text--sm")}>{t("sourceProvenance.noData")}</p>
                </div>
            );
        }

        return (
            <div className={cx(classes.popoverRoot, className)}>
                <h6 className={classes.popoverTitle}>
                    {t("sourceProvenance.popoverTitle", { field })}
                </h6>
                <ul className={classes.popoverList}>
                    {rows.map(source => (
                        <li key={source.sourceSlug} className={classes.popoverRow}>
                            <div className={classes.popoverRowHeader}>
                                <strong>{getSourceLabel(source)}</strong>
                            </div>
                            <div className={classes.popoverValue}>
                                {renderValue(source[field])}
                            </div>
                            {onUseValue && (
                                <Button
                                    size="small"
                                    priority="tertiary"
                                    onClick={() =>
                                        onUseValue({
                                            sourceSlug: source.sourceSlug,
                                            field,
                                            value: source[field]
                                        })
                                    }
                                >
                                    {t("sourceProvenance.useThisValue")}
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    // Modal variant: a comparison table — rows = fields, columns = sources.
    if (dataBySource.length === 0) {
        return (
            <div className={cx(classes.modalRoot, className)}>
                <p>{t("sourceProvenance.noData")}</p>
            </div>
        );
    }

    const headers: React.ReactNode[] = [
        t("sourceProvenance.fieldColumnHeader"),
        ...dataBySource.map(source => {
            const fetchInfo = renderFetchInfo(source);
            return (
                <span key={source.sourceSlug}>
                    {getSourceLabel(source)}
                    {fetchInfo && <span className={classes.timestamp}>{fetchInfo}</span>}
                </span>
            );
        })
    ];

    const rows: React.ReactNode[][] = FIELD_KEYS.map(key => [
        <span key="label" className={classes.fieldKey}>
            {key}
        </span>,
        ...dataBySource.map(source => {
            if (!isFieldPopulated(source, key))
                return <span className={classes.empty}>—</span>;
            return <span className={classes.fieldValue}>{renderValue(source[key])}</span>;
        })
    ]);

    return (
        <div className={cx(classes.modalRoot, className)}>
            <Table
                bordered
                fixed
                headers={headers}
                data={rows}
                noCaption
                caption={t("sourceProvenance.modalTitle")}
            />
        </div>
    );
});

const useStyles = tss.withName({ SourceProvenanceView }).create({
    modalRoot: {
        display: "block"
    },
    timestamp: {
        display: "block",
        color: fr.colors.decisions.text.mention.grey.default,
        fontSize: "0.75rem",
        fontWeight: "normal",
        marginTop: fr.spacing("1v")
    },
    fieldKey: {
        fontWeight: "bold",
        wordBreak: "break-word"
    },
    fieldValue: {
        fontSize: "0.9rem",
        wordBreak: "break-word"
    },
    empty: {
        color: fr.colors.decisions.text.mention.grey.default
    },
    popoverRoot: {
        padding: fr.spacing("3v"),
        minWidth: 320,
        maxWidth: 480
    },
    popoverTitle: {
        marginTop: 0,
        marginBottom: fr.spacing("2v")
    },
    popoverList: {
        listStyle: "none",
        margin: 0,
        padding: 0
    },
    popoverRow: {
        padding: fr.spacing("2v"),
        borderBottom: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
        "&:last-child": {
            borderBottom: "none"
        }
    },
    popoverRowHeader: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("2v")
    },
    popoverValue: {
        padding: `${fr.spacing("1v")} 0`,
        fontSize: "0.9rem",
        wordBreak: "break-word"
    }
});
