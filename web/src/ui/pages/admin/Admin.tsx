// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { tss } from "tss-react";
import { assert } from "tsafe/assert";
import { Equals } from "tsafe";
import { useTranslation } from "react-i18next";
import { useCore, useCoreState } from "core";
import { routes } from "ui/routes";
import { LoadingFallback } from "ui/shared/LoadingFallback";
import { useResolveLocalizedString } from "ui/i18n";
import type { ApiTypes } from "api";
import type { PageRoute } from "./route";
import {
    AttributeDefinitionFormModal,
    openAttributeDefinitionFormModal,
    sectionLabelKeys
} from "./AttributeDefinitionFormModal";
import { UiConfigEditor } from "./UiConfigEditor";
import { SourcesTab } from "./SourcesTab";
import { SourceFormModal } from "./SourceFormModal";

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
    const uiConfig = useCoreState("uiConfig", "main")?.uiConfig;
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
        <div className={cx(fr.cx("fr-container"), className)}>
            <div className={classes.header}>
                <h1 className={fr.cx("fr-h2")}>{t("admin.title")}</h1>
            </div>

            <Tabs
                label={t("admin.title")}
                tabs={[
                    {
                        label: t("admin.catalogTab"),
                        content: (
                            <>
                                <section className={classes.section}>
                                    <div className={classes.sectionHeader}>
                                        <div>
                                            <h2 className={fr.cx("fr-h4")}>
                                                {t("admin.softwareEntries.title")}
                                            </h2>
                                            <p
                                                className={fr.cx(
                                                    "fr-text--sm",
                                                    "fr-mb-0"
                                                )}
                                            >
                                                {t(
                                                    uiConfig?.home.usecases
                                                        .addSoftwareOrService.enabled
                                                        ? "admin.softwareEntries.publicAdditionEnabledDescription"
                                                        : "admin.softwareEntries.publicAdditionDisabledDescription"
                                                )}
                                            </p>
                                        </div>
                                        <Button
                                            priority="primary"
                                            iconId="fr-icon-add-line"
                                            linkProps={routes.softwareCreationForm().link}
                                        >
                                            {t("admin.softwareEntries.addSoftware")}
                                        </Button>
                                    </div>
                                </section>

                                <section className={classes.section}>
                                    <div className={classes.sectionHeader}>
                                        <div>
                                            <h2 className={fr.cx("fr-h4")}>
                                                {t("admin.customAttributes.title")}
                                            </h2>
                                            <p
                                                className={fr.cx(
                                                    "fr-text--sm",
                                                    "fr-mb-0"
                                                )}
                                            >
                                                {t("admin.customAttributes.subtitle")}
                                            </p>
                                        </div>
                                        <Button
                                            priority="primary"
                                            iconId="fr-icon-add-line"
                                            onClick={() =>
                                                openAttributeDefinitionFormModal({
                                                    mode: "create"
                                                })
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
                                        <AttributeDefinitionsTable
                                            definitions={sortedDefinitions}
                                        />
                                    )}
                                </section>
                            </>
                        )
                    },
                    {
                        label: t("admin.sourcesTab"),
                        content: <SourcesTab />
                    },
                    {
                        label: t("admin.uiConfig.tab"),
                        content: <UiConfigEditor />
                    }
                ]}
            />

            <AttributeDefinitionFormModal />
            <SourceFormModal />
        </div>
    );
}

function AttributeDefinitionsTable(props: {
    definitions: ApiTypes.AttributeDefinition[];
}) {
    const { definitions } = props;
    const { t } = useTranslation();
    const { classes } = useStyles();
    const { adminAttributes } = useCore().functions;
    const { isSaving } = useCoreState("adminAttributes", "main");

    // Unsaved order, kept across refetches; attributes created meanwhile go last.
    const [draftOrder, setDraftOrder] = useState<string[] | undefined>(undefined);
    const draftRank = ({ name }: ApiTypes.AttributeDefinition) => {
        const rank = draftOrder?.indexOf(name) ?? -1;
        return rank === -1 ? definitions.length : rank;
    };
    const orderedDefinitions =
        draftOrder === undefined
            ? definitions
            : [...definitions].sort((a, b) => draftRank(a) - draftRank(b));
    const isDirty = orderedDefinitions.some(
        (def, index) => def.name !== definitions[index].name
    );

    const move = (index: number, offset: -1 | 1) => {
        const next = orderedDefinitions.map(def => def.name);
        [next[index], next[index + offset]] = [next[index + offset], next[index]];
        setDraftOrder(next);
    };

    const saveOrder = async () => {
        try {
            await adminAttributes.reorder({
                names: orderedDefinitions.map(def => def.name)
            });
            setDraftOrder(undefined);
        } catch {
            /* sillApi.errorHandler already alerted the user */
        }
    };

    const headers: { label: string; centered?: boolean }[] = [
        { label: t("admin.customAttributes.columnDisplayOrder") },
        { label: t("admin.customAttributes.columnKind") },
        { label: t("admin.customAttributes.columnLabel") },
        { label: t("admin.customAttributes.columnDisplayInForm"), centered: true },
        { label: t("admin.customAttributes.columnEditableBy"), centered: true },
        { label: t("admin.customAttributes.columnDisplayInDetails"), centered: true },
        { label: t("admin.customAttributes.columnEnableFiltering"), centered: true },
        { label: t("admin.customAttributes.columnRequired"), centered: true },
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
                                {orderedDefinitions.map((def, index) => (
                                    <AttributeDefinitionRow
                                        key={def.name}
                                        def={def}
                                        rank={index + 1}
                                        canMoveUp={!isSaving && index > 0}
                                        canMoveDown={
                                            !isSaving &&
                                            index < orderedDefinitions.length - 1
                                        }
                                        onMove={offset => move(index, offset)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {isDirty && (
                <ButtonsGroup
                    className={classes.orderButtons}
                    inlineLayoutWhen="always"
                    buttonsSize="small"
                    buttons={[
                        {
                            priority: "primary",
                            disabled: isSaving,
                            onClick: saveOrder,
                            children: t("admin.customAttributes.saveOrder")
                        },
                        {
                            priority: "secondary",
                            disabled: isSaving,
                            onClick: () => setDraftOrder(undefined),
                            children: t("admin.customAttributes.cancelOrder")
                        }
                    ]}
                />
            )}
        </div>
    );
}

function AttributeDefinitionRow(props: {
    def: ApiTypes.AttributeDefinition;
    rank: number;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMove: (offset: -1 | 1) => void;
}) {
    const { def, rank, canMoveUp, canMoveDown, onMove } = props;
    const { t } = useTranslation();
    const { classes, cx } = useStyles();
    const { resolveLocalizedString } = useResolveLocalizedString();

    const displayLabel = resolveLocalizedString(def.label) || def.name;

    return (
        <tr>
            <td>
                <span className={classes.moveButtons}>
                    <span className={classes.rank}>{rank}</span>
                    <Button
                        priority="tertiary no outline"
                        size="small"
                        iconId="fr-icon-arrow-up-line"
                        title={t("admin.customAttributes.moveUp", {
                            label: displayLabel
                        })}
                        disabled={!canMoveUp}
                        onClick={() => onMove(-1)}
                    />
                    <Button
                        priority="tertiary no outline"
                        size="small"
                        iconId="fr-icon-arrow-down-line"
                        title={t("admin.customAttributes.moveDown", {
                            label: displayLabel
                        })}
                        disabled={!canMoveDown}
                        onClick={() => onMove(1)}
                    />
                </span>
            </td>
            <td>{def.kind}</td>
            <td className={cx(fr.cx("fr-cell--multiline"), classes.labelCell)}>
                <div>{displayLabel}</div>
                <code className={cx(fr.cx("fr-text--xs"), classes.identifier)}>
                    {def.name}
                </code>
                {def.detailsSubsection !== undefined && (
                    <div
                        className={cx(fr.cx("fr-text--xs", "fr-mb-0"), classes.placement)}
                    >
                        {`${t(sectionLabelKeys[def.detailsSection])} › ${resolveLocalizedString(def.detailsSubsection)}`}
                    </div>
                )}
            </td>
            <td className={classes.cellCentered}>{def.displayInForm ? "✅" : "❌"}</td>
            <td className={classes.cellCentered}>
                {def.editableByAdminOnly
                    ? t("admin.customAttributes.editableByAdminOnly")
                    : t("admin.customAttributes.editableByEveryone")}
            </td>
            <td className={classes.cellCentered}>{def.displayInDetails ? "✅" : "❌"}</td>
            <td className={classes.cellCentered}>{def.enableFiltering ? "✅" : "❌"}</td>
            <td className={classes.cellCentered}>{def.required ? "✅" : "❌"}</td>
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
    orderButtons: {
        marginTop: fr.spacing("4v")
    },
    moveButtons: {
        display: "inline-flex",
        alignItems: "center",
        gap: fr.spacing("1v")
    },
    rank: {
        minWidth: "1.5rem",
        fontWeight: "bold"
    },
    labelCell: {
        minWidth: "14rem"
    },
    placement: {
        color: fr.colors.decisions.text.mention.grey.default
    },
    identifier: {
        opacity: 0.6,
        wordBreak: "break-all"
    }
}));
