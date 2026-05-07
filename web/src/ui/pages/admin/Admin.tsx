// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, useMemo } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { tss } from "tss-react";
import { assert } from "tsafe/assert";
import { Equals } from "tsafe";
import { useTranslation } from "react-i18next";
import { useCore, useCoreState } from "core";
import { routes } from "ui/routes";
import { LoadingFallback } from "ui/shared/LoadingFallback";
import { useResolveLocalizedString } from "ui/i18n";
import { iconClassByValue } from "ui/shared/attributeIcons";
import type { ApiTypes } from "api";
import type { PageRoute } from "./route";
import {
    AttributeDefinitionFormModal,
    openAttributeDefinitionFormModal
} from "./AttributeDefinitionFormModal";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function Admin(props: Props) {
    const { className, route, ...rest } = props;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { t } = useTranslation();
    const { classes, cx } = useStyles();

    const { adminAttributes } = useCore().functions;
    const { currentUser } = useCoreState("userAuthentication", "currentUser");
    const { isLoading, definitions } = useCoreState("adminAttributes", "main");

    useEffect(() => {
        if (currentUser?.role !== "admin") {
            routes.home().replace();
            return;
        }
        adminAttributes.fetch();
    }, [currentUser?.role]);

    const sortedDefinitions = useMemo(
        () => [...definitions].sort((a, b) => a.displayOrder - b.displayOrder),
        [definitions]
    );

    if (currentUser?.role !== "admin") {
        return <LoadingFallback />;
    }

    return (
        <div className={cx(fr.cx("fr-container--fluid", "fr-px-4w"), className)}>
            <div className={classes.header}>
                <h1 className={fr.cx("fr-h2")}>{t("admin.title")}</h1>
            </div>

            <section className={classes.section}>
                <div className={classes.sectionHeader}>
                    <div>
                        <h2 className={fr.cx("fr-h4")}>
                            {t("admin.customAttributes.title")}
                        </h2>
                        <p className={fr.cx("fr-text--sm", "fr-mb-0")}>
                            {t("admin.customAttributes.subtitle")}
                        </p>
                    </div>
                    <Button
                        priority="primary"
                        iconId="fr-icon-add-line"
                        onClick={() =>
                            openAttributeDefinitionFormModal({ mode: "create" })
                        }
                    >
                        {t("admin.customAttributes.addAttribute")}
                    </Button>
                </div>

                {isLoading ? (
                    <LoadingFallback />
                ) : sortedDefinitions.length === 0 ? (
                    <p className={fr.cx("fr-text--sm")}>
                        {t("admin.customAttributes.empty")}
                    </p>
                ) : (
                    <AttributeDefinitionsTable definitions={sortedDefinitions} />
                )}
            </section>

            <AttributeDefinitionFormModal />
        </div>
    );
}

function AttributeDefinitionsTable(props: {
    definitions: ApiTypes.AttributeDefinition[];
}) {
    const { definitions } = props;
    const { t } = useTranslation();
    const { classes } = useStyles();

    const headers: { label: string; centered?: boolean }[] = [
        { label: t("admin.customAttributes.columnKind") },
        { label: t("admin.customAttributes.columnLabel") },
        { label: t("admin.customAttributes.columnDisplayInForm"), centered: true },
        { label: t("admin.customAttributes.columnDisplayInDetails"), centered: true },
        { label: t("admin.customAttributes.columnEnableFiltering"), centered: true },
        { label: t("admin.customAttributes.columnRequired"), centered: true },
        { label: t("admin.customAttributes.columnDisplayInCardIcon") },
        { label: t("admin.customAttributes.columnDisplayOrder"), centered: true },
        { label: t("admin.customAttributes.columnActions"), centered: true }
    ];

    return (
        <div className="fr-table fr-table--bordered">
            <div className="fr-table__wrapper">
                <div className="fr-table__container">
                    <div className="fr-table__content">
                        <table>
                            <thead>
                                <tr>
                                    {headers.map(({ label, centered }) => (
                                        <th
                                            key={label}
                                            scope="col"
                                            className={
                                                centered
                                                    ? classes.cellCentered
                                                    : undefined
                                            }
                                        >
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {definitions.map(def => (
                                    <AttributeDefinitionRow key={def.name} def={def} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AttributeDefinitionRow(props: { def: ApiTypes.AttributeDefinition }) {
    const { def } = props;
    const { t } = useTranslation();
    const { classes, cx } = useStyles();
    const { resolveLocalizedString } = useResolveLocalizedString();

    const displayLabel = resolveLocalizedString(def.label) || def.name;

    return (
        <tr>
            <td>{def.kind}</td>
            <td className={classes.labelCell}>
                <div>{displayLabel}</div>
                <code className={cx(fr.cx("fr-text--xs"), classes.identifier)}>
                    {def.name}
                </code>
            </td>
            <td className={classes.cellCentered}>{def.displayInForm ? "✅" : "❌"}</td>
            <td className={classes.cellCentered}>{def.displayInDetails ? "✅" : "❌"}</td>
            <td className={classes.cellCentered}>{def.enableFiltering ? "✅" : "❌"}</td>
            <td className={classes.cellCentered}>{def.required ? "✅" : "❌"}</td>
            <td className={classes.cellCentered}>
                {def.displayInCardIcon ? (
                    <i
                        className={fr.cx(iconClassByValue[def.displayInCardIcon])}
                        title={def.displayInCardIcon}
                        aria-label={def.displayInCardIcon}
                    />
                ) : (
                    "—"
                )}
            </td>
            <td className={classes.cellCentered}>{def.displayOrder}</td>
            <td className={classes.cellCentered}>
                <Button
                    priority="tertiary no outline"
                    iconId="fr-icon-edit-line"
                    title={t("admin.customAttributes.edit")}
                    onClick={() =>
                        openAttributeDefinitionFormModal({
                            mode: "edit",
                            definition: def
                        })
                    }
                />
            </td>
        </tr>
    );
}

const useStyles = tss.withName({ Admin }).create(() => ({
    header: {
        marginTop: fr.spacing("6v"),
        marginBottom: fr.spacing("4v")
    },
    section: {
        marginBottom: fr.spacing("8v")
    },
    sectionHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: fr.spacing("4v"),
        marginBottom: fr.spacing("4v"),
        flexWrap: "wrap"
    },
    cellCentered: {
        textAlign: "center"
    },
    labelCell: {
        maxWidth: "28ch",
        whiteSpace: "normal"
    },
    identifier: {
        opacity: 0.6,
        wordBreak: "break-all"
    }
}));
