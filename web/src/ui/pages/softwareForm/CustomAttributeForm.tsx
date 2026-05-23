import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import type { ApiTypes } from "api";
import type { NonPostableEvt } from "evt";
import { useEvt } from "evt/hooks";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useCoreState } from "../../../core";
import type { FormData } from "../../../core/usecases/softwareForm";
import { useLang } from "../../i18n";

type SoftwareProtectionFormFieldPrefix = "dereferencing" | "edition";

// Underscores are illegal in custom attribute names (^[a-zA-Z][a-zA-Z0-9]*$),
// so these field names can never collide with an admin-defined attribute.
type SoftwareProtectionFormValues = Record<
    `protection_${SoftwareProtectionFormFieldPrefix}_${"isProtected" | "reason"}`,
    string | undefined
>;

type CustomAttributesFormValues = ApiTypes.CustomAttributes &
    SoftwareProtectionFormValues;

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
    const { t } = useTranslation();
    const [submitButtonElement, setSubmitButtonElement] =
        useState<HTMLButtonElement | null>(null);
    const initialCustomAttributes = initialFormData?.customAttributes;
    const initialDereferencingProtection = initialFormData?.protections?.dereferencing;
    const initialEditionProtection = initialFormData?.protections?.edition;

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
        watch,
        trigger,
        formState: { errors }
    } = useForm<CustomAttributesFormValues>({
        defaultValues: {
            ...(initialCustomAttributes ?? {}),
            protection_dereferencing_isProtected:
                initialDereferencingProtection?.isProtected === true ? "true" : "false",
            protection_dereferencing_reason: initialDereferencingProtection?.reason ?? "",
            protection_edition_isProtected:
                initialEditionProtection?.isProtected === true ? "true" : "false",
            protection_edition_reason: initialEditionProtection?.reason ?? ""
        }
    });

    // Live feedback on the required-reason rule: react-hook-form only revalidates
    // after the first submit in its default mode, so revalidate the reason fields
    // ourselves whenever a protection radio flips.
    const dereferencingIsProtected = watch("protection_dereferencing_isProtected");
    const editionIsProtected = watch("protection_edition_isProtected");
    useEffect(() => {
        trigger(["protection_dereferencing_reason", "protection_edition_reason"]);
    }, [trigger, dereferencingIsProtected, editionIsProtected]);

    // Wait for attributeDefinitions to load before rendering — otherwise an admin
    // could submit while the (admin-only) attributes haven't loaded and
    // `getHiddenInitialValues` would silently drop them.
    if (attributeDefinitions === undefined) return null;
    if (attributeDefinitions.length === 0 && !isAdmin) return null;

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
                        attributeDefinitions: attributeDefinitions ?? [],
                        renderedAttributeDefinitions,
                        initialFormData: initialCustomAttributes
                    });

                    onSubmit({
                        customAttributes: {
                            ...valuesWithCorrectType,
                            ...hiddenInitialValues
                        },
                        protections: isAdmin
                            ? {
                                  dereferencing: {
                                      isProtected:
                                          values.protection_dereferencing_isProtected ===
                                          "true",
                                      reason:
                                          values.protection_dereferencing_reason?.trim() ||
                                          null
                                  },
                                  edition: {
                                      isProtected:
                                          values.protection_edition_isProtected ===
                                          "true",
                                      reason:
                                          values.protection_edition_reason?.trim() || null
                                  }
                              }
                            : initialFormData?.protections
                    });
                },
                err => {
                    console.log("ERROR in form : ", err);
                }
            )}
        >
            {isAdmin && (
                <>
                    <SoftwareProtectionFormSection
                        fieldPrefix="dereferencing"
                        labelText={t("softwareForm.dereferencingProtectionLabel")}
                        hintText={t("softwareForm.dereferencingProtectionHint")}
                        reasonLabel={t("softwareForm.dereferencingProtectionReasonLabel")}
                        register={register}
                        errors={errors}
                    />
                    <SoftwareProtectionFormSection
                        fieldPrefix="edition"
                        labelText={t("softwareForm.editionProtectionLabel")}
                        hintText={t("softwareForm.editionProtectionHint")}
                        reasonLabel={t("softwareForm.editionProtectionReasonLabel")}
                        register={register}
                        errors={errors}
                    />
                </>
            )}
            {renderedAttributeDefinitions.map(attributeDefinition => (
                <CustomAttributeFormField
                    key={attributeDefinition.name}
                    attributeDefinition={attributeDefinition}
                    initialValue={initialCustomAttributes?.[attributeDefinition.name]}
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

const SoftwareProtectionFormSection = ({
    fieldPrefix,
    labelText,
    hintText,
    reasonLabel,
    register,
    errors
}: {
    fieldPrefix: SoftwareProtectionFormFieldPrefix;
    labelText: ReactNode;
    hintText: ReactNode;
    reasonLabel: ReactNode;
    register: UseFormRegister<CustomAttributesFormValues>;
    errors: FieldErrors<CustomAttributesFormValues>;
}) => {
    const { t } = useTranslation();
    const isProtectedFieldName = `protection_${fieldPrefix}_isProtected` as const;
    const reasonFieldName = `protection_${fieldPrefix}_reason` as const;

    const label = (
        <>
            {labelText}{" "}
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
    );

    return (
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
            <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
                <RadioButtons
                    legend={label}
                    hintText={<strong>{hintText}</strong>}
                    options={[
                        {
                            label: t("app.yes"),
                            nativeInputProps: {
                                ...register(isProtectedFieldName),
                                value: "true"
                            }
                        },
                        {
                            label: t("app.no"),
                            nativeInputProps: {
                                ...register(isProtectedFieldName),
                                value: "false"
                            }
                        }
                    ]}
                />
            </div>
            <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
                <Input
                    label={reasonLabel}
                    state={errors[reasonFieldName] !== undefined ? "error" : undefined}
                    stateRelatedMessage={t("app.required")}
                    nativeInputProps={{
                        ...register(reasonFieldName, {
                            validate: (value, formValues) =>
                                formValues[isProtectedFieldName] !== "true" ||
                                (typeof value === "string" && value.trim() !== "")
                        })
                    }}
                />
            </div>
        </div>
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
    register: UseFormRegister<CustomAttributesFormValues>;
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
