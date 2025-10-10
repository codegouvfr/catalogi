// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { CustomAttributes } from "api/dist/src/core/usecases/readWriteSillData/attributeTypes";
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
    };
}

export type FormData = {
    step1: {
        softwareType: ApiTypes.SoftwareType;
    };
    step2: {
        externalId: string | undefined;
        softwareName: string;
        softwareDescription: string;
        softwareLicense: string;
        softwareMinimalVersion: string | undefined;
        softwareLogoUrl: string | undefined;
        softwareKeywords: string[];
    };
    step3: CustomAttributes | undefined;
    step4: {
        similarSoftwares: {
            label: LocalizedString<Language>;
            description: LocalizedString<Language>;
            externalId: string;
            sourceSlug: string | undefined;
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
                isSubmitting: false
            }),
        initializedForCreateWithPreSelectedSoftware: (
            _state,
            {
                payload
            }: {
                payload: {
                    externalId: string;
                    softwareName: string;
                    softwareDescription: string;
                    softwareLicense: string;
                    softwareMinimalVersion: string;
                    softwareLogoUrl: string | undefined;
                    softwareKeywords: string[];
                };
            }
        ) => {
            const {
                externalId,
                softwareName,
                softwareDescription,
                softwareLicense,
                softwareMinimalVersion,
                softwareLogoUrl,
                softwareKeywords
            } = payload;

            return id<SoftwareFormState.Ready>({
                stateDescription: "ready",
                formData: {
                    step2: {
                        externalId,
                        softwareName,
                        softwareDescription,
                        softwareLicense,
                        softwareMinimalVersion,
                        softwareLogoUrl,
                        softwareKeywords
                    }
                },
                softwareSillId: undefined,
                step: 1,
                isSubmitting: false
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
                };
            }
        ) => {
            const { formData, softwareSillId } = payload;

            return {
                stateDescription: "ready",
                step: 1,
                softwareSillId,
                formData,
                isSubmitting: false
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
        formSubmitted: (
            _state,
            {
                //NOTE: To be registered by SoftwareCatalog
                payload: _payload
            }: {
                payload: {
                    softwareName: string;
                };
            }
        ) => {},
        cleared: () => ({
            stateDescription: "not ready" as const,
            isInitializing: false
        })
    }
});
