import { useState } from "react";
import { useForm } from "react-hook-form";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import type { NonPostableEvt } from "evt";
import { useEvt } from "evt/hooks";
import { assert } from "tsafe/assert";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import type { FormData } from "core/usecases/softwareForm";
import { declareComponentKeys } from "i18nifty";
import { useTranslation } from "ui/i18n";

export type Step1Props = {
    className?: string;
    initialFormData: FormData["step1"] | undefined;
    onSubmit: (formData: FormData["step1"]) => void;
    evtActionSubmit: NonPostableEvt<void>;
};

export function SoftwareFormStep1(props: Step1Props) {
    const { className, initialFormData, onSubmit, evtActionSubmit } = props;

    const { t } = useTranslation({ SoftwareFormStep1 });
    const { t: tCommon } = useTranslation({ App: null });

    const {
        handleSubmit,
        register,
        formState: { errors },
        watch
    } = useForm<{
        softwareType: "cloud" | "stack" | "desktop/mobile";
        osCheckboxValues: string[] | undefined;
    }>({
        "defaultValues": (() => {
            if (initialFormData === undefined) {
                return undefined;
            }

            return {
                "softwareType": initialFormData.softwareType.type,
                "osCheckboxValues":
                    initialFormData.softwareType.type === "desktop/mobile"
                        ? Object.entries(initialFormData.softwareType.os)
                              .filter(([, value]) => value)
                              .map(([key]) => key)
                        : undefined
            };
        })()
    });

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

    return (
        <form
            className={className}
            onSubmit={handleSubmit(({ softwareType, osCheckboxValues }) =>
                onSubmit(
                    softwareType === "desktop/mobile"
                        ? (() => {
                              assert(osCheckboxValues !== undefined);

                              return {
                                  "softwareType": {
                                      "type": softwareType,
                                      "os": {
                                          "windows": osCheckboxValues.includes("windows"),
                                          "mac": osCheckboxValues.includes("mac"),
                                          "linux": osCheckboxValues.includes("linux"),
                                          "ios": osCheckboxValues.includes("ios"),
                                          "android": osCheckboxValues.includes("android")
                                      }
                                  }
                              };
                          })()
                        : {
                              "softwareType": {
                                  "type": softwareType
                              }
                          }
                )
            )}
        >
            <RadioButtons
                legend=""
                state={errors.softwareType !== undefined ? "error" : undefined}
                stateRelatedMessage="This is field is required"
                options={[
                    {
                        "label": t("software desktop"),
                        "nativeInputProps": {
                            ...register("softwareType", { "required": true }),
                            "value": "desktop/mobile"
                        }
                    },
                    {
                        "label": t("software cloud"),
                        "hintText": t("software cloud hint"),
                        "nativeInputProps": {
                            ...register("softwareType", { "required": true }),
                            "value": "cloud"
                        }
                    },
                    {
                        "label": t("module"),
                        "hintText": t("module hint"),
                        "nativeInputProps": {
                            ...register("softwareType", { "required": true }),
                            "value": "stack"
                        }
                    }
                ]}
            />
            {watch("softwareType") === "desktop/mobile" && (
                <Checkbox
                    legend={t("checkbox legend")}
                    state={errors.osCheckboxValues !== undefined ? "error" : undefined}
                    stateRelatedMessage={tCommon("required")}
                    options={[
                        {
                            "label": "Windows",
                            "nativeInputProps": {
                                ...register("osCheckboxValues", { "required": true }),
                                "value": "windows"
                            }
                        },
                        {
                            "label": "GNU/Linux",
                            "nativeInputProps": {
                                ...register("osCheckboxValues", { "required": true }),
                                "value": "linux"
                            }
                        },
                        {
                            "label": "MacOS",
                            "nativeInputProps": {
                                ...register("osCheckboxValues", { "required": true }),
                                "value": "mac"
                            }
                        },
                        {
                            "label": "Android",
                            "nativeInputProps": {
                                ...register("osCheckboxValues", { "required": true }),
                                "value": "android"
                            }
                        },
                        {
                            "label": "iOS (iPhone)",
                            "nativeInputProps": {
                                ...register("osCheckboxValues", { "required": true }),
                                "value": "ios"
                            }
                        }
                    ]}
                />
            )}
            <button
                style={{ "display": "none" }}
                ref={setSubmitButtonElement}
                type="submit"
            />
        </form>
    );
}

export const { i18n } = declareComponentKeys<
    | "software desktop"
    | "software cloud"
    | "software cloud hint"
    | "module"
    | "module hint"
    | "checkbox legend"
>()({ SoftwareFormStep1 });
