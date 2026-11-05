// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { tss } from "tss-react";
import { useTranslation } from "react-i18next";
import type { ApiTypes } from "api";
import { useLang } from "ui/i18n";
import { getFormattedDate } from "ui/datetimeUtils";
import { openSourceFormModal } from "./SourceFormModal";

// A category may hold hundreds of forges: show the most used ones first, the others on demand.
const collapsedSourceCount = 3;
const sourcesPageSize = 20;
const filterThreshold = 10;

export function SourcesTable(props: { label: string; sources: ApiTypes.AdminSource[] }) {
    const { t } = useTranslation();
    const { classes } = useStyles();
    const { lang } = useLang();
    const [filter, setFilter] = useState("");
    const [shownCount, setShownCount] = useState(collapsedSourceCount);

    const isExpanded = shownCount > collapsedSourceCount;
    const needle = filter.trim().toLowerCase();
    const matching = props.sources
        .filter(
            ({ slug, url }) =>
                needle === "" ||
                slug.toLowerCase().includes(needle) ||
                url.toLowerCase().includes(needle)
        )
        .sort(
            (a, b) => b.softwareCount - a.softwareCount || a.slug.localeCompare(b.slug)
        );
    const sources = matching.slice(0, shownCount);

    const headers = [
        t("admin.sources.columnSlug"),
        t("admin.sources.columnKind"),
        t("admin.sources.columnUrl"),
        t("admin.sources.columnCredential"),
        t("admin.sources.columnLastImport"),
        t("admin.sources.columnSoftwareCount"),
        t("admin.sources.columnActions")
    ];

    return (
        <>
            {isExpanded && props.sources.length > filterThreshold && (
                <Input
                    className={classes.filter}
                    label={t("admin.sources.filterLabel")}
                    nativeInputProps={{
                        type: "search",
                        value: filter,
                        onChange: e => {
                            setFilter(e.target.value);
                            setShownCount(sourcesPageSize);
                        }
                    }}
                />
            )}
            <div
                className={fr.cx(
                    "fr-table",
                    "fr-table--bordered",
                    "fr-table--sm",
                    "fr-mb-0"
                )}
            >
                <div className="fr-table__wrapper">
                    <div className="fr-table__container">
                        <div className="fr-table__content">
                            <table aria-label={props.label}>
                                <thead>
                                    <tr>
                                        {headers.map(label => (
                                            <th key={label} scope="col">
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sources.map(source => (
                                        <tr key={source.slug}>
                                            <td>
                                                <code>{source.slug}</code>
                                                {source.isLookupSource && (
                                                    <Badge
                                                        small
                                                        severity="info"
                                                        className={fr.cx("fr-ml-1w")}
                                                    >
                                                        {t("admin.sources.lookupBadge")}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td>{source.kind}</td>
                                            <td className={classes.urlCell}>
                                                {source.url || "—"}
                                            </td>
                                            <td>
                                                {source.configurationFields.credential ===
                                                undefined ? (
                                                    "—"
                                                ) : (
                                                    <CredentialStatus
                                                        isSet={
                                                            source.configuration
                                                                .isCredentialSet
                                                        }
                                                    />
                                                )}
                                            </td>
                                            <td>
                                                {source.lastImport
                                                    ? getFormattedDate({
                                                          time: new Date(
                                                              source.lastImport
                                                          ).getTime(),
                                                          lang,
                                                          doAlwaysShowYear: true
                                                      })
                                                    : t("admin.sources.never")}
                                            </td>
                                            <td className={classes.cellCentered}>
                                                {source.softwareCount}
                                            </td>
                                            <td className={classes.cellCentered}>
                                                {source.isEditable && (
                                                    <Button
                                                        priority="tertiary no outline"
                                                        iconId="fr-icon-edit-line"
                                                        title={t("admin.sources.edit", {
                                                            slug: source.slug
                                                        })}
                                                        onClick={() =>
                                                            openSourceFormModal({
                                                                source
                                                            })
                                                        }
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            {props.sources.length > collapsedSourceCount && (
                <div className={classes.pager}>
                    {(sources.length < matching.length || matching.length === 0) && (
                        <span className={fr.cx("fr-text--sm", "fr-mb-0")}>
                            {matching.length === 0
                                ? t("admin.sources.noMatch")
                                : t("admin.sources.shownCount", {
                                      shown: sources.length,
                                      total: matching.length
                                  })}
                        </span>
                    )}
                    {sources.length < matching.length && (
                        <Button
                            priority="tertiary"
                            size="small"
                            onClick={() =>
                                setShownCount(count =>
                                    isExpanded ? count + sourcesPageSize : sourcesPageSize
                                )
                            }
                        >
                            {t("admin.sources.showMore")}
                        </Button>
                    )}
                    {isExpanded && (
                        <Button
                            priority="tertiary no outline"
                            size="small"
                            onClick={() => {
                                setShownCount(collapsedSourceCount);
                                setFilter("");
                            }}
                        >
                            {t("admin.sources.showLess")}
                        </Button>
                    )}
                </div>
            )}
        </>
    );
}

function CredentialStatus(props: { isSet: boolean }) {
    const { isSet } = props;
    const { t } = useTranslation();
    const { classes } = useStyles();
    return (
        <span className={classes.credentialStatus}>
            <span
                aria-hidden
                className={fr.cx(
                    isSet ? "fr-icon-checkbox-circle-fill" : "fr-icon-close-circle-fill",
                    "fr-icon--sm"
                )}
                style={{
                    color: isSet
                        ? fr.colors.decisions.text.default.success.default
                        : fr.colors.decisions.text.default.error.default
                }}
            />
            {isSet
                ? t("admin.sources.credentialSet")
                : t("admin.sources.credentialNotSet")}
        </span>
    );
}

const useStyles = tss.withName({ SourcesTable }).create(() => ({
    urlCell: {
        wordBreak: "break-all"
    },
    credentialStatus: {
        display: "inline-flex",
        alignItems: "center",
        gap: fr.spacing("1v")
    },
    cellCentered: {
        textAlign: "center"
    },
    filter: {
        maxWidth: "24rem",
        marginBottom: fr.spacing("3v")
    },
    pager: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("4v"),
        marginTop: fr.spacing("3v")
    }
}));
