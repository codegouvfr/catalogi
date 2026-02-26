// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import type { NonPostableEvt } from "evt";
import { useEvt } from "evt/hooks";
import { fr } from "@codegouvfr/react-dsfr";
import { SearchMultiInput } from "ui/shared/SearchMultiInput";
import type { FormData } from "core/usecases/softwareForm";
import type { useCore } from "core";
import { useResolveLocalizedString } from "ui/i18n";
import { useTranslation } from "react-i18next";
import type { ReturnType } from "tsafe";

export type Step4Props = {
    className?: string;
    initialFormData: FormData["step4"] | undefined;
    onSubmit: (formData: FormData["step4"]) => void;
    evtActionSubmit: NonPostableEvt<void>;
    getExternalSoftwareOptions: (
        queryString: string
    ) => Promise<
        ReturnType<
            ReturnType<
                typeof useCore
            >["functions"]["softwareForm"]["getExternalSoftwareOptions"]
        >
    >;
};

export function SoftwareFormStep4(props: Step4Props) {
    const {
        className,
        initialFormData,
        onSubmit,
        evtActionSubmit,
        getExternalSoftwareOptions
    } = props;

    const { t } = useTranslation();
    const { handleSubmit, control } = useForm<FormData["step4"]>({
        defaultValues: (() => {
            if (initialFormData === undefined) {
                return {
                    similarSoftwares: []
                };
            }

            return initialFormData;
        })()
    });

    const [submitButtonElement, setSubmitButtonElement] =
        useState<HTMLButtonElement | null>(null);

    const { resolveLocalizedString } = useResolveLocalizedString();

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
            onSubmit={handleSubmit(formData => onSubmit(formData))}
        >
            <Controller
                name="similarSoftwares"
                control={control}
                render={({ field }) => (
                    <SearchMultiInput
                        debounceDelay={400}
                        getOptions={getExternalSoftwareOptions}
                        value={field.value}
                        onValueChange={value => field.onChange(value)}
                        getOptionLabel={wikidataEntry =>
                            resolveLocalizedString(wikidataEntry.name)
                        }
                        renderOption={(liProps, entity) => (
                            <li {...liProps}>
                                <div>
                                    <span>{resolveLocalizedString(entity.name)}</span>
                                    <br />
                                    <span className={fr.cx("fr-text--xs")}>
                                        {resolveLocalizedString(entity.description)}
                                    </span>
                                </div>
                            </li>
                        )}
                        noOptionText={t("app.no result")}
                        loadingText={t("app.loading")}
                        dsfrInputProps={{
                            label: t("softwareFormStep4.similar software"),
                            hintText: t("softwareFormStep4.similar software hint"),
                            nativeInputProps: {
                                ref: field.ref,
                                onBlur: field.onBlur,
                                name: field.name
                            }
                        }}
                    />
                )}
            />
            <button
                style={{ display: "none" }}
                ref={setSubmitButtonElement}
                type="submit"
            />
        </form>
    );
}
