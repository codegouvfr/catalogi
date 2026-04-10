// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import type { ApiTypes } from "api";
import { SourceProvenanceView } from "./SourceProvenanceView";

const modal = createModal({
    id: "source-provenance",
    isOpenedByDefault: false
});

export const { open: openSourceProvenanceModal } = modal;

type Props = {
    dataBySource: ApiTypes.SoftwareSourceData[];
};

export function SourceProvenanceModal(props: Props) {
    const { dataBySource } = props;
    const { t } = useTranslation();
    const { classes } = useStyles();

    return (
        <modal.Component
            className={classes.modal}
            title={t("sourceProvenance.modalTitle")}
            size="large"
        >
            <SourceProvenanceView dataBySource={dataBySource} />
        </modal.Component>
    );
}

const useStyles = tss.withName({ SourceProvenanceModal }).create({
    modal: {
        // Widen the dialog beyond DSFR's "large" preset. DSFR caps the
        // .fr-container at its breakpoint width AND limits the inner
        // .fr-col to 8/12 at lg, so both rules below are required to
        // actually use the available horizontal space.
        "& .fr-container": {
            maxWidth: "min(1900px, 98vw)"
        },
        "& .fr-grid-row > [class*='fr-col-']": {
            flex: "0 0 100% !important",
            maxWidth: "100% !important",
            width: "100% !important"
        },
        // DSFR computes the modal body's max-height dynamically based on
        // the actual room the dialog has — DO NOT override it with a vh
        // calc, or the body will overflow its parent and the bottom of
        // the table will be silently clipped. We only flip the body's
        // overflow off so the table is the only scrolling viewport, and
        // turn the body/content into flex columns so the table fills the
        // available space.
        "& .fr-modal__body": {
            overflow: "hidden !important",
            display: "flex",
            flexDirection: "column"
        },
        "& .fr-modal__content": {
            display: "flex",
            flexDirection: "column",
            flex: "1 1 auto",
            minHeight: 0,
            paddingBottom: "1rem"
        }
    }
});
