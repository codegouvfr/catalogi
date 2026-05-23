// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createUsecaseActions } from "redux-clean-architecture";
import { id } from "tsafe/id";
import { assert } from "tsafe/assert";
import type { ApiTypes } from "api";
import type { LocalizedString } from "i18nifty";
import type { Language } from "api";

type SoftwareFormState = SoftwareFormState.NotInitialized | SoftwareFormState.Ready;

namespace SoftwareFormState {
    export type NotInitialized = {
        stateDescription: "not ready";
        isInitializing: boolean;
    };

    export type Ready = {
        stateDescription: "ready";
        step: number;
        formData: Partial<FormData>;
        softwareSillId?: number;
        isSubmitting: boolean;
        /**
         * Per-source contributions for the software being edited. Used to render
         * per-field "i" popovers in the form so editors can see what each source has.
         * Empty array on create; populated on update.
         */
        dataBySource: ApiTypes.SoftwareSourceData[];
    };
}

export type FormData = {
    step1: {
        operatingSystems: Partial<Record<ApiTypes.Os, boolean>>;
        runtimePlatforms: ApiTypes.RuntimePlatform[];
    };
    step2: {
        externalId: string | undefined;
        name: string;
        description: string;
        license: string;
        image: string | undefined;
        keywords: string[];
        userInputOverrides: {
            name?: boolean;
            description?: boolean;
            license?: boolean;
            image?: boolean;
        };
    };
    step3: {
        customAttributes: ApiTypes.CustomAttributes | undefined;
        protections: ApiTypes.SoftwareFormData["protections"];
    };
    step4: {
        similarSoftwares: {
            name: LocalizedString<Language>;
            description: LocalizedString<Language>;
            externalId: string;
            sourceSlug: string | undefined;
            isLibreSoftware: boolean | null;
        }[];
    };
};

export const name = "softwareForm" as const;

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<SoftwareFormState>({
        stateDescription: "not ready",
        isInitializing: false
    }),
    reducers: {
        initializedForCreate: () =>
            id<SoftwareFormState.Ready>({
                stateDescription: "ready",
                formData: {},
                softwareSillId: undefined,
                step: 1,
                isSubmitting: false,
                dataBySource: []
            }),
        initializedForCreateWithPreSelectedSoftware: (
            _state,
            {
                payload
            }: {
                payload: {
                    externalId: string;
                    name: string;
                    description: string;
                    license: string;
                    image: string | undefined;
                    keywords: string[];
                };
            }
        ) => {
            const { externalId, name, description, license, image, keywords } = payload;

            return id<SoftwareFormState.Ready>({
                stateDescription: "ready",
                formData: {
                    step2: {
                        externalId,
                        name,
                        description,
                        license,
                        image,
                        keywords,
                        userInputOverrides: {}
                    }
                },
                softwareSillId: undefined,
                step: 1,
                isSubmitting: false,
                dataBySource: []
            });
        },
        initializedForUpdate: (
            _state,
            {
                payload
            }: {
                payload: {
                    softwareSillId: number;
                    formData: FormData;
                    dataBySource: ApiTypes.SoftwareSourceData[];
                };
            }
        ) => {
            const { formData, softwareSillId, dataBySource } = payload;

            return {
                stateDescription: "ready",
                step: 1,
                softwareSillId,
                formData,
                isSubmitting: false,
                dataBySource
            };
        },
        initializationStarted: state => {
            assert(state.stateDescription === "not ready");
            state.isInitializing = true;
        },
        step1DataSet: (
            state,
            {
                payload
            }: {
                payload: {
                    formDataStep1: FormData["step1"];
                };
            }
        ) => {
            const { formDataStep1 } = payload;

            assert(state.stateDescription === "ready");

            state.formData.step1 = formDataStep1;
            state.step++;
        },
        step2DataSet: (
            state,
            {
                payload
            }: {
                payload: {
                    formDataStep2: FormData["step2"];
                };
            }
        ) => {
            const { formDataStep2 } = payload;

            assert(state.stateDescription === "ready");

            state.formData.step2 = formDataStep2;
            state.step++;
        },
        step3DataSet: (
            state,
            {
                payload
            }: {
                payload: {
                    formDataStep3: FormData["step3"];
                };
            }
        ) => {
            const { formDataStep3 } = payload;

            assert(state.stateDescription === "ready");

            state.formData.step3 = formDataStep3;
            state.step++;
        },
        navigatedToPreviousStep: state => {
            assert(state.stateDescription === "ready");
            state.step--;
        },
        submissionStarted: state => {
            assert(state.stateDescription === "ready");

            state.isSubmitting = true;
        },
        submissionEnded: state => {
            assert(state.stateDescription === "ready");

            state.isSubmitting = false;
        },
        formSubmitted: (
            _state,
            {
                //NOTE: To be registered by SoftwareCatalog
                payload: _payload
            }: {
                payload: {
                    name: string;
                };
            }
        ) => {},
        cleared: () => ({
            stateDescription: "not ready" as const,
            isInitializing: false
        })
    }
});
