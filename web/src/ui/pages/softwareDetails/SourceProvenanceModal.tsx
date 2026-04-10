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
        // Widen the dialog beyond DSFR's "large" preset.
        "& .fr-container": {
            maxWidth: "min(1700px, 98vw)"
        },
        // Cap the body well below the viewport. DSFR's grid centers the
        // dialog with non-trivial top padding (~4rem in practice), so a
        // 100vh max-height pushes the bottom edge below the fold. Leave
        // ~8rem of safety margin to keep the body's bottom within view
        // on every screen size.
        "& .fr-modal__body": {
            maxHeight: "calc(100vh - 8rem) !important",
            // DSFR already sets overflow-y: auto on .fr-modal__body —
            // we just need to keep that behaviour. Force a visible
            // scrollbar on macOS instead of the auto-hide overlay one.
            scrollbarWidth: "thin",
            scrollbarGutter: "stable"
        },
        "& .fr-modal__content": {
            maxHeight: "none !important"
        },
        // Compact the comparison table rows.
        "& .fr-table td, & .fr-table th": {
            paddingTop: "0.35rem",
            paddingBottom: "0.35rem",
            verticalAlign: "top",
            lineHeight: 1.35
        }
    }
});
