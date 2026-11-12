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
import { Button } from "@codegouvfr/react-dsfr/Button";
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
const OPTION_VALUE_REGEX = /^[a-zA-Z][a-zA-Z0-9-]*$/;

const KIND_VALUES = [
    "boolean",
    "string",
    "number",
    "date",
    "url",
    "enum",
    "text"
] as const;

const SEVERITY_VALUES = ["success", "warning", "error", "info", "new"] as const;

type OptionFormState = {
    value: string;
    labelFr: string;
    labelEn: string;
    severity: "" | ApiTypes.AttributeOptionSeverity;
    isSaved: boolean;
};

const makeEmptyOption = (): OptionFormState => ({
    value: "",
    labelFr: "",
    labelEn: "",
    severity: "",
    isSaved: false
});

type OptionErrors = { value?: string; labelFr?: boolean; labelEn?: boolean };

type FormErrors = {
    name?: string;
    kind?: string;
    label?: string;
    options?: OptionErrors[];
};

type FormState = {
    name: string;
    kind: "" | ApiTypes.AttributeKind;
    labelFr: string;
    labelEn: string;
    descriptionFr: string;
    descriptionEn: string;
    displayInForm: boolean;
    editableByAdminOnly: boolean;
    displayInDetails: boolean;
    enableFiltering: boolean;
    required: boolean;
    displayInCardIcon: "" | AttributeCardIcon;
    options: OptionFormState[];
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
            editableByAdminOnly: def.editableByAdminOnly,
            displayInDetails: def.displayInDetails,
            enableFiltering: def.enableFiltering,
            required: def.required,
            displayInCardIcon: def.displayInCardIcon ?? "",
            options: (def.options ?? []).map(option => ({
                value: option.value,
                labelFr: pickLang(option.label, "fr"),
                labelEn: pickLang(option.label, "en"),
                severity: option.severity ?? "",
                isSaved: true
            }))
        };
    }
    return {
        name: "",
        kind: "",
        labelFr: "",
        labelEn: "",
        descriptionFr: "",
        descriptionEn: "",
        displayInForm: true,
        editableByAdminOnly: false,
        displayInDetails: true,
        enableFiltering: false,
        required: false,
        displayInCardIcon: "",
        options: [makeEmptyOption()]
    };
}

export function AttributeDefinitionFormModal() {
    const { t } = useTranslation();
    const { classes, cx } = useStyles();
    const { adminAttributes } = useCore().functions;
    const { isSaving } = useCoreState("adminAttributes", "main");

    useRerenderOnStateChange(evtParams);
    const params = evtParams.state;

    const isEdit = params?.mode === "edit";

    const [form, setForm] = useState<FormState>(() => makeInitialState(params));
    const [errors, setErrors] = useState<FormErrors>({});

    useEffect(() => {
        setForm(makeInitialState(params));
        setErrors({});
    }, [params]);

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const updateOption = <K extends keyof OptionFormState>(
        index: number,
        key: K,
        value: OptionFormState[K]
    ) =>
        setForm(prev => ({
            ...prev,
            options: prev.options.map((option, i) =>
                i === index ? { ...option, [key]: value } : option
            )
        }));

    const isEnum = form.kind === "enum";

    const submit = async () => {
        const newErrors: FormErrors = {};
        if (!isEdit && !NAME_REGEX.test(form.name)) {
            newErrors.name = t("admin.form.errors.invalidName");
        }
        if (form.kind === "") {
            newErrors.kind = t("admin.form.errors.kindRequired");
        }
        if (!form.labelFr.trim() || !form.labelEn.trim()) {
            newErrors.label = t("admin.form.errors.labelRequired");
        }
        if (isEnum) {
            const optionErrors = form.options.map(
                (option, index): OptionErrors => ({
                    value: !OPTION_VALUE_REGEX.test(option.value)
                        ? t("admin.form.errors.invalidOptionValue")
                        : form.options.findIndex(
                                ({ value }) => value === option.value
                            ) !== index
                          ? t("admin.form.errors.duplicateOptionValue")
                          : undefined,
                    labelFr: !option.labelFr.trim(),
                    labelEn: !option.labelEn.trim()
                })
            );
            if (optionErrors.some(e => e.value || e.labelFr || e.labelEn)) {
                newErrors.options = optionErrors;
            }
        }
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0 || form.kind === "") return;

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
            editableByAdminOnly: form.editableByAdminOnly,
            displayInDetails: form.displayInDetails,
            enableFiltering: form.enableFiltering,
            required: form.required,
            displayInCardIcon:
                form.displayInCardIcon === "" ? undefined : form.displayInCardIcon,
            options: isEnum
                ? form.options.map(option => ({
                      value: option.value,
                      label: { fr: option.labelFr.trim(), en: option.labelEn.trim() },
                      severity: option.severity === "" ? undefined : option.severity
                  }))
                : undefined
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
            size="large"
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
                state={errors.kind ? "error" : "default"}
                stateRelatedMessage={errors.kind}
                nativeSelectProps={{
                    value: form.kind,
                    onChange: e =>
                        update("kind", e.target.value as ApiTypes.AttributeKind)
                }}
            >
                <option value="" disabled>
                    {t("admin.form.kindPlaceholder")}
                </option>
                {KIND_VALUES.map(k => (
                    <option key={k} value={k}>
                        {k}
                    </option>
                ))}
            </Select>
            {isEnum && (
                <fieldset className={fr.cx("fr-fieldset")}>
                    <legend className={fr.cx("fr-fieldset__legend")}>
                        {t("admin.form.options")}
                        <span className={fr.cx("fr-hint-text")}>
                            {t("admin.form.optionsHint")}
                        </span>
                    </legend>
                    {form.options.map((option, index) => {
                        const optionErrors = errors.options?.[index];
                        return (
                            <div
                                key={index}
                                className={cx(
                                    fr.cx("fr-fieldset__element"),
                                    classes.option
                                )}
                            >
                                <Input
                                    label={t("admin.form.optionValue")}
                                    disabled={option.isSaved}
                                    state={optionErrors?.value ? "error" : "default"}
                                    stateRelatedMessage={optionErrors?.value}
                                    nativeInputProps={{
                                        value: option.value,
                                        onChange: e =>
                                            updateOption(index, "value", e.target.value)
                                    }}
                                />
                                <Input
                                    label={t("admin.form.labelFr")}
                                    state={optionErrors?.labelFr ? "error" : "default"}
                                    stateRelatedMessage={t("app.required")}
                                    nativeInputProps={{
                                        value: option.labelFr,
                                        onChange: e =>
                                            updateOption(index, "labelFr", e.target.value)
                                    }}
                                />
                                <Input
                                    label={t("admin.form.labelEn")}
                                    state={optionErrors?.labelEn ? "error" : "default"}
                                    stateRelatedMessage={t("app.required")}
                                    nativeInputProps={{
                                        value: option.labelEn,
                                        onChange: e =>
                                            updateOption(index, "labelEn", e.target.value)
                                    }}
                                />
                                <Select
                                    label={t("admin.form.optionSeverity")}
                                    nativeSelectProps={{
                                        value: option.severity,
                                        onChange: e =>
                                            updateOption(
                                                index,
                                                "severity",
                                                e.target
                                                    .value as OptionFormState["severity"]
                                            )
                                    }}
                                >
                                    <option value="">
                                        {t("admin.form.severityNone")}
                                    </option>
                                    {SEVERITY_VALUES.map(severity => (
                                        <option key={severity} value={severity}>
                                            {t(`admin.form.severities.${severity}`)}
                                        </option>
                                    ))}
                                </Select>
                                <Button
                                    type="button"
                                    className={classes.removeOption}
                                    priority="tertiary no outline"
                                    iconId="fr-icon-delete-line"
                                    title={`${t("admin.form.removeOption")} ${option.value || index + 1}`}
                                    disabled={form.options.length === 1}
                                    onClick={() =>
                                        update(
                                            "options",
                                            form.options.filter((_, i) => i !== index)
                                        )
                                    }
                                />
                            </div>
                        );
                    })}
                    <div className={fr.cx("fr-fieldset__element")}>
                        <Button
                            type="button"
                            priority="secondary"
                            size="small"
                            iconId="fr-icon-add-line"
                            onClick={() =>
                                update("options", [...form.options, makeEmptyOption()])
                            }
                        >
                            {t("admin.form.addOption")}
                        </Button>
                    </div>
                </fieldset>
            )}

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
                        label: t("admin.form.editableByAdminOnly"),
                        nativeInputProps: {
                            checked: form.editableByAdminOnly,
                            onChange: e => update("editableByAdminOnly", e.target.checked)
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
    option: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto",
        alignItems: "start",
        columnGap: fr.spacing("4v"),
        [fr.breakpoints.down("md")]: {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
        }
    },
    removeOption: {
        marginTop: fr.spacing("8v")
    },
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
