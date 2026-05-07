// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Evt } from "evt";
import { useRerenderOnStateChange } from "evt/hooks";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import { useCore, useCoreState } from "core";
import type { ApiTypes, LocalizedString } from "api";
import {
    attributeCardIconValues,
    iconClassByValue,
    type AttributeCardIcon
} from "ui/shared/attributeIcons";

const modal = createModal({
    id: "attribute-definition-form",
    isOpenedByDefault: false
});

type Mode =
    | { mode: "create" }
    | { mode: "edit"; definition: ApiTypes.AttributeDefinition };

const evtParams = Evt.create<Mode | undefined>(undefined);

evtParams.toStateless().attach(() => modal.open());

export function openAttributeDefinitionFormModal(params: Mode) {
    evtParams.state = params;
}

const NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]*$/;

const KIND_VALUES = ["boolean", "string", "number", "date", "url"] as const;

type FormState = {
    name: string;
    kind: ApiTypes.AttributeKind;
    labelFr: string;
    labelEn: string;
    descriptionFr: string;
    descriptionEn: string;
    displayInForm: boolean;
    displayInDetails: boolean;
    enableFiltering: boolean;
    required: boolean;
    displayInCardIcon: "" | AttributeCardIcon;
    displayOrder: number;
};

function pickLang(value: LocalizedString | undefined, lang: "fr" | "en"): string {
    if (value === undefined) return "";
    if (typeof value === "string") return lang === "fr" ? value : "";
    return value[lang] ?? "";
}

function makeInitialState(params: Mode | undefined): FormState {
    if (params?.mode === "edit") {
        const def = params.definition;
        return {
            name: def.name,
            kind: def.kind,
            labelFr: pickLang(def.label, "fr"),
            labelEn: pickLang(def.label, "en"),
            descriptionFr: pickLang(def.description, "fr"),
            descriptionEn: pickLang(def.description, "en"),
            displayInForm: def.displayInForm,
            displayInDetails: def.displayInDetails,
            enableFiltering: def.enableFiltering,
            required: def.required,
            displayInCardIcon: def.displayInCardIcon ?? "",
            displayOrder: def.displayOrder
        };
    }
    return {
        name: "",
        kind: "boolean",
        labelFr: "",
        labelEn: "",
        descriptionFr: "",
        descriptionEn: "",
        displayInForm: true,
        displayInDetails: true,
        enableFiltering: false,
        required: false,
        displayInCardIcon: "",
        displayOrder: 0
    };
}

export function AttributeDefinitionFormModal() {
    const { t } = useTranslation();
    const { classes } = useStyles();
    const { adminAttributes } = useCore().functions;
    const { isSaving } = useCoreState("adminAttributes", "main");

    useRerenderOnStateChange(evtParams);
    const params = evtParams.state;

    const isEdit = params?.mode === "edit";

    const [form, setForm] = useState<FormState>(() => makeInitialState(params));
    const [errors, setErrors] = useState<{ name?: string; label?: string }>({});

    useEffect(() => {
        setForm(makeInitialState(params));
        setErrors({});
    }, [params]);

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const submit = async () => {
        const newErrors: { name?: string; label?: string } = {};
        if (!isEdit && !NAME_REGEX.test(form.name)) {
            newErrors.name = t("admin.form.errors.invalidName");
        }
        if (!form.labelFr.trim() || !form.labelEn.trim()) {
            newErrors.label = t("admin.form.errors.labelRequired");
        }
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const trimDescFr = form.descriptionFr.trim();
        const trimDescEn = form.descriptionEn.trim();
        const description =
            trimDescFr || trimDescEn
                ? {
                      ...(trimDescFr && { fr: trimDescFr }),
                      ...(trimDescEn && { en: trimDescEn })
                  }
                : undefined;

        const shared = {
            label: { fr: form.labelFr.trim(), en: form.labelEn.trim() },
            description,
            displayInForm: form.displayInForm,
            displayInDetails: form.displayInDetails,
            enableFiltering: form.enableFiltering,
            required: form.required,
            displayInCardIcon:
                form.displayInCardIcon === "" ? undefined : form.displayInCardIcon,
            displayOrder: form.displayOrder
        };

        try {
            if (isEdit) {
                await adminAttributes.update({ name: form.name, ...shared });
            } else {
                await adminAttributes.create({
                    name: form.name,
                    kind: form.kind,
                    ...shared
                });
            }
            modal.close();
        } catch {
            /* keep modal open; sillApi.errorHandler already alerted the user */
        }
    };

    return (
        <modal.Component
            title={isEdit ? t("admin.form.editTitle") : t("admin.form.createTitle")}
            buttons={[
                {
                    doClosesModal: true,
                    children: t("admin.form.cancel")
                },
                {
                    doClosesModal: false,
                    onClick: submit,
                    nativeButtonProps: { disabled: isSaving },
                    children: t("admin.form.save")
                }
            ]}
        >
            <h3 className={fr.cx("fr-h6")}>{t("admin.form.sectionIdentifier")}</h3>
            <Input
                label={t("admin.form.name")}
                hintText={
                    isEdit
                        ? t("admin.form.nameHint")
                        : `${t("admin.form.nameHint")} — ${t("admin.form.lockedAfterCreate")}`
                }
                disabled={isEdit}
                state={errors.name ? "error" : "default"}
                stateRelatedMessage={errors.name}
                nativeInputProps={{
                    value: form.name,
                    onChange: e => update("name", e.target.value),
                    placeholder: t("admin.form.namePlaceholder")
                }}
            />
            <Select
                label={t("admin.form.kind")}
                hint={isEdit ? undefined : t("admin.form.lockedAfterCreate")}
                disabled={isEdit}
                nativeSelectProps={{
                    value: form.kind,
                    onChange: e =>
                        update("kind", e.target.value as ApiTypes.AttributeKind)
                }}
            >
                {KIND_VALUES.map(k => (
                    <option key={k} value={k}>
                        {k}
                    </option>
                ))}
            </Select>

            <h3 className={fr.cx("fr-h6", "fr-mt-4w")}>
                {t("admin.form.sectionDisplay")}
            </h3>
            <Input
                label={t("admin.form.labelFr")}
                state={errors.label ? "error" : "default"}
                stateRelatedMessage={errors.label}
                nativeInputProps={{
                    value: form.labelFr,
                    onChange: e => update("labelFr", e.target.value)
                }}
            />
            <Input
                label={t("admin.form.labelEn")}
                nativeInputProps={{
                    value: form.labelEn,
                    onChange: e => update("labelEn", e.target.value)
                }}
            />
            <Input
                label={t("admin.form.descriptionFr")}
                textArea
                nativeTextAreaProps={{
                    value: form.descriptionFr,
                    onChange: e => update("descriptionFr", e.target.value)
                }}
            />
            <Input
                label={t("admin.form.descriptionEn")}
                textArea
                nativeTextAreaProps={{
                    value: form.descriptionEn,
                    onChange: e => update("descriptionEn", e.target.value)
                }}
            />
            <fieldset className={fr.cx("fr-fieldset")}>
                <legend className={fr.cx("fr-fieldset__legend")}>
                    {t("admin.form.displayInCardIcon")}
                </legend>
                <div className={`${fr.cx("fr-fieldset__content")} ${classes.iconRow}`}>
                    <IconChoice
                        selected={form.displayInCardIcon === ""}
                        label={t("admin.form.iconNone")}
                        onClick={() => update("displayInCardIcon", "")}
                    >
                        <span aria-hidden="true">—</span>
                    </IconChoice>
                    {attributeCardIconValues.map(v => (
                        <IconChoice
                            key={v}
                            selected={form.displayInCardIcon === v}
                            label={v}
                            onClick={() => update("displayInCardIcon", v)}
                        >
                            <i
                                className={fr.cx(iconClassByValue[v])}
                                aria-hidden="true"
                            />
                        </IconChoice>
                    ))}
                </div>
            </fieldset>
            <Input
                label={t("admin.form.displayOrder")}
                nativeInputProps={{
                    type: "number",
                    value: form.displayOrder,
                    onChange: e =>
                        update("displayOrder", Number.parseInt(e.target.value, 10) || 0)
                }}
            />

            <h3 className={fr.cx("fr-h6", "fr-mt-4w")}>
                {t("admin.form.sectionBehavior")}
            </h3>
            <Checkbox
                options={[
                    {
                        label: t("admin.form.displayInForm"),
                        nativeInputProps: {
                            checked: form.displayInForm,
                            onChange: e => update("displayInForm", e.target.checked)
                        }
                    },
                    {
                        label: t("admin.form.displayInDetails"),
                        nativeInputProps: {
                            checked: form.displayInDetails,
                            onChange: e => update("displayInDetails", e.target.checked)
                        }
                    },
                    {
                        label: t("admin.form.enableFiltering"),
                        nativeInputProps: {
                            checked: form.enableFiltering,
                            onChange: e => update("enableFiltering", e.target.checked)
                        }
                    },
                    {
                        label: t("admin.form.required"),
                        nativeInputProps: {
                            checked: form.required,
                            onChange: e => update("required", e.target.checked)
                        }
                    }
                ]}
            />
        </modal.Component>
    );
}

function IconChoice(props: {
    selected: boolean;
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    const { selected, label, onClick, children } = props;
    const { classes, cx } = useStyles();
    return (
        <button
            type="button"
            title={label}
            aria-pressed={selected}
            onClick={onClick}
            className={cx(
                fr.cx("fr-btn", "fr-btn--sm", !selected && "fr-btn--tertiary"),
                classes.iconButton
            )}
        >
            {children}
        </button>
    );
}

const useStyles = tss.withName({ AttributeDefinitionFormModal }).create(() => ({
    iconRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: fr.spacing("2v")
    },
    iconButton: {
        width: 40,
        height: 40,
        padding: 0,
        justifyContent: "center"
    }
}));
