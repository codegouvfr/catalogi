import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import type { ApiTypes } from "api";
import type { NonPostableEvt } from "evt";
import { useEvt } from "evt/hooks";
import { useMemo, useState } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useCoreState } from "../../../core";
import type { FormData } from "../../../core/usecases/softwareForm";
import { useLang } from "../../i18n";

export const CustomAttributesForm = ({
    className,
    initialFormData,
    onSubmit,
    evtActionSubmit
}: {
    className?: string;
    initialFormData: FormData["step3"] | undefined;
    onSubmit: (formData: FormData["step3"]) => void;
    evtActionSubmit: NonPostableEvt<void>;
}) => {
    const attributeDefinitions = useCoreState("uiConfig", "main")?.attributeDefinitions;
    const { currentUser } = useCoreState("userAuthentication", "currentUser");
    const isAdmin = currentUser?.role === "admin";
    const renderedAttributeDefinitions = useMemo(
        () =>
            attributeDefinitions?.filter(
                def => def.displayInForm && (!def.editableByAdminOnly || isAdmin)
            ) ?? [],
        [attributeDefinitions, isAdmin]
    );
    const [submitButtonElement, setSubmitButtonElement] =
        useState<HTMLButtonElement | null>(null);

    useEvt(
        ctx => {
            if (submitButtonElement === null) {
                return;
            }

            evtActionSubmit.attach(ctx, () => submitButtonElement.click());
        },
        [evtActionSubmit, submitButtonElement]
    );

    const {
        handleSubmit,
        register,
        formState: { errors }
    } = useForm<ApiTypes.CustomAttributes>({
        defaultValues: initialFormData
    });

    if (!attributeDefinitions || attributeDefinitions.length === 0) return null;

    return (
        <form
            className={className}
            onSubmit={handleSubmit(
                values => {
                    const valuesWithCorrectType = getConvertedSubmittedValues({
                        values,
                        renderedAttributeDefinitions
                    });

                    console.log({
                        raw: values,
                        converted: valuesWithCorrectType,
                        errors: errors
                    });

                    const hiddenInitialValues = getHiddenInitialValues({
                        attributeDefinitions,
                        renderedAttributeDefinitions,
                        initialFormData
                    });

                    onSubmit({
                        ...valuesWithCorrectType,
                        ...hiddenInitialValues
                    });
                },
                err => {
                    console.log("ERROR in form : ", err);
                }
            )}
        >
            {renderedAttributeDefinitions.map(attributeDefinition => (
                <CustomAttributeFormField
                    key={attributeDefinition.name}
                    attributeDefinition={attributeDefinition}
                    initialValue={initialFormData?.[attributeDefinition.name]}
                    register={register}
                    errors={errors}
                />
            ))}
            <button
                style={{ display: "none" }}
                ref={setSubmitButtonElement}
                type="submit"
            />
        </form>
    );
};

const getConvertedSubmittedValues = ({
    values,
    renderedAttributeDefinitions
}: {
    values: ApiTypes.CustomAttributes;
    renderedAttributeDefinitions: ApiTypes.AttributeDefinition[];
}): ApiTypes.CustomAttributes => {
    const convertedValues: ApiTypes.CustomAttributes = {};

    for (const [attributeName, rawValue] of Object.entries(values)) {
        const attributeDefinition = renderedAttributeDefinitions.find(
            def => def.name === attributeName
        );
        if (!attributeDefinition || rawValue === undefined) continue;

        const convertedValue = convertRawAttributeValueToCorrectType({
            attributeDefinition,
            rawValue
        });
        if (convertedValue !== undefined) convertedValues[attributeName] = convertedValue;
    }

    return convertedValues;
};

const getHiddenInitialValues = ({
    attributeDefinitions,
    renderedAttributeDefinitions,
    initialFormData
}: {
    attributeDefinitions: ApiTypes.AttributeDefinition[];
    renderedAttributeDefinitions: ApiTypes.AttributeDefinition[];
    initialFormData: ApiTypes.CustomAttributes | undefined;
}): ApiTypes.CustomAttributes => {
    const renderedAttributeNames = new Set(
        renderedAttributeDefinitions.map(def => def.name)
    );
    const hiddenInitialValues: ApiTypes.CustomAttributes = {};

    for (const attributeDefinition of attributeDefinitions) {
        if (renderedAttributeNames.has(attributeDefinition.name)) continue;
        if (!Object.hasOwn(initialFormData ?? {}, attributeDefinition.name)) continue;

        const value = initialFormData?.[attributeDefinition.name];
        if (value !== undefined) hiddenInitialValues[attributeDefinition.name] = value;
    }

    return hiddenInitialValues;
};

const CustomAttributeFormField = ({
    attributeDefinition,
    initialValue,
    register,
    errors
}: {
    attributeDefinition: ApiTypes.AttributeDefinition;
    initialValue: ApiTypes.AttributeValue | undefined;
    register: UseFormRegister<ApiTypes.CustomAttributes>;
    errors: FieldErrors<ApiTypes.CustomAttributes>;
}) => {
    const { lang } = useLang();
    const { t } = useTranslation();

    const localizedLabel =
        typeof attributeDefinition.label === "string"
            ? attributeDefinition.label
            : attributeDefinition.label[lang];
    const label = attributeDefinition.editableByAdminOnly ? (
        <>
            {localizedLabel}{" "}
            <span
                className={fr.cx(
                    "fr-badge",
                    "fr-badge--sm",
                    "fr-badge--yellow-tournesol"
                )}
            >
                <i
                    className={fr.cx("fr-icon-lock-line", "fr-icon--sm", "fr-mr-1v")}
                    aria-hidden="true"
                />
                {t("softwareForm.adminOnlyCustomAttributeBadge")}
            </span>
        </>
    ) : (
        localizedLabel
    );
    const hintText = attributeDefinition.editableByAdminOnly ? (
        <strong>{t("softwareForm.adminOnlyCustomAttributeHint")}</strong>
    ) : undefined;
    const attributeName = attributeDefinition.name;
    const isRequired = attributeDefinition.required;

    console.log({ attributeName, isRequired });

    switch (attributeDefinition.kind) {
        case "string":
        case "number":
        case "date":
        case "url":
            return (
                <Input
                    label={label}
                    hintText={hintText}
                    state={
                        isRequired && errors[attributeName] !== undefined
                            ? "error"
                            : undefined
                    }
                    stateRelatedMessage={t("app.required")}
                    nativeInputProps={{
                        ...register(attributeName, { required: isRequired }),
                        required: isRequired,
                        type: attributeDefinition.kind
                    }}
                />
            );

        case "boolean":
            return (
                <RadioButtons
                    legend={label}
                    hintText={hintText}
                    state={
                        isRequired && errors[attributeName] !== undefined
                            ? "error"
                            : undefined
                    }
                    stateRelatedMessage={isRequired ? t("app.required") : undefined}
                    options={[
                        {
                            label: t("app.yes"),
                            nativeInputProps: {
                                ...register(attributeName, { required: isRequired }),
                                value: "true",
                                defaultChecked: initialValue === true
                            }
                        },
                        {
                            label: t("app.no"),
                            nativeInputProps: {
                                ...register(attributeName),
                                value: "false",
                                defaultChecked: initialValue === false
                            }
                        },
                        ...(isRequired
                            ? []
                            : [
                                  {
                                      label: t("app.not applicable"),
                                      nativeInputProps: {
                                          ...register(attributeName),
                                          value: "not applicable",
                                          defaultChecked: initialValue === null
                                      }
                                  }
                              ])
                    ]}
                />
            );
        default:
            attributeDefinition.kind satisfies never;
            return null;
    }
};

const convertRawAttributeValueToCorrectType = ({
    attributeDefinition,
    rawValue
}: {
    attributeDefinition: ApiTypes.AttributeDefinition;
    rawValue: ApiTypes.AttributeValue;
}) => {
    switch (attributeDefinition.kind) {
        case "string":
        case "date":
        case "url":
            return rawValue ? rawValue : undefined;
        case "number":
            return rawValue !== null ? +rawValue : undefined;
        case "boolean": {
            if (typeof rawValue === "boolean") return rawValue;
            if (typeof rawValue !== "string") return undefined;
            if (rawValue.toLowerCase() === "true") return true;
            if (rawValue.toLowerCase() === "false") return false;
            if (rawValue === "not applicable") return null;
            return undefined;
        }
        default:
            attributeDefinition.kind satisfies never;
    }
};
