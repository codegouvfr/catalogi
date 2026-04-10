// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { memo } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { tss } from "tss-react";
import { useTranslation } from "react-i18next";
import { useResolveLocalizedString, type LocalizedString } from "ui/i18n";
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
            return resolveLocalizedString(value as LocalizedString);
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
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    if (typeof v === "string") return v.length > 0;
    return true;
};

export const SourceProvenanceView = memo((props: Props) => {
    const { dataBySource, fields, onUseValue, className } = props;
    const { classes, cx } = useStyles();
    const { t } = useTranslation();
    const { resolveLocalizedString } = useResolveLocalizedString();
    const renderValue = makeRenderValue(resolveLocalizedString);

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
                                <strong>{source.sourceSlug}</strong>
                                <span className={classes.kind}>{source.kind}</span>
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

    // Drawer variant: one card per source, every populated field listed.
    return (
        <div className={cx(classes.drawerRoot, className)}>
            <h5 className={classes.drawerTitle}>{t("sourceProvenance.drawerTitle")}</h5>
            {dataBySource.length === 0 && <p>{t("sourceProvenance.noData")}</p>}
            {dataBySource.map(source => {
                const populated = FIELD_KEYS.filter(key => isFieldPopulated(source, key));
                return (
                    <section key={source.sourceSlug} className={classes.sourceCard}>
                        <header className={classes.sourceCardHeader}>
                            <strong>{source.sourceSlug}</strong>
                            <span className={classes.kind}>{source.kind}</span>
                            {source.lastDataFetchAt && (
                                <span className={classes.timestamp}>
                                    {source.kind === "user_input"
                                        ? t("sourceProvenance.lastEditedAt", {
                                              when: source.lastDataFetchAt
                                          })
                                        : t("sourceProvenance.lastFetchedAt", {
                                              when: source.lastDataFetchAt
                                          })}
                                </span>
                            )}
                        </header>
                        {populated.length === 0 ? (
                            <p className={fr.cx("fr-text--sm")}>
                                {t("sourceProvenance.sourceEmpty")}
                            </p>
                        ) : (
                            <dl className={classes.fieldList}>
                                {populated.map(key => (
                                    <div key={key} className={classes.fieldRow}>
                                        <dt className={classes.fieldKey}>{key}</dt>
                                        <dd className={classes.fieldValue}>
                                            {renderValue(source[key])}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </section>
                );
            })}
        </div>
    );
});

const useStyles = tss.withName({ SourceProvenanceView }).create({
    drawerRoot: {
        padding: fr.spacing("4v"),
        minWidth: 360,
        maxWidth: 520
    },
    drawerTitle: {
        marginBottom: fr.spacing("4v")
    },
    sourceCard: {
        marginBottom: fr.spacing("4v"),
        padding: fr.spacing("3v"),
        borderLeft: `3px solid ${fr.colors.decisions.border.actionHigh.blueFrance.default}`,
        background: fr.colors.decisions.background.alt.grey.default
    },
    sourceCardHeader: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("2v"),
        marginBottom: fr.spacing("2v"),
        flexWrap: "wrap"
    },
    kind: {
        color: fr.colors.decisions.text.mention.grey.default,
        fontSize: "0.8rem"
    },
    timestamp: {
        color: fr.colors.decisions.text.mention.grey.default,
        fontSize: "0.8rem"
    },
    fieldList: {
        margin: 0,
        padding: 0
    },
    fieldRow: {
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: fr.spacing("2v"),
        padding: `${fr.spacing("1v")} 0`,
        borderBottom: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
        "&:last-child": {
            borderBottom: "none"
        }
    },
    fieldKey: {
        margin: 0,
        color: fr.colors.decisions.text.mention.grey.default,
        fontSize: "0.85rem",
        wordBreak: "break-word"
    },
    fieldValue: {
        margin: 0,
        fontSize: "0.9rem",
        wordBreak: "break-word"
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
