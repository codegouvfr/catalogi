// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { fr } from "@codegouvfr/react-dsfr";
import type { Link } from "type-route";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import { assert } from "tsafe/assert";
import { Equals } from "tsafe";

export type Props = {
    className?: string;
    seeUserAndReferent: Link | undefined;
    referentCount: number;
    userCount: number;
};

export function DetailUsersAndReferents(props: Props) {
    const { className, seeUserAndReferent, referentCount, userCount, ...rest } = props;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { t } = useTranslation();
    const { classes, cx } = useStyles();

    const referentColor =
        referentCount !== 0 ? undefined : fr.colors.decisions.text.default.error.default;

    return (
        <a
            {...seeUserAndReferent}
            className={cx(fr.cx("fr-card__detail"), classes.root, className)}
        >
            <i className={cx(fr.cx("fr-icon-user-line"), classes.detailsUsersIcon)} />
            <span>
                {userCount !== 0 && t("detailUsersAndReferents.users", { userCount })}
                <span style={{ color: referentColor }}>
                    {t("detailUsersAndReferents.referents", { referentCount })}
                </span>
            </span>
            <i className={cx(fr.cx("fr-icon-arrow-right-s-line"))} />
        </a>
    );
}

const useStyles = tss.withName({ DetailUsersAndReferents }).create({
    root: {
        display: "flex",
        alignItems: "center",
        background: "none"
    },
    detailsUsersIcon: {
        marginRight: fr.spacing("2v")
    }
});
