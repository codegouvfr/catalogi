// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { memo, useState } from "react";
import { Popover } from "@mui/material";
import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";
import { useTranslation } from "react-i18next";
import type { ApiTypes } from "api";
import {
    SourceProvenanceView,
    type SourceFieldKey
} from "ui/pages/softwareDetails/SourceProvenanceView";

export type Props = {
    dataBySource: ApiTypes.SoftwareSourceData[];
    field: SourceFieldKey;
};

/**
 * A small "i" button that opens a read-only popover showing what every source
 * contributes for a single form field. The popover is purely informational —
 * the editor opts into a UserInput override via the per-field pencil affordance,
 * not from here.
 */
export const FieldSourcePopover = memo((props: Props) => {
    const { dataBySource, field } = props;
    const { classes } = useStyles();
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

    if (dataBySource.length === 0) return null;

    return (
        <>
            <button
                type="button"
                className={classes.trigger}
                onClick={event => setAnchorEl(event.currentTarget)}
                aria-label={t("headerDetailCard.openSourceProvenance")}
                title={t("headerDetailCard.openSourceProvenance")}
            >
                <i className={fr.cx("fr-icon-information-line")} />
            </button>
            <Popover
                open={anchorEl !== null}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
            >
                <SourceProvenanceView dataBySource={dataBySource} field={field} />
            </Popover>
        </>
    );
});

const useStyles = tss.withName({ FieldSourcePopover }).create({
    trigger: {
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: fr.spacing("1v"),
        color: fr.colors.decisions.text.actionHigh.blueFrance.default
    }
});
