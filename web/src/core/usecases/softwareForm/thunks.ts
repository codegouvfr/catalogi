// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { assert } from "tsafe/assert";
import type { ApiTypes } from "api";
import type { Language } from "api";
import { createResolveLocalizedString } from "i18nifty";
import { name, actions, type FormData } from "./state";
import { selectors as sourceSelectors } from "core/usecases/source.slice";

export const thunks = {
    initialize:
        (
            params:
                | {
                      scenario: "create";
                      externalId: string | undefined;
                  }
                | {
                      scenario: "update";
                      softwareId: number;
                  }
        ) =>
        async (...args) => {
            const [dispatch, getState, { sillApi }] = args;

            {
                const state = getState()[name];

                assert(
                    state.stateDescription === "not ready",
                    "The clear function should have been called"
                );

                if (state.isInitializing) {
                    return;
                }
            }

            if (params.scenario === "create" && params.externalId === undefined) {
                dispatch(actions.initializedForCreate());
                return;
            }

            dispatch(actions.initializationStarted());

            switch (params.scenario) {
                case "create":
                    {
                        const { externalId } = params;

                        assert(externalId !== undefined);

                        const { keywords, description, license, image, name } =
                            await dispatch(thunks.getAutofillData({ externalId }));

                        dispatch(
                            actions.initializedForCreateWithPreSelectedSoftware({
                                externalId,
                                name: name ?? "",
                                description: description ?? "",
                                license: license ?? "",
                                image,
                                keywords
                            })
                        );
                    }
                    break;
                case "update":
                    {
                        const software = await sillApi.getSoftwareDetails({
                            softwareId: params.softwareId
                        });

                        assert(software !== undefined);

                        const softwareList = await sillApi.getSoftwareList();

                        const { resolveLocalizedString } = createResolveLocalizedString({
                            currentLanguage: "fr",
                            fallbackLanguage: "en"
                        });

                        dispatch(
                            actions.initializedForUpdate({
                                softwareSillId: software.id,
                                formData: {
                                    step1: {
                                        operatingSystems: software.operatingSystems,
                                        runtimePlatforms: software.runtimePlatforms
                                    },
                                    step2: {
                                        externalId: software.externalId,
                                        description: resolveLocalizedString(
                                            software.description
                                        ),
                                        license: software.license,
                                        name: resolveLocalizedString(software.name),
                                        image: software.image,
                                        keywords: software.keywords
                                    },
                                    step3: software.customAttributes,
                                    step4: {
                                        similarSoftwares: software.similarSoftwares.map(
                                            similarSoftware => ({
                                                name: similarSoftware.name,
                                                description: similarSoftware.description,
                                                isLibreSoftware:
                                                    similarSoftware.isLibreSoftware,
                                                externalId: similarSoftware.externalId,
                                                sourceSlug: similarSoftware.sourceSlug
                                            })
                                        )
                                    }
                                }
                            })
                        );
                    }
                    break;
            }
        },
    clear:
        () =>
        (...args) => {
            const [dispatch, getState] = args;

            {
                const state = getState()[name];

                if (state.stateDescription === "not ready") {
                    return;
                }
            }

            dispatch(actions.cleared());
        },
    setStep1Data:
        (props: { formDataStep1: FormData["step1"] }) =>
        (...args) => {
            const { formDataStep1 } = props;

            const [dispatch] = args;

            dispatch(actions.step1DataSet({ formDataStep1 }));
        },
    setStep2Data:
        (props: { formDataStep2: FormData["step2"] }) =>
        (...args) => {
            const { formDataStep2 } = props;

            const [dispatch] = args;

            dispatch(actions.step2DataSet({ formDataStep2 }));
        },
    setStep3Data:
        (props: { formDataStep3: FormData["step3"] }) =>
        (...args) => {
            const { formDataStep3 } = props;

            const [dispatch] = args;

            dispatch(actions.step3DataSet({ formDataStep3 }));
        },
    setStep4DataAndSubmit:
        (props: { formDataStep4: FormData["step4"] }) =>
        async (...args) => {
            const { formDataStep4 } = props;

            const [dispatch, getState, { sillApi }] = args;

            const rootState = getState();
            const state = rootState[name];

            assert(state.stateDescription === "ready");

            const mainSource = sourceSelectors.main(rootState);
            assert(mainSource !== undefined);

            const { step1, step2, step3 } = state.formData;

            assert(step1 !== undefined);
            assert(step2 !== undefined);
            assert(step3 !== undefined);

            const formData: ApiTypes.SoftwareFormData = {
                operatingSystems: step1.operatingSystems,
                runtimePlatforms: step1.runtimePlatforms,
                externalIdForSource: step2.externalId,
                sourceSlug: mainSource.slug,
                name: step2.name,
                description: step2.description,
                license: step2.license,
                customAttributes: step3,
                similarSoftwareExternalDataItems: formDataStep4.similarSoftwares.map(
                    ({ externalId, sourceSlug, name, description, isLibreSoftware }) => ({
                        externalId,
                        sourceSlug: sourceSlug ?? mainSource.slug,
                        name,
                        description,
                        isLibreSoftware
                    })
                ),
                image: step2.image,
                keywords: step2.keywords
            };

            dispatch(actions.submissionStarted());

            await (state.softwareSillId !== undefined
                ? sillApi.updateSoftware({
                      softwareSillId: state.softwareSillId,
                      formData
                  })
                : sillApi.createSoftware({
                      formData
                  }));

            dispatch(actions.formSubmitted({ name: step2.name }));
        },
    returnToPreviousStep:
        () =>
        (...args) => {
            const [dispatch] = args;

            dispatch(actions.navigatedToPreviousStep());
        },
    getExternalSoftwareOptions:
        (props: { queryString: string; language: Language }) =>
        async (...args) => {
            const { queryString, language } = props;

            const [, , { sillApi }] = args;

            return await sillApi.getExternalSoftwareOptions({ queryString, language });
        },
    getAutofillData:
        (props: { externalId: string }) =>
        (...args) => {
            const { externalId } = props;

            const [, , extraArg] = args;

            return extraArg.sillApi.getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources(
                { externalId }
            );
        }
} satisfies Thunks;
