// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import type { ApiTypes } from "api";
import { tss } from "tss-react";
import { optionIconClassByValue } from "./attributeIcons";

export const AttributeOptionBadge = (props: {
    label: string;
    severity: ApiTypes.AttributeOptionSeverity | undefined;
    icon: ApiTypes.AttributeOptionIcon | undefined;
}) => {
    const { label, severity, icon } = props;
    const { classes, cx } = useStyles();

    return (
        <Badge severity={severity} noIcon small as="span">
            {icon !== undefined && (
                <i
                    aria-hidden="true"
                    className={cx(
                        fr.cx(optionIconClassByValue[icon], "fr-icon--xs"),
                        classes.icon
                    )}
                />
            )}
            {label}
        </Badge>
    );
};

const useStyles = tss.withName({ AttributeOptionBadge }).create({
    icon: {
        marginRight: fr.spacing("1v")
    }
});
