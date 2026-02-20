// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useState } from "react";
import { useForm } from "react-hook-form";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import type { NonPostableEvt } from "evt";
import { useEvt } from "evt/hooks";
import { assert } from "tsafe/assert";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import type { FormData } from "core/usecases/softwareForm";
import { useTranslation } from "react-i18next";

export type Step1Props = {
    className?: string;
    initialFormData: FormData["step1"] | undefined;
    onSubmit: (formData: FormData["step1"]) => void;
    evtActionSubmit: NonPostableEvt<void>;
};

export function SoftwareFormStep1(props: Step1Props) {
    const { className, initialFormData, onSubmit, evtActionSubmit } = props;

    const { t } = useTranslation();

    const {
        handleSubmit,
        register,
        formState: { errors },
        watch
    } = useForm<{
        softwareType: "cloud" | "stack" | "desktop/mobile";
        osCheckboxValues: string[] | undefined;
    }>({
        defaultValues: (() => {
            if (initialFormData === undefined) {
                return undefined;
            }

            const derivedType = initialFormData.runtimePlatforms.includes("cloud")
                ? ("cloud" as const)
                : initialFormData.runtimePlatforms.includes("desktop")
                  ? ("desktop/mobile" as const)
                  : ("stack" as const);

            return {
                softwareType: derivedType,
                osCheckboxValues:
                    derivedType === "desktop/mobile"
                        ? Object.entries(initialFormData.operatingSystems)
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
                                  operatingSystems: {
                                      windows: osCheckboxValues.includes("windows"),
                                      mac: osCheckboxValues.includes("mac"),
                                      linux: osCheckboxValues.includes("linux"),
                                      ios: osCheckboxValues.includes("ios"),
                                      android: osCheckboxValues.includes("android")
                                  },
                                  runtimePlatforms: ["desktop" as const]
                              };
                          })()
                        : softwareType === "cloud"
                          ? {
                                operatingSystems: {},
                                runtimePlatforms: ["cloud" as const]
                            }
                          : {
                                operatingSystems: {},
                                runtimePlatforms: []
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
                        label: t("softwareFormStep1.software desktop"),
                        nativeInputProps: {
                            ...register("softwareType", { required: true }),
                            value: "desktop/mobile"
                        }
                    },
                    {
                        label: t("softwareFormStep1.software cloud"),
                        hintText: t("softwareFormStep1.software cloud hint"),
                        nativeInputProps: {
                            ...register("softwareType", { required: true }),
                            value: "cloud"
                        }
                    },
                    {
                        label: t("softwareFormStep1.module"),
                        hintText: t("softwareFormStep1.module hint"),
                        nativeInputProps: {
                            ...register("softwareType", { required: true }),
                            value: "stack"
                        }
                    }
                ]}
            />
            {watch("softwareType") === "desktop/mobile" && (
                <Checkbox
                    legend={t("softwareFormStep1.checkbox legend")}
                    state={errors.osCheckboxValues !== undefined ? "error" : undefined}
                    stateRelatedMessage={t("app.required")}
                    options={[
                        {
                            label: "Windows",
                            nativeInputProps: {
                                ...register("osCheckboxValues", { required: true }),
                                value: "windows"
                            }
                        },
                        {
                            label: "GNU/Linux",
                            nativeInputProps: {
                                ...register("osCheckboxValues", { required: true }),
                                value: "linux"
                            }
                        },
                        {
                            label: "MacOS",
                            nativeInputProps: {
                                ...register("osCheckboxValues", { required: true }),
                                value: "mac"
                            }
                        },
                        {
                            label: "Android",
                            nativeInputProps: {
                                ...register("osCheckboxValues", { required: true }),
                                value: "android"
                            }
                        },
                        {
                            label: "iOS (iPhone)",
                            nativeInputProps: {
                                ...register("osCheckboxValues", { required: true }),
                                value: "ios"
                            }
                        }
                    ]}
                />
            )}
            <button
                style={{ display: "none" }}
                ref={setSubmitButtonElement}
                type="submit"
            />
        </form>
    );
}
