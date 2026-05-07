// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { Evt } from "evt";
import { useRerenderOnStateChange } from "evt/hooks";
import { Trans, useTranslation } from "react-i18next";

const modal = createModal({
    id: "field-override-warning",
    isOpenedByDefault: false
});

type Params = {
    fieldLabel: string;
    sourceName: string;
    sourceUrl: string | undefined;
    onConfirm: () => void;
};

const evtParams = Evt.create<Params | undefined>(undefined);

evtParams.toStateless().attach(params => {
    if (params !== undefined) modal.open();
});

export function openOverrideWarningModal(params: Params) {
    evtParams.state = params;
}

export function OverrideWarningModal() {
    const { t } = useTranslation();

    useRerenderOnStateChange(evtParams);

    // Drop the closure when the modal is dismissed (cancel/confirm/X/backdrop/Esc)
    // so onConfirm doesn't pin parent form state until the next override request.
    useIsModalOpen(modal, {
        onConceal: () => {
            evtParams.state = undefined;
        }
    });

    const params = evtParams.state;

    return (
        <modal.Component
            title={t("overrideWarningModal.title", {
                fieldLabel: params?.fieldLabel ?? ""
            })}
            // type="button" on the inner buttons: the modal is rendered inside
            // the parent <form> and React bubbles the click through its virtual
            // tree even though DSFR portals the DOM. Without it, clicks would
            // submit the form.
            buttons={[
                {
                    doClosesModal: true,
                    nativeButtonProps: { type: "button" },
                    children: t("overrideWarningModal.cancel")
                },
                {
                    doClosesModal: true,
                    nativeButtonProps: { type: "button" },
                    onClick: () => params?.onConfirm(),
                    children: t("overrideWarningModal.confirm")
                }
            ]}
        >
            <p>
                <Trans
                    i18nKey="overrideWarningModal.body"
                    values={{ sourceName: params?.sourceName ?? "" }}
                    components={{ b: <b /> }}
                />
            </p>
            {params?.sourceUrl !== undefined && (
                <p>
                    <Trans
                        i18nKey="overrideWarningModal.editAtSource"
                        values={{ sourceName: params.sourceName }}
                        components={{
                            sourceLink: (
                                /* eslint-disable-next-line jsx-a11y/anchor-has-content */
                                <a
                                    href={params.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                />
                            )
                        }}
                    />
                </p>
            )}
        </modal.Component>
    );
}
