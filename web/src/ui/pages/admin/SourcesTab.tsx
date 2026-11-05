// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { tss } from "tss-react";
import { useTranslation } from "react-i18next";
import type { ApiTypes } from "api";
import { useCore, useCoreState } from "core";
import { LoadingFallback } from "ui/shared/LoadingFallback";
import { SourcesTable } from "./SourcesTable";

const lookupConfirmModal = createModal({
    id: "source-lookup-confirm",
    isOpenedByDefault: false
});

export function SourcesTab() {
    const { t } = useTranslation();
    const { classes } = useStyles();
    const { adminSources } = useCore().functions;
    const { isLoading, hasLoadFailed, categories } = useCoreState("adminSources", "main");

    useEffect(() => {
        adminSources.fetch();
    }, []);

    if (isLoading && categories.length === 0) return <LoadingFallback />;

    const loadFailedAlert = hasLoadFailed && (
        <Alert severity="error" small description={t("admin.sources.loadFailed")} />
    );
    if (categories.length === 0) return loadFailedAlert || null;

    return (
        <>
            {loadFailedAlert}
            <p className={classes.intro}>{t("admin.sources.intro")}</p>
            <LookupSourceSection categories={categories} />
            <CategoryOrderSection categories={categories} />
        </>
    );
}

function LookupSourceSection(props: { categories: ApiTypes.AdminSourceCategory[] }) {
    const { categories } = props;
    const { t } = useTranslation();
    const { classes } = useStyles();
    const { adminSources } = useCore().functions;
    const { isSaving } = useCoreState("adminSources", "main");

    const sources = categories.flatMap(({ sources }) => sources);
    const lookupSource = sources.find(source => source.isLookupSource);
    const candidates = sources.filter(source => source.canBeLookupSource);

    const [selectedSlug, setSelectedSlug] = useState(lookupSource?.slug ?? "");

    useEffect(() => {
        setSelectedSlug(lookupSource?.slug ?? "");
    }, [lookupSource?.slug]);

    const confirm = async () => {
        try {
            await adminSources.setLookupSource({ slug: selectedSlug });
            lookupConfirmModal.close();
        } catch {
            /* sillApi.errorHandler already alerted the user */
        }
    };

    return (
        <section className={classes.section}>
            <h2 className={fr.cx("fr-h4")}>{t("admin.sources.lookupTitle")}</h2>
            <p className={fr.cx("fr-text--sm")}>{t("admin.sources.lookupDescription")}</p>
            {lookupSource === undefined && (
                <p className={fr.cx("fr-error-text")}>
                    {t("admin.sources.noLookupSource")}
                </p>
            )}
            <div className={classes.lookupRow}>
                <Select
                    className={classes.lookupSelect}
                    label={t("admin.sources.lookupSelectLabel")}
                    nativeSelectProps={{
                        value: selectedSlug,
                        onChange: e => setSelectedSlug(e.target.value)
                    }}
                >
                    {lookupSource === undefined && <option value="" disabled />}
                    {candidates.map(source => (
                        <option key={source.slug} value={source.slug}>
                            {source.slug} ({source.kind})
                        </option>
                    ))}
                </Select>
                <Button
                    priority="secondary"
                    disabled={
                        isSaving ||
                        selectedSlug === "" ||
                        selectedSlug === lookupSource?.slug
                    }
                    onClick={() => lookupConfirmModal.open()}
                >
                    {t("admin.sources.lookupChange")}
                </Button>
            </div>

            <lookupConfirmModal.Component
                title={t("admin.sources.lookupConfirmTitle")}
                buttons={[
                    { doClosesModal: true, children: t("admin.sources.cancel") },
                    {
                        doClosesModal: false,
                        onClick: confirm,
                        nativeButtonProps: { disabled: isSaving },
                        children: t("admin.sources.lookupConfirm")
                    }
                ]}
            >
                {t("admin.sources.lookupConfirmBody", {
                    next: selectedSlug,
                    current: lookupSource?.slug ?? "—"
                })}
            </lookupConfirmModal.Component>
        </section>
    );
}

function CategoryOrderSection(props: { categories: ApiTypes.AdminSourceCategory[] }) {
    const { categories } = props;
    const { t } = useTranslation();
    const { classes } = useStyles();
    const { adminSources } = useCore().functions;
    const { isSaving } = useCoreState("adminSources", "main");

    // Keyed on the order itself: refetching after saving a source keeps an unsaved order.
    const savedOrderKey = categories.map(({ category }) => category).join(",");
    const savedOrder = useMemo(
        () => savedOrderKey.split(",") as ApiTypes.SourceCategory[],
        [savedOrderKey]
    );
    const [draftOrder, setDraftOrder] = useState<ApiTypes.SourceCategory[]>(savedOrder);

    useEffect(() => {
        setDraftOrder(savedOrder);
    }, [savedOrder]);

    const isDirty = draftOrder.some((category, index) => category !== savedOrder[index]);

    // Categories without sources keep their rank but are not shown.
    const shownCategories = draftOrder
        .map(categoryName => categories.find(({ category }) => category === categoryName))
        .filter(
            (category): category is ApiTypes.AdminSourceCategory =>
                category !== undefined && category.sources.length > 0
        );
    const lockedCount = shownCategories.filter(({ isLocked }) => isLocked).length;

    const move = (index: number, offset: -1 | 1) =>
        setDraftOrder(order => {
            const from = order.indexOf(shownCategories[index].category);
            const to = order.indexOf(shownCategories[index + offset].category);
            const next = [...order];
            [next[from], next[to]] = [next[to], next[from]];
            return next;
        });

    const saveOrder = async () => {
        try {
            await adminSources.reorderCategories({ categories: draftOrder });
        } catch {
            /* sillApi.errorHandler already alerted the user */
        }
    };

    return (
        <section className={classes.section}>
            <h2 className={fr.cx("fr-h4")}>{t("admin.sources.orderTitle")}</h2>
            <p className={fr.cx("fr-text--sm", "fr-mb-1v")}>
                {t("admin.sources.orderDescription")}
            </p>
            <p className={fr.cx("fr-text--sm")}>
                {t("admin.sources.orderAppliesImmediately")}
            </p>

            {isDirty && (
                <ButtonsGroup
                    inlineLayoutWhen="always"
                    buttonsSize="small"
                    buttons={[
                        {
                            priority: "primary",
                            disabled: isSaving,
                            onClick: saveOrder,
                            children: t("admin.sources.saveOrder")
                        },
                        {
                            priority: "secondary",
                            disabled: isSaving,
                            onClick: () => setDraftOrder(savedOrder),
                            children: t("admin.sources.cancelOrder")
                        }
                    ]}
                />
            )}

            {shownCategories.map((category, index) => {
                return (
                    <div key={category.category} className={classes.category}>
                        <div className={classes.categoryHeader}>
                            <span className={classes.rank}>{index + 1}</span>
                            <h3 className={fr.cx("fr-h6", "fr-mb-0")}>
                                {category.category}
                            </h3>
                            {category.isLocked ? (
                                <span className={fr.cx("fr-text--xs", "fr-mb-0")}>
                                    {t("admin.sources.locked")}
                                </span>
                            ) : (
                                <span className={classes.moveButtons}>
                                    <Button
                                        priority="tertiary no outline"
                                        size="small"
                                        iconId="fr-icon-arrow-up-line"
                                        title={t("admin.sources.moveUp", {
                                            category: category.category
                                        })}
                                        disabled={isSaving || index <= lockedCount}
                                        onClick={() => move(index, -1)}
                                    />
                                    <Button
                                        priority="tertiary no outline"
                                        size="small"
                                        iconId="fr-icon-arrow-down-line"
                                        title={t("admin.sources.moveDown", {
                                            category: category.category
                                        })}
                                        disabled={
                                            isSaving ||
                                            index === shownCategories.length - 1
                                        }
                                        onClick={() => move(index, 1)}
                                    />
                                </span>
                            )}
                        </div>
                        <SourcesTable
                            label={category.category}
                            sources={category.sources}
                        />
                    </div>
                );
            })}
        </section>
    );
}

const useStyles = tss.withName({ SourcesTab }).create(() => ({
    intro: {
        marginBottom: fr.spacing("6v")
    },
    section: {
        marginBottom: fr.spacing("8v")
    },
    lookupRow: {
        display: "flex",
        alignItems: "flex-end",
        gap: fr.spacing("4v"),
        flexWrap: "wrap",
        "& .fr-select-group": {
            marginBottom: 0
        }
    },
    lookupSelect: {
        minWidth: "20rem"
    },
    category: {
        border: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
        padding: fr.spacing("4v"),
        marginTop: fr.spacing("4v")
    },
    categoryHeader: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("3v"),
        marginBottom: fr.spacing("3v")
    },
    rank: {
        fontWeight: 700,
        minWidth: "1.5rem"
    },
    moveButtons: {
        marginLeft: "auto",
        display: "flex"
    }
}));
