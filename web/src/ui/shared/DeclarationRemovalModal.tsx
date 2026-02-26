// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useCoreState, useCore } from "core";
import { Evt } from "evt";
import { useEvt } from "evt/hooks";
import { useRerenderOnStateChange } from "evt/hooks";
import { useTranslation } from "react-i18next";
import CircularProgress from "@mui/material/CircularProgress";

const modal = createModal({
    id: "declaration-removal",
    isOpenedByDefault: false
});

type Params = {
    softwareId: number;
    name: string;
    declarationType: "user" | "referent";
};

const evtParams = Evt.create<Params | undefined>(undefined);

evtParams.toStateless().attach(() => modal.open());

export function openDeclarationRemovalModal(params: Params) {
    evtParams.state = params;
}

export function DeclarationRemovalModal() {
    const { declarationRemoval } = useCore().functions;
    const { evtDeclarationRemoval } = useCore().evts;
    const isRemovingUserDeclaration = useCoreState(
        "declarationRemoval",
        "isRemovingUserDeclaration"
    );

    const { t } = useTranslation();

    useEvt(ctx =>
        evtDeclarationRemoval.attach(
            ({ action }) => action === "close modal",
            ctx,
            () => modal.close()
        )
    );

    useRerenderOnStateChange(evtParams);

    const params = evtParams.state;

    const {
        name: softwareName = "",
        softwareId = 0,
        declarationType = "referent"
    } = params ?? {};

    return (
        <modal.Component
            title={
                declarationType === "referent"
                    ? t("declarationRemovalModal.stop being_referent", { softwareName })
                    : t("declarationRemovalModal.stop being_user", { softwareName })
            }
            buttons={[
                {
                    doClosesModal: true,
                    children: t("declarationRemovalModal.cancel")
                },
                {
                    doClosesModal: false,
                    onClick: () =>
                        declarationRemoval.removeAgentAsReferentOrUserFromSoftware({
                            softwareId,
                            declarationType
                        }),
                    nativeButtonProps: {
                        disabled: isRemovingUserDeclaration
                    },
                    children: (
                        <>
                            {t("declarationRemovalModal.confirm")}{" "}
                            {isRemovingUserDeclaration && (
                                <>
                                    &nbsp;&nbsp;&nbsp;
                                    <CircularProgress size={20} />
                                </>
                            )}
                        </>
                    )
                }
            ]}
        >
            {declarationType === "referent"
                ? t("declarationRemovalModal.do you confirm_referent")
                : t("declarationRemovalModal.do you confirm_using")}{" "}
            {softwareName} ?
        </modal.Component>
    );
}

export type DeclarationType = "user" | "referent";
