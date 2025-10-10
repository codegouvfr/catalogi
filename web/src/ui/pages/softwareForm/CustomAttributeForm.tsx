import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import type { ApiTypes } from "api";
import type { NonPostableEvt } from "evt";
import { useEvt } from "evt/hooks";
import { useState } from "react";
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
    } = useForm({
        defaultValues: initialFormData
    });

    if (!attributeDefinitions || attributeDefinitions.length === 0) return null;

    return (
        <form
            className={className}
            onSubmit={handleSubmit(
                values => {
                    const keys = Object.keys(values);

                    const valuesWithCorrectType = keys.reduce((acc, attributeName) => {
                        const attributeDefinition = attributeDefinitions.find(
                            def => def.name === attributeName
                        );
                        if (!attributeDefinition) return acc;
                        const rawValue = values[attributeName];
                        if (rawValue === undefined) return acc;

                        return {
                            ...acc,
                            [attributeName]: convertRawAttributeValueToCorrectType({
                                attributeDefinition,
                                rawValue
                            })
                        } as ApiTypes.CustomAttributes;
                    }, {} as ApiTypes.CustomAttributes);

                    console.log({
                        raw: values,
                        converted: valuesWithCorrectType,
                        errors: errors
                    });

                    onSubmit(valuesWithCorrectType);
                },
                err => {
                    console.log("ERROR in form : ", err);
                }
            )}
        >
            {attributeDefinitions.map(attributeDefinition => (
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

const CustomAttributeFormField = ({
    attributeDefinition,
    initialValue,
    register,
    errors
}: {
    attributeDefinition: ApiTypes.AttributeDefinition;
    initialValue: ApiTypes.AttributeValue | undefined;
    register: any;
    errors: any;
}) => {
    const { lang } = useLang();
    const { t } = useTranslation();

    const label =
        typeof attributeDefinition.label === "string"
            ? attributeDefinition.label
            : attributeDefinition.label[lang];
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
            if ((rawValue as string)?.toLowerCase() === "true") return true;
            if ((rawValue as string)?.toLowerCase() === "false") return false;
            if (rawValue === "not applicable") return null;
            return undefined;
        }
        default:
            attributeDefinition.kind satisfies never;
    }
};
