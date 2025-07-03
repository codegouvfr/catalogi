import type { State as RootState } from "core/bootstrap";
import { createSelector } from "redux-clean-architecture";
import { name } from "./state";
import { assert } from "tsafe/assert";

const readyState = (rootState: RootState) => {
    const state = rootState[name];

    if (state.stateDescription !== "ready") {
        return undefined;
    }

    return state;
};

const isReady = createSelector(readyState, readyState => readyState !== undefined);

const step = createSelector(readyState, readyState => readyState?.step);

const formData = createSelector(readyState, readyState => readyState?.formData);

const isSubmitting = createSelector(readyState, readyState => readyState?.isSubmitting);

const isLastStep = createSelector(readyState, readyState => readyState?.step === 4);

const main = createSelector(
    isReady,
    step,
    formData,
    isSubmitting,
    isLastStep,
    (isReady, step, formData, isSubmitting, isLastStep) => {
        if (!isReady) {
            return {
                isReady: false as const
            };
        }

        assert(step !== undefined);
        assert(formData !== undefined);
        assert(isSubmitting !== undefined);
        assert(isLastStep !== undefined);

        return {
            isReady: true as const,
            step,
            formData,
            isSubmitting,
            isLastStep
        };
    }
);

export const selectors = { main };
