import { createUsecaseActions } from "redux-clean-architecture";
import { id } from "tsafe/id";
import type { ApiTypes } from "api";

export type State = State.NotReady | State.Ready;

export namespace State {
    export type NotReady = {
        stateDescription: "not ready";
        isInitializing: boolean;
    };

    export type Ready = {
        stateDescription: "ready";
        email: string;
        organization: string;
        about: string | undefined;
        isHimself: boolean;
        declarations: ApiTypes.Agent["declarations"];
    };
}

export const name = "userProfile" as const;

export const { reducer, actions } = createUsecaseActions({
    name,
    "initialState": id<State>({
        "stateDescription": "not ready",
        "isInitializing": false
    }),
    "reducers": {
        "initializationStarted": () => ({
            "stateDescription": "not ready" as const,
            "isInitializing": true
        }),
        "initializationCompleted": (
            _state,
            {
                payload
            }: {
                payload: {
                    email: string;
                    organization: string;
                    about: string | undefined;
                    isHimself: boolean;
                    declarations: ApiTypes.Agent["declarations"];
                };
            }
        ) => {
            const { about, email, organization, isHimself, declarations } = payload;

            return {
                "stateDescription": "ready",
                email,
                organization,
                about,
                isHimself,
                declarations
            };
        },
        "cleared": () => ({
            "stateDescription": "not ready" as const,
            "isInitializing": false
        })
    }
});
